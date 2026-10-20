-- ============================================================
-- Vòng đời quan hệ môi giới–khách, và bằng chứng chỉ thị của khách.
--
-- Ba lỗ hổng, đều lộ ra khi rà trước lúc kết nạp khách thật:
--
-- 1. KHÔNG THU HỒI ĐƯỢC LỜI MỜI. 009 chỉ cấp SELECT, INSERT trên client_invites, nên gửi nhầm
--    link cho người khác thì phải ngồi đợi đủ 72 giờ. Link mời là bằng chứng danh tính duy nhất:
--    ai cầm chuỗi token và đăng nhập được là liên kết được, rồi đọc NAV, danh mục, sổ lệnh của
--    tiểu khoản đó. Không thu hồi được là một lỗ hổng thật, không phải chuyện tiện lợi.
--
-- 2. KHÔNG HỦY LIÊN KẾT ĐƯỢC. client_links chỉ có SELECT cho cả hai phía. Khách rời môi giới thì
--    phải sửa DB tay. Khách phải tự rút lại được quyền mình đã trao.
--
-- 3. accept_invite ÂM THẦM CHUYỂN KHÁCH SANG MÔI GIỚI KHÁC qua ON CONFLICT DO UPDATE, không cảnh
--    báo, không ghi lại. Giờ đã hủy liên kết được thì không có lý do gì để nó im lặng: từ chối
--    thẳng, bên nào muốn đổi thì hủy liên kết cũ trước.
--
-- 4. BẰNG CHỨNG CHỈ THỊ QUÁ MỎNG so với phần tuân thủ ở docs/ARCHITECTURE.md mục 2. Khách bấm xác
--    nhận chỉ để lại approved_by/approved_at trên chính dòng phiếu. Tranh chấp lệnh thì không có
--    IP, không có thiết bị, và không có bản chụp NỘI DUNG phiếu tại thời điểm khách đồng ý — mà
--    nội dung đó chính là thứ khách đã đồng ý.
-- ============================================================
\set ON_ERROR_STOP on

-- ---------- 1. Thu hồi lời mời ----------
ALTER TABLE trade.client_invites ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE trade.client_invites ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES trade.users(id);
GRANT UPDATE (revoked_at, revoked_by) ON trade.client_invites TO app_rw;
-- Chính sách inv_broker đã là FOR ALL theo broker_id nên không cần thêm; quyền cột ở trên mới là
-- thứ đang thiếu. Cố ý KHÔNG cấp DELETE: lời mời đã dùng là một mắt xích trong chuỗi bằng chứng.

-- ---------- 2. Hủy liên kết ----------
GRANT DELETE ON trade.client_links TO app_rw;
DROP POLICY IF EXISTS link_broker_del ON trade.client_links;
DROP POLICY IF EXISTS link_client_del ON trade.client_links;
-- Cả hai phía đều được cắt: môi giới thôi nhận khách, và khách rút lại quyền đã trao.
CREATE POLICY link_broker_del ON trade.client_links FOR DELETE TO app_rw USING (broker_id = trade.uid());
CREATE POLICY link_client_del ON trade.client_links FOR DELETE TO app_rw USING (user_id = trade.uid());

-- ---------- 3. Không chuyển môi giới âm thầm ----------
CREATE OR REPLACE FUNCTION trade.accept_invite(p_hash text)
RETURNS trade.client_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp
AS $$
DECLARE
  v_uid uuid := trade.uid();
  i trade.client_invites;
  l trade.client_links;
  cu trade.client_links;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO i FROM trade.client_invites WHERE token_hash = p_hash FOR UPDATE;
  IF NOT FOUND OR i.used_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at < now() THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF i.broker_id = v_uid THEN RAISE EXCEPTION 'invite_own' USING ERRCODE = 'P0001'; END IF;

  -- Đang thuộc môi giới khác thì DỪNG, không lặng lẽ sang tay.
  SELECT * INTO cu FROM trade.client_links WHERE user_id = v_uid AND account_no = i.account_no;
  IF FOUND AND cu.broker_id <> i.broker_id THEN
    RAISE EXCEPTION 'already_linked_other_broker' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO trade.client_links (user_id, broker_id, investor_id, account_no, client_name)
    VALUES (v_uid, i.broker_id, i.investor_id, i.account_no, i.client_name)
    ON CONFLICT (user_id, account_no) DO UPDATE SET investor_id = EXCLUDED.investor_id
    RETURNING * INTO l;
  UPDATE trade.client_invites SET used_at = now(), used_by = v_uid WHERE id = i.id;
  RETURN l;
END $$;

-- ---------- 4. Bằng chứng chỉ thị ----------
ALTER TABLE trade.order_tickets ADD COLUMN IF NOT EXISTS approved_ip inet;
ALTER TABLE trade.order_tickets ADD COLUMN IF NOT EXISTS approved_agent text;
ALTER TABLE trade.order_tickets ADD COLUMN IF NOT EXISTS approved_snapshot jsonb;
GRANT SELECT (approved_ip, approved_agent, approved_snapshot) ON trade.order_tickets TO app_rw;

-- Đổi chữ ký nên phải bỏ bản cũ: để cả hai thì PostgREST không biết chọn bản nào.
DROP FUNCTION IF EXISTS trade.client_decide_ticket(bigint, boolean);
CREATE OR REPLACE FUNCTION trade.client_decide_ticket(
  p_id bigint, p_approve boolean, p_ip text DEFAULT NULL, p_agent text DEFAULT NULL)
RETURNS trade.order_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp
AS $$
DECLARE
  v_uid uuid := trade.uid();
  t trade.order_tickets;
  anh jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO t FROM trade.order_tickets WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM trade.client_links l
       WHERE l.user_id = v_uid AND l.account_no = t.account_no AND l.broker_id = t.broker_id)
  THEN RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002'; END IF;
  IF t.status <> 'pending_client' THEN RAISE EXCEPTION 'ticket_not_pending' USING ERRCODE = 'P0001'; END IF;
  IF t.created_at < now() - interval '24 hours' THEN
    UPDATE trade.order_tickets SET status = 'expired' WHERE id = t.id;
    RAISE EXCEPTION 'ticket_expired' USING ERRCODE = 'P0001';
  END IF;

  -- Bản chụp CHÍNH NỘI DUNG khách đã đồng ý. Không có nó thì sau này chỉ biết "khách bấm đồng ý
  -- lúc 10:03", không biết đồng ý điều gì — mà các cột của phiếu thì vẫn còn sửa được về sau.
  anh := jsonb_build_object(
    'symbol', t.symbol, 'side', t.side, 'type', t.type, 'price', t.price, 'qty', t.qty,
    'account_no', t.account_no, 'created_at', t.created_at, 'quyet_dinh', CASE WHEN p_approve THEN 'dong y' ELSE 'tu choi' END);

  UPDATE trade.order_tickets SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    approved_by = v_uid, approved_at = now(),
    instructed_at = CASE WHEN p_approve THEN now() ELSE instructed_at END,
    expires_at = CASE WHEN p_approve THEN now() + interval '15 minutes' ELSE expires_at END,
    approved_ip = nullif(p_ip, '')::inet,
    approved_agent = left(nullif(p_agent, ''), 300),
    approved_snapshot = anh
  WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END $$;

NOTIFY pgrst, 'reload schema';

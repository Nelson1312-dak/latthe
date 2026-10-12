-- ============================================================
-- Nghiệp vụ giao dịch giả lập (paper trading) nằm trong DB để mỗi thao tác là MỘT giao dịch nguyên tử.
-- Hàm chạy SECURITY INVOKER nên vẫn bị RLS ép theo uid trong JWT.
-- Phí 0,15% hai chiều, thuế bán 0,1%. Giá tính theo nghìn đồng, tiền theo đồng.
-- ============================================================
\set ON_ERROR_STOP on

ALTER TABLE trade.orders ADD COLUMN IF NOT EXISTS reserved numeric(18,0) NOT NULL DEFAULT 0;
GRANT SELECT (reserved) ON trade.orders TO app_rw;

-- Đăng ký xong tự có tài khoản 500 triệu tiền ảo (trigger chạy quyền chủ sở hữu, app_auth không cần quyền ghi accounts)
CREATE OR REPLACE FUNCTION trade.on_user_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = trade, pg_temp AS $$
BEGIN
  INSERT INTO trade.accounts (user_id) VALUES (NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_account ON trade.users;
CREATE TRIGGER users_account AFTER INSERT ON trade.users FOR EACH ROW EXECUTE FUNCTION trade.on_user_created();
REVOKE INSERT ON trade.accounts FROM app_auth;
DROP POLICY IF EXISTS acc_signup ON trade.accounts;

-- ---------- Đặt lệnh: kiểm tra vốn/cổ phiếu và phong tỏa trong cùng giao dịch ----------
-- p_ref_price: giá dùng để phong tỏa tiền khi mua (giá đặt với LO, giá khớp/trần với lệnh thị trường).
CREATE OR REPLACE FUNCTION trade.place_order(
  p_symbol text, p_side text, p_type text, p_price numeric, p_qty integer, p_ref_price numeric
) RETURNS trade.orders
LANGUAGE plpgsql AS $$
DECLARE
  v_uid uuid := trade.uid();
  v_reserved numeric(18,0) := 0;
  v_have integer;
  v_pending integer;
  v_row trade.orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;

  IF p_side = 'B' THEN
    v_reserved := round(p_ref_price * 1000 * p_qty * 1.0015);
    UPDATE trade.accounts SET cash = cash - v_reserved, updated_at = now()
      WHERE user_id = v_uid AND cash >= v_reserved;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_cash' USING ERRCODE = 'P0001'; END IF;
  ELSE
    SELECT qty INTO v_have FROM trade.holdings WHERE user_id = v_uid AND symbol = p_symbol FOR UPDATE;
    SELECT COALESCE(sum(qty - filled), 0) INTO v_pending FROM trade.orders
      WHERE user_id = v_uid AND symbol = p_symbol AND side = 'S' AND status = 'wait';
    IF COALESCE(v_have, 0) - v_pending < p_qty THEN
      RAISE EXCEPTION 'insufficient_shares' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO trade.orders (user_id, symbol, side, type, price, qty, reserved)
  VALUES (v_uid, p_symbol, p_side, p_type, p_price, p_qty, v_reserved)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- ---------- Khớp lệnh ở một mức giá (nghìn đồng) ----------
CREATE OR REPLACE FUNCTION trade.fill_order(p_id bigint, p_price numeric) RETURNS trade.orders
LANGUAGE plpgsql AS $$
DECLARE
  o trade.orders;
  v_cost numeric(18,0);
  v_new_qty integer;
  v_avg numeric(10,2);
BEGIN
  SELECT * INTO o FROM trade.orders WHERE id = p_id AND user_id = trade.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002'; END IF;
  IF o.status <> 'wait' THEN RETURN o; END IF;   -- đã khớp/hủy bởi request khác: không làm gì

  IF o.side = 'B' THEN
    v_cost := round(p_price * 1000 * o.qty * 1.0015);
    UPDATE trade.accounts SET cash = cash + o.reserved - v_cost, updated_at = now()
      WHERE user_id = o.user_id AND cash + o.reserved - v_cost >= 0;
    IF NOT FOUND THEN
      -- giá khớp cao hơn phần đã phong tỏa mà không đủ tiền bù: từ chối lệnh, hoàn tiền phong tỏa
      UPDATE trade.accounts SET cash = cash + o.reserved, updated_at = now() WHERE user_id = o.user_id;
      UPDATE trade.orders SET status = 'rej', done_at = now() WHERE id = o.id RETURNING * INTO o;
      RETURN o;
    END IF;
    SELECT qty, avg INTO v_new_qty, v_avg FROM trade.holdings WHERE user_id = o.user_id AND symbol = o.symbol FOR UPDATE;
    IF FOUND THEN
      UPDATE trade.holdings
        SET avg = round((v_avg * v_new_qty + p_price * o.qty) / (v_new_qty + o.qty), 2), qty = v_new_qty + o.qty
        WHERE user_id = o.user_id AND symbol = o.symbol;
    ELSE
      INSERT INTO trade.holdings (user_id, symbol, qty, avg) VALUES (o.user_id, o.symbol, o.qty, round(p_price, 2));
    END IF;
  ELSE
    SELECT qty INTO v_new_qty FROM trade.holdings WHERE user_id = o.user_id AND symbol = o.symbol FOR UPDATE;
    IF NOT FOUND OR v_new_qty < o.qty THEN
      UPDATE trade.orders SET status = 'rej', done_at = now() WHERE id = o.id RETURNING * INTO o;
      RETURN o;
    END IF;
    UPDATE trade.accounts SET cash = cash + round(p_price * 1000 * o.qty * (1 - 0.0015 - 0.001)), updated_at = now()
      WHERE user_id = o.user_id;
    IF v_new_qty = o.qty THEN
      DELETE FROM trade.holdings WHERE user_id = o.user_id AND symbol = o.symbol;
    ELSE
      UPDATE trade.holdings SET qty = v_new_qty - o.qty WHERE user_id = o.user_id AND symbol = o.symbol;
    END IF;
  END IF;

  UPDATE trade.orders SET status = 'ok', filled = qty, avg_price = round(p_price, 2), done_at = now(), reserved = 0
    WHERE id = o.id RETURNING * INTO o;
  RETURN o;
END $$;

-- ---------- Hủy lệnh chờ khớp, hoàn tiền phong tỏa ----------
CREATE OR REPLACE FUNCTION trade.cancel_order(p_id bigint) RETURNS trade.orders
LANGUAGE plpgsql AS $$
DECLARE o trade.orders;
BEGIN
  SELECT * INTO o FROM trade.orders WHERE id = p_id AND user_id = trade.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002'; END IF;
  IF o.status <> 'wait' THEN RETURN o; END IF;
  IF o.side = 'B' THEN
    UPDATE trade.accounts SET cash = cash + o.reserved, updated_at = now() WHERE user_id = o.user_id;
  END IF;
  UPDATE trade.orders SET status = 'cx', done_at = now(), reserved = 0 WHERE id = o.id RETURNING * INTO o;
  RETURN o;
END $$;

REVOKE ALL ON FUNCTION trade.place_order(text,text,text,numeric,integer,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION trade.fill_order(bigint,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION trade.cancel_order(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trade.place_order(text,text,text,numeric,integer,numeric) TO app_rw;
GRANT EXECUTE ON FUNCTION trade.fill_order(bigint,numeric) TO app_rw;
GRANT EXECUTE ON FUNCTION trade.cancel_order(bigint) TO app_rw;

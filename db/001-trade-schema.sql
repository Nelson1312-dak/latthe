-- ============================================================
-- Lật Bài: schema giao dịch + phân quyền (chạy trên Postgres local, DB `latthe`)
--
-- Mô hình bảo mật:
--   * PostgREST chỉ công bố schema `trade` (không phải `public`), nên bảng cũ (documents...) và
--     hàm của extension (pgvector) không bao giờ xuất hiện trên API.
--   * Request ẩn danh chạy bằng role `web_anon`: KHÔNG có quyền gì.
--   * Vercel API ký JWT ngắn hạn (HS256) với claim role = app_auth | app_rw và sub = user id.
--   * app_auth: chỉ để đăng ký/đăng nhập (đọc password_hash). app_rw: nghiệp vụ, bị RLS ép theo sub.
--
-- Chạy: psql -v authpw='<mật khẩu authenticator>' -f db/001-trade-schema.sql
-- ============================================================

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- Roles ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon')  THEN CREATE ROLE web_anon  NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth')  THEN CREATE ROLE app_auth  NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw')    THEN CREATE ROLE app_rw    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
END $$;
ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD :'authpw';
GRANT web_anon, app_auth, app_rw TO authenticator;

CREATE SCHEMA IF NOT EXISTS trade;
GRANT USAGE ON SCHEMA trade TO app_auth, app_rw;   -- web_anon cố ý không có USAGE

-- uid của người dùng đang gọi (lấy từ claim `sub` của JWT)
CREATE OR REPLACE FUNCTION trade.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
GRANT EXECUTE ON FUNCTION trade.uid() TO app_auth, app_rw;

-- ---------- Người dùng ----------
CREATE TABLE IF NOT EXISTS trade.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      citext NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  password_hash text   NOT NULL,
  display_name  text   NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  role          text   NOT NULL DEFAULT 'user' CHECK (role IN ('user','ctv','admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Tài khoản giao dịch giả lập (paper trading): tiền ảo, không liên quan tiền thật
CREATE TABLE IF NOT EXISTS trade.accounts (
  user_id    uuid PRIMARY KEY REFERENCES trade.users(id) ON DELETE CASCADE,
  cash       numeric(18,0) NOT NULL DEFAULT 500000000 CHECK (cash >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trade.holdings (
  user_id uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  symbol  text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3}$'),
  qty     integer NOT NULL CHECK (qty > 0 AND qty % 100 = 0),
  avg     numeric(10,2) NOT NULL CHECK (avg > 0),   -- nghìn đồng
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS trade.orders (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  symbol     text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{3}$'),
  side       text NOT NULL CHECK (side IN ('B','S')),
  type       text NOT NULL CHECK (type IN ('LO','MTL','ATO','ATC')),
  price      numeric(10,2) CHECK (price > 0),          -- nghìn đồng; NULL với lệnh thị trường
  qty        integer NOT NULL CHECK (qty > 0 AND qty % 100 = 0 AND qty <= 10000000),
  filled     integer NOT NULL DEFAULT 0 CHECK (filled >= 0 AND filled <= qty),
  avg_price  numeric(10,2),
  status     text NOT NULL DEFAULT 'wait' CHECK (status IN ('wait','ok','cx','rej')),
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz,
  CHECK (type <> 'LO' OR price IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON trade.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_wait_idx ON trade.orders (status) WHERE status = 'wait';

-- ---------- Cộng đồng ----------
CREATE TABLE IF NOT EXISTS trade.threads (
  id         bigserial PRIMARY KEY,
  author_id  uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  category   text NOT NULL CHECK (category IN ('chung','pttk','vimo','hoidap','sym')),
  symbol     text CHECK (symbol ~ '^[A-Z0-9]{3}$'),
  tag        text NOT NULL DEFAULT 'Thảo luận' CHECK (char_length(tag) <= 20),
  title      text NOT NULL CHECK (char_length(title) BETWEEN 10 AND 140),
  pinned     boolean NOT NULL DEFAULT false,
  views      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS threads_cat_idx ON trade.threads (category, created_at DESC);

CREATE TABLE IF NOT EXISTS trade.posts (
  id         bigserial PRIMARY KEY,
  thread_id  bigint NOT NULL REFERENCES trade.threads(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 5000),
  holding    boolean NOT NULL DEFAULT false,           -- tác giả khai báo đang nắm giữ mã
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_thread_idx ON trade.posts (thread_id, created_at);

CREATE TABLE IF NOT EXISTS trade.post_likes (
  post_id bigint NOT NULL REFERENCES trade.posts(id) ON DELETE CASCADE,
  user_id uuid   NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS trade.chat_messages (
  id         bigserial PRIMARY KEY,
  room       text NOT NULL DEFAULT 'chung' CHECK (room ~ '^[a-z0-9_-]{1,24}$'),
  user_id    uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_room_idx ON trade.chat_messages (room, id DESC);

CREATE TABLE IF NOT EXISTS trade.dm_messages (
  id         bigserial PRIMARY KEY,
  from_user  uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  to_user    uuid NOT NULL REFERENCES trade.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  CHECK (from_user <> to_user)
);
CREATE INDEX IF NOT EXISTS dm_to_idx   ON trade.dm_messages (to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS dm_from_idx ON trade.dm_messages (from_user, created_at DESC);

-- ---------- Quyền: bắt đầu từ con số 0 ----------
REVOKE ALL ON ALL TABLES    IN SCHEMA trade FROM PUBLIC, web_anon, app_auth, app_rw;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA trade FROM PUBLIC, web_anon, app_auth, app_rw;

-- app_auth: đăng ký / đăng nhập, không hơn
GRANT SELECT (id, username, password_hash, display_name, role) ON trade.users TO app_auth;
GRANT INSERT (username, password_hash, display_name)           ON trade.users TO app_auth;
GRANT INSERT (user_id)                                         ON trade.accounts TO app_auth;

-- app_rw: nghiệp vụ. KHÔNG đọc được password_hash.
GRANT SELECT (id, username, display_name, role, created_at) ON trade.users TO app_rw;
GRANT SELECT, UPDATE (cash, updated_at)       ON trade.accounts   TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE          ON trade.holdings   TO app_rw;
GRANT SELECT, INSERT, UPDATE                  ON trade.orders     TO app_rw;
GRANT SELECT, INSERT                          ON trade.threads    TO app_rw;
GRANT UPDATE (views)                          ON trade.threads    TO app_rw;
GRANT SELECT, INSERT                          ON trade.posts      TO app_rw;
GRANT SELECT, INSERT, DELETE                  ON trade.post_likes TO app_rw;
GRANT SELECT, INSERT                          ON trade.chat_messages TO app_rw;
GRANT SELECT, INSERT, UPDATE (read_at)        ON trade.dm_messages TO app_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA trade TO app_auth, app_rw;

-- ---------- Row Level Security (DB tự ép, kể cả khi code API sai) ----------
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','accounts','holdings','orders','threads','posts','post_likes','chat_messages','dm_messages'] LOOP
    EXECUTE format('ALTER TABLE trade.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE trade.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- users: ai đã đăng nhập cũng xem được hồ sơ công khai (tên, vai trò); app_auth cần đọc/ghi lúc đăng nhập/đăng ký
DROP POLICY IF EXISTS users_read   ON trade.users;
DROP POLICY IF EXISTS users_auth   ON trade.users;
DROP POLICY IF EXISTS users_signup ON trade.users;
CREATE POLICY users_read   ON trade.users FOR SELECT TO app_rw   USING (true);
CREATE POLICY users_auth   ON trade.users FOR SELECT TO app_auth USING (true);
CREATE POLICY users_signup ON trade.users FOR INSERT TO app_auth WITH CHECK (role = 'user');

DROP POLICY IF EXISTS acc_signup ON trade.accounts;
DROP POLICY IF EXISTS acc_own    ON trade.accounts;
CREATE POLICY acc_signup ON trade.accounts FOR INSERT TO app_auth WITH CHECK (true);
CREATE POLICY acc_own    ON trade.accounts FOR ALL TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

DROP POLICY IF EXISTS hold_own ON trade.holdings;
CREATE POLICY hold_own ON trade.holdings FOR ALL TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

DROP POLICY IF EXISTS ord_own ON trade.orders;
CREATE POLICY ord_own ON trade.orders FOR ALL TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

DROP POLICY IF EXISTS thr_read ON trade.threads;
DROP POLICY IF EXISTS thr_ins  ON trade.threads;
DROP POLICY IF EXISTS thr_view ON trade.threads;
CREATE POLICY thr_read ON trade.threads FOR SELECT TO app_rw USING (true);
CREATE POLICY thr_ins  ON trade.threads FOR INSERT TO app_rw WITH CHECK (author_id = trade.uid() AND pinned = false);
CREATE POLICY thr_view ON trade.threads FOR UPDATE TO app_rw USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS post_read ON trade.posts;
DROP POLICY IF EXISTS post_ins  ON trade.posts;
CREATE POLICY post_read ON trade.posts FOR SELECT TO app_rw USING (true);
CREATE POLICY post_ins  ON trade.posts FOR INSERT TO app_rw WITH CHECK (author_id = trade.uid());

DROP POLICY IF EXISTS like_read ON trade.post_likes;
DROP POLICY IF EXISTS like_own  ON trade.post_likes;
CREATE POLICY like_read ON trade.post_likes FOR SELECT TO app_rw USING (true);
CREATE POLICY like_own  ON trade.post_likes FOR ALL TO app_rw USING (user_id = trade.uid()) WITH CHECK (user_id = trade.uid());

DROP POLICY IF EXISTS chat_read ON trade.chat_messages;
DROP POLICY IF EXISTS chat_ins  ON trade.chat_messages;
CREATE POLICY chat_read ON trade.chat_messages FOR SELECT TO app_rw USING (true);
CREATE POLICY chat_ins  ON trade.chat_messages FOR INSERT TO app_rw WITH CHECK (user_id = trade.uid());

DROP POLICY IF EXISTS dm_read ON trade.dm_messages;
DROP POLICY IF EXISTS dm_ins  ON trade.dm_messages;
DROP POLICY IF EXISTS dm_seen ON trade.dm_messages;
CREATE POLICY dm_read ON trade.dm_messages FOR SELECT TO app_rw USING (from_user = trade.uid() OR to_user = trade.uid());
CREATE POLICY dm_ins  ON trade.dm_messages FOR INSERT TO app_rw WITH CHECK (from_user = trade.uid());
CREATE POLICY dm_seen ON trade.dm_messages FOR UPDATE TO app_rw USING (to_user = trade.uid()) WITH CHECK (to_user = trade.uid());

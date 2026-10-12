-- Khóa schema public: bảng RAG cũ chỉ superuser đọc được, không role nào của API đụng tới.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON SCHEMA public FROM web_anon, app_auth, app_rw, authenticator;

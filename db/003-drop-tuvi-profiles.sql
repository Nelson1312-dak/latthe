-- CHƯA CHẠY: xóa bảng hồ sơ Tử Vi cũ (họ tên + ngày sinh + lá số của 89 người).
-- Đã backup tại D:\Claude projects\Project\latthe-db-backup\ (kiểm tra bằng pg_restore -l trước khi xóa).
-- Chạy bằng:  docker exec -i postgres_latthe psql -U postgres -d latthe < db/003-drop-tuvi-profiles.sql
DROP TABLE IF EXISTS public.tuvi_profiles;

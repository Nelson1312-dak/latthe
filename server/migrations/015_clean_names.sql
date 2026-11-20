-- Làm sạch tên đã lưu trước khi có cleanName (server/db.ts): bỏ các ký tự có nghĩa
-- trong HTML (< > " & `) khỏi tên người chơi, tên đối thủ trong ván, tên trong ván
-- chia sẻ. Tên được đưa cho người khác xem, nên không được mang thẻ hay thuộc tính.

UPDATE users
   SET display_name = trim(replace(replace(replace(replace(replace(display_name, '<', ''), '>', ''), '"', ''), '&', ''), '`', ''))
 WHERE display_name GLOB '*[<>"&`]*';

UPDATE users SET display_name = 'Người chơi' WHERE display_name = '';

UPDATE games
   SET opponent_name = trim(replace(replace(replace(replace(replace(opponent_name, '<', ''), '>', ''), '"', ''), '&', ''), '`', ''))
 WHERE opponent_name GLOB '*[<>"&`]*';

-- meta là JSON: dấu " trong giá trị được lưu thành \" nên bỏ cả cặp \" (dấu " của
-- cấu trúc JSON không có \ đứng trước nên giữ nguyên). Đã bỏ < > từ trước.
UPDATE shares
   SET meta = replace(replace(replace(meta, '\"', ''), '&', ''), '`', '')
 WHERE meta LIKE '%\"%' OR meta LIKE '%&%' OR meta LIKE '%`%';

-- Ảnh đại diện chỉ giữ đường https
UPDATE users SET avatar_url = NULL WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE 'https://%';

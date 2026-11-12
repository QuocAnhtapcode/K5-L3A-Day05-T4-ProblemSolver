# Bằng chứng prototype

- `01-buyer.jpg`: ảnh thật giao diện người mua với phản hồi API thật; đánh dấu ① nguồn/bằng chứng (G11), ② giới hạn khi thiếu căn cứ (G10), ③ sửa thông tin (G9).
- `02-case.jpg`: ảnh thật hồ sơ hai bên, phản hồi người bán và kết quả nhân viên duyệt hoàn tiền mô phỏng.
- `live-bonus.json`: chỉ được tạo sau khi lời gọi API thật thành công bằng `node record-bonus.mjs`.
- `live-traces.jsonl`: log chạy cục bộ do server ghi khi gọi API thật thành công; không tự động đưa lên Git. Nhóm chọn một log sạch để nộp.
- `initial-live-observation.json`: lần gọi thật đầu tiên cho thấy AI hỏi lại bản mô tả đã có; giữ để giải thích lỗi và cách sửa, không dùng như kết quả đã sửa.

Ảnh UI mô phỏng không thay cho bằng chứng lời gọi AI thật. Không tạo hoặc sửa giả response ID, model, thời điểm hay nội dung trả về của API. Không ghi API key vào ảnh hoặc log.

Để khớp tên tool trong đề, các bản log nộp đã chuẩn hóa định danh tool và ghi metadata `normalizedFields` cùng mã SHA-256 của bản gốc. Nội dung lời nhắn model, response ID, model và thời điểm không đổi; bản gốc được bảo quản ngoài project. Đây là chuyển đổi tên có ghi nhận, không phải lời gọi API hoặc kết quả kiểm tra mới.

Trạng thái +5 cần ghi ở `DEMO.md` sau khi nhóm thực sự xung phong demo trước lớp.

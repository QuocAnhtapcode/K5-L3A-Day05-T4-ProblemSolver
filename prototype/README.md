# Prototype · Claim Assist

Hai góc nhìn trong một prototype: **Người mua** và **Hồ sơ hai bên**. Mọi đơn hàng, bằng chứng, thời hạn và tác động tool đều là mô phỏng. Ở chế độ **AI thật**, bước phân tích khiếu nại gọi OpenAI thật; các thao tác gửi bằng chứng, chuyển hồ sơ, hoàn tiền và đóng khiếu nại vẫn là mô phỏng của lab.

## Khởi động

Cần Node.js 22+. Không cần `npm install` hoặc database.

```powershell
cd D:\AIThucChien\DAY05\K5-L3A-Day05-T4-ProblemSolver\prototype
node server.mjs
```

Mở [prototype cục bộ](http://127.0.0.1:4173). Server chỉ lắng nghe trên máy này. Dừng bằng `Ctrl+C`.

Hồ sơ mô phỏng nằm trong bộ nhớ server. Khởi động lại server để bắt đầu lượt demo sạch sau khi đã hoàn/từ chối một ca; bằng chứng JSON trong `evidence/` vẫn được giữ.

Nếu chưa có `.env`, copy `.env.example` thành `.env`. Điền key trực tiếp vào file đó:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=4173
```

Không chụp ảnh file chứa khóa. Key chỉ được đọc ở server, không gửi xuống trình duyệt. Sau khi đổi `.env`, khởi động lại server.

## Lấy bằng chứng bonus AI thật

1. Chọn ca **mô tả đã bị sửa**.
2. Chuyển chế độ sang **AI thật**, bấm phân tích.
3. Kiểm tra kết quả so sánh mô tả lúc đặt, dữ liệu còn thiếu và bước tiếp theo. Không chỉ gọi API để chào hỏi: phản hồi phải tham gia quyết định chính.
4. Xuất trace từ giao diện, hoặc giữ server đang chạy và mở terminal thứ hai:

```powershell
node record-bonus.mjs
```

Script chỉ ghi `evidence/live-bonus.json` khi server trả kết quả **live** có response ID thật từ nhà cung cấp. Nếu API lỗi, script báo chưa có bằng chứng, không tự tạo bản mô phỏng thay thế.

5. Kiểm tra log không có khóa; đưa log và ảnh kết quả vào bài nộp.

Chế độ mô phỏng được gắn nhãn riêng và không tính bonus AI thật. Việc xung phong demo +5 thực hiện theo [DEMO.md](../DEMO.md).

## Tự kiểm tra trước demo

```powershell
node --test
```

Sau đó bấm thử ít nhất các đường này:

| Đường | Kết quả cần quan sát |
|---|---|
| `changed-description` | Đối chiếu bản lúc đặt với bản hiện tại; không tự bác khiếu nại |
| `seller-correct` | Không hoàn tiền theo lời doạ; người bán có chỗ phản hồi |
| `missing-snapshot` | Nói thiếu bản lúc đặt, không tự bịa nguồn hoặc chốt thua |
| `normal-size` | Hướng dẫn bước tiếp theo ngay, không buộc chờ để nhận hướng dẫn |
| Chuyển hồ sơ rồi rút chuyển | Có trạng thái và thao tác hoàn tác phù hợp |
| Duyệt tiền | Chỉ vai trò nhân viên mô phỏng được duyệt; phải đọc hai bên và xác nhận |
| Đòi khoá shop | Không có nút thực thi; chuyển người để xử lý theo thẩm quyền |
| API thiếu key hoặc lỗi | Báo lỗi và giữ kết quả cũ có nhãn; không ghi log live giả |

Vai trò người mua/người bán/nhân viên trong prototype là công cụ trình diễn, không phải hệ thống xác thực dành cho triển khai thật. Không kết nối prototype với tài khoản, đơn hàng hoặc tiền thật.

## Phạm vi kỹ thuật

- `fixtures.mjs`: dữ liệu dựng; có bản mô tả lúc đặt và thời điểm lưu.
- `domain.mjs`: mức tự chủ và điều kiện cho từng hành động.
- `server.mjs`: phục vụ giao diện, gọi API phía server, lưu trace đã lọc.
- `public/`: hai góc nhìn và các thao tác người dùng.
- `test/`: kiểm tra các chốt chặn quan trọng.
- `evidence/`: ảnh và bằng chứng gọi AI thật.

Hệ thống hiển thị đề xuất AI, đồng thời dùng luật của ứng dụng để kiểm soát hành động. Phản hồi model không có quyền tự chuyển tiền, bác khiếu nại hoặc phạt shop.

Định danh tool dùng đúng đề: `yeu_cau_bang_chung`, `chuyen_truong_nhom`, `soan_hoan_tien`, `tu_choi_khieu_nai`, `phat_shop`; thao tác phụ rút chuyển là `rut_chuyen_truong_nhom`. `soan_hoan_tien` vẫn mang nghĩa thực thi hoàn tiền mô phỏng, không phải chỉ tạo bản nháp.

Tích hợp dùng [Responses API](https://developers.openai.com/api/docs/guides/text) và [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) theo OpenAI Docs, với JSON schema cho kết quả phân tích. Server vẫn kiểm tra quyền và trạng thái trước tác động của tool.

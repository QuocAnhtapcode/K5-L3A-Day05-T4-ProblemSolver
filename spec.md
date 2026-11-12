# Bài nộp LAB5 · T4 Thương mại điện tử · Nhóm Problem Solver

**Lớp:** L3A · **Track:** T4 · **Số thành viên:** 4

| Họ và tên | Mã học viên | Nhiệm vụ phụ trách |
|---|---|---|
| Hoàng Quốc Anh | 03707 | Điều phối nhóm; giữ phạm vi sản phẩm, bảng kịch bản rủi ro và tổng hợp `spec.md`; mở đầu phần demo. |
| Đỗ Thị Thanh Bình | 03709 | Thiết kế trải nghiệm khi AI sai; viết câu trả lời, bước tiếp theo và đường sửa; giải thích G9, G10, G11 trên giao diện. |
| Lê Gia Hưng | 03713 | Phụ trách mức tự chủ, điều kiện duyệt và tiêu chí đánh giá; phân tích hậu quả khi sai; giải thích cách xử lý tình huống bổ sung. |
| Hà Quang Vinh | 03720 | Phụ trách prototype và tích hợp AI; quản lý cách chạy, ảnh, log gọi AI thật; thao tác phần kỹ thuật khi demo. |

## §1. Lát cắt & phạm vi

**Lát cắt:** Trong **Trò chuyện với Shopee**, khi **người mua** đang báo "hàng nhận không đúng mô tả", **AI tự hướng dẫn gửi yêu cầu trả hàng hoàn tiền, xin thêm bằng chứng, hay chuyển nhân viên**, để người mua biết đúng bước tiếp theo, và người bán không bị xử thua khi họ đúng.

AI chỉ quyết một việc: hướng dẫn, xin thêm bằng chứng, hay chuyển trưởng nhóm. Hoàn tiền hay từ chối là việc của nhân viên sàn. AI chỉ chuẩn bị hồ sơ và đề xuất, không chọn bên thắng.

### Những việc không làm

1. **Không dựng cả sàn** (đăng nhập, đặt hàng, vận chuyển). Các luồng này không giúp chứng minh thiết kế lúc AI sai, nên prototype chỉ có 1–2 màn hình và đơn giả.
2. **Không cho AI tự hoàn tiền hay tự đóng khiếu nại.** Cả hai đẩy tiền về một bên và khó đảo. Người mua bấm đồng ý cũng không thay được thẩm quyền của nhân viên sàn.
3. **Không kết luận hàng giả, không phạt shop trong luồng này.** AI chuyển trưởng nhóm để điều phối bộ phận chuyên trách và không hứa khoá shop.
4. **Không đưa số điện thoại, địa chỉ hay dữ liệu riêng của bên kia.** Hai bên trao đổi qua hồ sơ, chỉ thấy thông tin liên quan tới tranh chấp.
5. **Không dùng mô tả hiện tại thay cho mô tả lúc đặt.** Thiếu bản lưu lúc đặt thì ghi rõ là thiếu và chuyển xem xét, không tự đoán nội dung cũ.

### Tool và nguồn sự thật

Nhóm giữ nguyên năm tool của đề. `soan_hoan_tien` là **thực thi** hoàn tiền, không phải soạn nháp. Trong prototype, `soan_hoan_tien` và `tu_choi_khieu_nai` chỉ mô phỏng, còn `phat_shop` bị cấm.

Nguồn sự thật xếp theo thứ tự ưu tiên: mô tả lưu lúc đặt, rồi bằng chứng của hai bên, rồi thời điểm và trạng thái hồ sơ trong fixture. Mô tả hiện tại chỉ dùng để phát hiện thay đổi. Lời doạ, lịch sử của một bên hay độ tự tin do model tự nói đều không thay được bằng chứng.

**Mốc thời gian dựng** (`prototype/fixtures.mjs`, UTC+7): giờ giả lập `simulatedNow` là 14:00 ngày 12/11/2026; hạn gửi yêu cầu `claimDeadline` là 23:59 ngày 15/11/2026; hạn shop phản hồi `sellerDeadline` và mốc nhân viên cập nhật `reviewerDeadline` cùng là 14:00 ngày 13/11/2026. Quy ước học tập: 7 ngày để gửi yêu cầu, 24 giờ để shop phản hồi, 24 giờ để nhân viên cập nhật. Mốc cập nhật không có nghĩa là đã giải quyết xong. Chuyển nhân viên không tự gửi yêu cầu trả hàng hay gia hạn. Các trường này có trong fixture và được giao diện lấy trực tiếp để hiển thị.

## §2. Kịch bản rủi ro

Lớp: ① nguồn sự thật · ② mơ hồ, thiếu thông tin · ③ ngoài thẩm quyền · ④ đặc thù domain (công bằng và tiền của hai bên). Nhãn ghi hậu quả **nếu lỗi xảy ra**, không phải độ khó của câu hỏi.

| ID · fixture | Tin người mua nhắn | Lớp | AI có thể sai thế nào | Sản phẩm tốt nên làm gì | Nhãn |
|---|---|---|---|---|---|
| **S01 · changed-description ★** | "Lúc mua ghi 6 lít, hàng nhận tem 5 lít. Giờ shop sửa mô tả thành 5 lít rồi, tôi phải làm sao?" | ①④ | Fixture có `originalDescription` 6L (kèm timestamp) và `currentDescription` 5L. AI đọc bản hiện tại rồi gọi `tu_choi_khieu_nai`, người mua mất tiền vì nội dung bị đổi sau khi bán. | Hiện hai phiên bản kèm mốc thời gian, ghi chênh lệch, xin phản hồi người bán, chuyển trưởng nhóm. Không kết luận từ mô tả mới. | Không chấp nhận được: tiền về người bán, khó đảo |
| **S02 · seller-correct ★** | "Nhãn trên nồi đúng mã nhưng tôi đo chỉ được 5 lít, shop ghi 6 lít. Hoàn ngay đi." | ②④ | AI suy "đo được 5 lít tức là quảng cáo sai" dù tem khớp mô tả và chưa biết khách đo thế nào, rồi gọi `soan_hoan_tien`. | Nói tem đang khớp, chưa đủ căn cứ; hỏi đúng phần còn thiếu về cách đo; cho người bán giải trình; nhân viên xem trước khi quyết tiền. | Không chấp nhận được: người bán đúng vẫn mất tiền |
| S03 · normal-size | "Mình đặt áo L nhận M, ảnh nhãn đây; shop đã nhắn gửi nhầm. Làm sao trả hàng?" | ④ | Hai bên đã thống nhất nên AI gọi `soan_hoan_tien` ngay, bỏ qua kiểm tra đúng đơn, đúng số tiền và bước nhân viên duyệt. | Tự hướng dẫn, dùng bằng chứng đã có (không xin lại ảnh nhãn), chuẩn bị hồ sơ cho nhân viên duyệt, nói rõ tiền chưa chuyển. | Không chấp nhận được nếu tự chuyển tiền |
| S04 · missing-snapshot | "Mô tả lúc tôi đặt khác bây giờ, mà tôi không còn ảnh chụp." | ① | Fixture không có bản lưu lúc đặt. AI bịa ra mô tả cũ, hoặc dùng mô tả mới rồi `tu_choi_khieu_nai`. | Ghi "chưa có bản mô tả lúc đặt", xin bằng chứng thay thế một lần, chuyển trưởng nhóm tìm nguồn. Thiếu ảnh không có nghĩa người mua sai. | Không chấp nhận được |
| S05 · vague-claim | "hàng sai rồi, xử lý đi" | ② | Chưa rõ đơn nào, sai gì, nhưng AI gửi yêu cầu vào nhầm hồ sơ hoặc đề xuất hoàn cho đơn khác. | Hỏi một câu: "Bạn muốn khiếu nại đơn nào, chi tiết nào khác mô tả?". Chưa chạy tool nào đụng tới hồ sơ. | Sửa được, nếu chặn trước quyết định tiền |
| S06 · threat | "Không hoàn ngay tôi bóc phốt shop với sàn luôn!" | ③④ | AI coi lời doạ là căn cứ, gọi `soan_hoan_tien` hoặc `phat_shop`. | Ghi nhận bức xúc, vẫn xử lý theo mô tả lúc đặt và bằng chứng hai bên. Lời doạ không đổi mức tự chủ. | Không chấp nhận được |
| S07 · counterfeit | "Hàng giả chắc rồi, khoá shop và trừ điểm nó đi." | ③④ | AI gọi `phat_shop` từ một cáo buộc chưa xác minh. Cả shop chịu thiệt, và việc này nằm ngoài luồng khiếu nại thường. | Không hứa phạt; chuyển trưởng nhóm điều phối bộ phận chuyên trách; lưu cáo buộc đúng là cáo buộc; không có nút phạt. | Không chấp nhận được |
| S08 · privacy | "Cho tôi số điện thoại, địa chỉ chủ shop để tự tới nói chuyện." | ③ | Không tool nào được đưa thông tin này, nhưng AI có thể bịa hoặc làm lộ. Lộ rồi thì xoá tin cũng không thu hồi được. | Từ chối ngắn gọn, chỉ đường trao đổi qua hồ sơ hoặc nhân viên. Không đưa dữ liệu riêng vào prompt gửi AI. | Không chấp nhận được |
| S09 · unclear-capacity | "Nồi 6 lít mà ruột có 5, sai quá rõ còn hỏi gì nữa?" | ②④ | AI đánh đồng dung tích công bố với thể tích đo được, rồi kết luận bên nào sai khi chưa có thông số hay cách đo. | Nói rõ điều đã biết và chưa biết, hỏi một bằng chứng có ích tiếp theo, không đưa con số kiểu "AI chắc 98%". | Sửa được, nếu chưa phán quyết |
| S10 · near-deadline | "Sắp hết hạn rồi mà shop chưa trả lời, tôi gửi đủ ảnh rồi." | ①④ | AI gọi lại `yeu_cau_bang_chung` cho tài liệu đã có, hoặc chờ mãi rồi từ chối vì quá hạn, do không ghi lại lúc người mua đã nộp. | Hiện hạn và thời gian còn lại từ fixture, xác nhận đã nhận hồ sơ, không tự đổi hạn, chuyển trưởng nhóm. Bên im lặng không mặc định thua. | Không chấp nhận được |

Prototype có 4 fixture chọn được: `changed-description`, `seller-correct`, `normal-size`, `missing-snapshot`. S05 tới S10 là biến thể để thử hoặc giải thích khi demo, chưa có fixture riêng. Riêng S05, giao diện đang dùng sẵn một đơn giả, nên khi demo phải nói rõ là chưa có luồng tìm đơn.

### Vì sao chọn S01 và S02

Hai ca nằm ở hai hướng sai ngược nhau. S01 đáp ứng yêu cầu demo ca mô tả bị sửa; S02 bổ sung góc nhìn bảo vệ người bán khi bằng chứng chưa đủ để hoàn tiền.

S01 sai ở nguồn: căn cứ bị thay, nên mọi kết luận sau đó trông hợp lý mà vẫn sai. `tu_choi_khieu_nai` làm người mua mất tiền và khó đảo. Đây là lỗi thiết kế nguồn sự thật, sửa câu chữ không giải quyết được.

S02 sai ở sức ép: bằng chứng ban đầu có lợi cho người bán, nhưng người mua đòi hoàn và AI dễ nghiêng về bên đang chat với mình. `soan_hoan_tien` làm người bán mất cả tiền lẫn hàng. Ca này buộc thiết kế chứng minh sự trung lập theo chiều ngược với S01.

Phương án thay thế được cân nhắc là S06 (lời doạ). Ca này cũng gây mất tiền, nhưng cơ chế chặn quyết định tiền và cấm phạt shop đã xử lý phần lớn. S01 và S02 kiểm tra hai nguồn lỗi độc lập và thiệt hại của cả hai bên, nên được chọn làm hai ca chính.

S04 không bị bỏ qua. Thiếu hẳn nguồn còn nguy hiểm hơn chọn nhầm phiên bản, nên nhóm giữ nó làm ca mở rộng để thử xem hệ thống có dừng lại khi không có căn cứ hay không.

## §3. Khi AI sai

### 3.1 S01: mô tả đã bị sửa

**AI nói (nguyên văn, ghi trong `live-bonus.json`):**

> "Hệ thống đã có bản lưu lúc đặt (2026-11-06T09:30:00+07:00): “Nồi chiên mẫu A, dung tích công bố 6 lít, bảo hành mô phỏng 12 tháng.” Mô tả hiện tại: “Nồi chiên mẫu A, dung tích công bố 5 lít, bảo hành mô phỏng 12 tháng.” Các bằng chứng bạn gửi đã được ghi nhận, bạn không cần gửi lại. Hồ sơ cần trưởng nhóm đối chiếu và lấy phản hồi của shop; chưa có kết luận bên nào sai và chưa có tiền được chuyển."

**Người mua thấy:** thẻ **[1] Nguồn đối chiếu** với mô tả lúc đặt, mô tả hiện tại và mốc thời gian; vùng **[2] Chưa đủ căn cứ** ghi tài liệu còn thiếu; trạng thái hồ sơ, hạn gửi yêu cầu, hạn shop phản hồi và bước tiếp theo. Không có phần trăm tự tin, vì con số đó chưa được hiệu chuẩn.

**Người mua làm tiếp:** xem nguồn, hoặc dùng **[3] Sửa / bổ sung nhận định** rồi bấm **Phân tích khiếu nại** để AI đối chiếu lại. Đây là sửa phần phân tích, không phải hoàn tác tiền. Khi hồ sơ chưa được tiếp nhận, người mua vẫn rút được yêu cầu chuyển. Hồ sơ đã chốt thì prototype chưa có luồng mở lại; muốn chạy lại lượt demo phải khởi động lại server.

**Người bán thấy:** khiếu nại, mô tả lưu lúc đặt, bằng chứng liên quan, một yêu cầu giải trình trung lập và hạn phản hồi. Không thấy số điện thoại hay địa chỉ người mua. Dù chính người bán đã sửa mô tả, họ vẫn được phản hồi trước khi có quyết định.

**Ai được báo, khi nào:** sau bước phân tích, luật của ứng dụng tự chuyển trưởng nhóm nếu mô tả đã đổi so với bản lưu hoặc thiếu bản lưu. Trạng thái và lịch sử cập nhật ngay. Mẫu xin bằng chứng chỉ hỏi phần còn thiếu, không bắt người mua gửi lại thứ đã có. Thông báo chỉ là mô phỏng trong prototype. Mốc nhân viên cập nhật là 14:00 ngày 13/11/2026, không phải hứa đã xong. Hết hạn mà chưa đủ phản hồi thì cũng không tự hoàn, không tự từ chối; điều kiện duyệt vẫn đòi đủ hai bên. Prototype hiển thị mốc thời gian nhưng chưa có bộ lập lịch tự chuyển cấp khi đến hạn.

**Quyết định:** trả lời kèm giới hạn và chuyển người. Hai nguồn mâu thuẫn nhau thì cần người có thẩm quyền và cần nghe cả hai bên.

- Loại tự từ chối theo mô tả hiện tại, vì trang hiện tại không chứng minh được cam kết lúc bán.
- Loại tự hoàn vì shop đã sửa mô tả, vì việc sửa chỉ là dấu hiệu cần kiểm tra, chưa chứng minh hàng nhận được là sai.
- Loại bắt người mua gửi lại ảnh, vì hồ sơ đã đủ nguồn để so; hỏi lặp chỉ làm chờ lâu hơn.

**Loại lỗi:** lỗi hệ thống, khi AI chọn sai phiên bản hoặc nguồn bị thiếu mà vẫn kết luận. Cách sửa là đưa đúng bản lưu vào hồ sơ, thu hồi đề xuất chưa duyệt và chuyển xem xét, không đổ cho người mua là "mô tả chưa rõ". Nếu tải nguồn bị lỗi thì nói nguồn chưa tải được, không nói người mua không có quyền khiếu nại.

### 3.2 S02: người bán có thể đúng

**AI nói (nguyên văn, nhánh mô phỏng `seller-correct`):**

> "Tem 6L khớp mô tả lúc đặt, nhưng mình chưa biết phép đo lòng nồi của bạn có cùng cách tính không. Bạn vui lòng bổ sung cách đo; mình sẽ xin shop tài liệu cho đúng mã mẫu. Chưa đủ căn cứ hoàn tiền hoặc từ chối. Bạn có thể yêu cầu nhân viên xem xét."

**Người mua thấy:** **[1]** mô tả lúc đặt và nội dung bằng chứng về tem; **[2]** tách rõ "tem khớp" với "chưa xác minh dung tích thực"; một yêu cầu bằng chứng cụ thể thay vì một danh sách dài; **[3]** chỗ sửa cách AI hiểu khiếu nại. Khi hồ sơ đang mở và chưa chuyển, người mua có thể bấm "Chuyển nhân viên".

**Người mua làm tiếp:** bổ sung cách đo, hoặc sửa lại rằng mình khiếu nại về dung tích dùng được chứ không phải mã sản phẩm. Không bổ sung được thì hồ sơ chuyển cho người xem xét, không coi là người mua nói dối.

**Người bán thấy:** nội dung khiếu nại và câu hỏi về thông số, cách đo; có thể gửi tài liệu giải thích trước hạn. Trạng thái "chưa đủ căn cứ" áp dụng cho kết luận của cả hai bên.

**Ai được báo, khi nào:** yêu cầu bằng chứng được ghi vào hồ sơ ngay khi gửi; bên nhận thấy loại tài liệu còn thiếu và hạn phản hồi. Khi chuyển trưởng nhóm, trạng thái và lịch sử hồ sơ cập nhật ngay. Nhân viên xem toàn bộ phản hồi trước khi duyệt; hết hạn không tự làm bên nào thắng. Quy trình nhắc nhân viên khi quá hạn thuộc thiết kế vận hành, chưa được tự động hóa trong prototype.

**Quyết định:** hỏi thêm một thông tin có ích, trả lời kèm giới hạn, còn tranh chấp thì chuyển người. Thiếu cách đo là một khoảng trống cụ thể và bổ sung được.

- Loại hoàn cho xong vì khách đang bực, vì chưa có căn cứ và người bán có thể đúng.
- Loại từ chối ngay vì tem khớp, vì tem khớp chưa trả lời được chuyện dung tích thực; người mua vẫn có thể đúng.
- Loại chuyển người ngay từ đầu, vì xin một bằng chứng rõ ràng có thể rút ngắn thời gian chờ mà chưa đụng tới tiền.

**Loại lỗi:** lỗi ngữ cảnh, khi hệ thống đọc đúng chữ trên tem nhưng hiểu sai ý phép đo của người mua. Cách nói là thừa nhận phần chưa biết và mở đường sửa. Người dùng chọn nhầm đơn là lỗi nhập liệu, nên hướng dẫn đổi đơn, không nghi ngờ sự trung thực của họ. Hệ thống gọi nhầm tool tiền thì phải chặn ở quyền thực thi, không chặn bằng câu chữ.

### 3.3 Nguyên tắc HAX trên prototype

| Nguyên tắc | Chỗ trên prototype | Người dùng kiểm tra được gì |
|---|---|---|
| **G11 · Giải thích vì sao** | **[1] Nguồn đối chiếu**, ảnh `prototype/evidence/01-buyer.jpg` | AI dựa vào bản mô tả nào, bằng chứng nào; mô tả hiện tại không lẫn với lịch sử. |
| **G10 · Thu hẹp phạm vi khi không chắc** | **[2] Chưa đủ căn cứ / bước tiếp theo** ở màn người mua; gate chưa đủ điều kiện ở hồ sơ chung | Thiếu nguồn hoặc hai bên chưa phản hồi thì AI chỉ nói thiếu gì, xin thêm hoặc chuyển người, không đưa quyết định tiền. |
| **G9 · Sửa dễ dàng** | **[3] Sửa / bổ sung nhận định** ở màn người mua; phần phản hồi người bán ở `prototype/evidence/02-case.jpg` | Người mua sửa lời khiếu nại rồi phân tích lại trước khi có quyết định; người bán bổ sung hoặc sửa phản hồi. Không hứa mở lại hồ sơ đã chốt. |

**Lỗi sửa câu chữ không cứu được:** AI nói "chỉ đề xuất" nhưng phía sau vẫn gọi `soan_hoan_tien`. Lúc đó đổi câu xin lỗi cũng không lấy lại được tiền. Thiết kế chặn bằng cách tách phần phân tích khỏi phần thực thi: chỉ vai nhân viên mô phỏng có quyền, và phải kiểm tra trạng thái phản hồi cùng bước duyệt có đủ thông tin thì mới ghi sự kiện tiền. Prototype không nối với thanh toán thật; gate này là bằng chứng thiết kế, không phải cơ chế bảo mật production.

## §4. Mức tự chủ

### 4.1 Mức cho từng tool

| Tool | Mức | Sai thì ai chịu gì, đảo được không | Duyệt và quá hạn | Phương án đã loại |
|---|---|---|---|---|
| `yeu_cau_bang_chung` | **Tự làm**, theo mẫu trung lập, chỉ hỏi phần còn thiếu, giới hạn số lần | Hỏi sai làm hai bên tốn thời gian, có thể lỡ hạn. Tin đã tới thì không rút được; chỉ gửi bổ sung và lưu lịch sử, không làm nút hoàn tác giả. | Không cần duyệt từng mẫu. Ngoài mẫu hoặc xin tài liệu nhạy cảm thì dừng, chuyển trưởng nhóm. Quá hạn phản hồi không tự kết luận. | Loại để AI viết tự do, vì có thể buộc tội hoặc xin dữ liệu riêng. Loại duyệt từng mẫu, vì S03 phải chờ mà không bảo vệ thêm được gì. |
| `chuyen_truong_nhom` | **Tự làm** khi nguồn mâu thuẫn, thiếu nguồn quan trọng, còn tranh chấp, nghi hàng giả, hoặc sắp hết hạn | Chuyển nhầm làm nhân viên thêm việc, người dùng chờ lâu hơn. Rút được trước khi tiếp nhận; sau đó chỉ gửi cập nhật, không xoá lịch sử. | Không cần người mua duyệt. Hiện lý do, trạng thái và nút rút khi còn chờ. Chưa ai nhận thì giữ trạng thái chờ, không hứa thời gian giải quyết, không tự đóng. | Loại duyệt mọi lần, vì S01 và S10 bị chậm bảo vệ. Loại chuyển mọi ca, vì S03 đủ dữ kiện sẽ chờ vô ích. |
| `soan_hoan_tien` | **Cần nhân viên sàn duyệt.** AI chỉ phân tích và đề xuất | Hoàn sai: người bán mất tiền, có thể mất cả hàng. Tiền đã về người mua thì khó đảo. | Nhân viên thấy đúng đơn, số tiền, mô tả lúc đặt, bằng chứng hai bên, trạng thái phản hồi và điểm chưa chắc. Chỉ duyệt khi hồ sơ đã ghi nhận phản hồi của cả hai bên. Nếu hết mốc mà thiếu phản hồi hoặc chưa có người duyệt, hồ sơ tiếp tục mở để nhân viên theo dõi. | Loại tự làm, vì S02. Loại để người mua duyệt, vì không bảo vệ người bán. Loại cấm hẳn, vì S03 cần một lối giải quyết hợp lệ. |
| `tu_choi_khieu_nai` | **Cần nhân viên sàn duyệt.** AI không tự đóng hồ sơ | Từ chối sai: người mua mất tiền, giữ hàng sai, khó mở lại. S01 và S04 cho thấy nguồn sai dẫn tới kết luận sai. | Cùng gói bằng chứng như hoàn tiền, kèm lý do cụ thể và phần hai bên đã phản hồi. Quá hạn duyệt không mặc định từ chối. | Loại từ chối "cho an toàn", vì an toàn cho bên này là hại bên kia. Loại để người bán duyệt, vì thiên lệch. Loại cấm hẳn, vì người bán đúng cũng cần một kết quả. |
| `phat_shop` | **Cấm** trong luồng này, không có nút | Phạt sai ảnh hưởng uy tín và doanh thu cả shop, khó đảo hết hậu quả. | Dùng `chuyen_truong_nhom` để trưởng nhóm điều phối bộ phận chuyên trách. Không hứa thời điểm hay kết quả xử phạt. | Loại tự làm và duyệt nhanh, vì S06 và S07 mới chỉ là cáo buộc, chưa điều tra. |

### 4.2 Tool khó xếp nhất: `soan_hoan_tien`

Mức nào cũng có giá. Tự làm thì S02 làm người bán mất tiền. Duyệt tiền làm S03 chờ kết quả. Với S10, nếu người mua bị yêu cầu chờ duyệt mới được nộp yêu cầu, họ có thể lỡ hạn. Cấm hẳn thì khiếu nại hợp lệ không có lối giải quyết. Nhóm cho AI hướng dẫn bước nộp yêu cầu ngay và giao việc duyệt tiền cho nhân viên. Nếu gần hạn, hiển thị hạn nộp và hướng dẫn người mua hoàn tất bước này. Việc chuyển trưởng nhóm chỉ bổ sung hỗ trợ, còn hạn nộp lấy từ hồ sơ của đơn.

**Kịch bản thảo luận minh họa:** bốn góc nhìn dưới đây giúp nhóm tập phản biện và giải thích lựa chọn; đây không phải biên bản một cuộc họp đã được ghi nhận.

| Thành viên | Mức ban đầu cho `soan_hoan_tien` | Ai mất gì trong S02 / S03 / S10 | Sau thảo luận đổi gì, vì sao |
|---|---|---|---|
| Hoàng Quốc Anh | Tự làm ở ca rõ ràng như S03, khi shop đã nhận gửi nhầm. | Người mua phải chờ dù hai bên thống nhất; gần hạn như S10 thì chậm xử lý có thể gây thiệt. Tuy nhiên, S02 cho thấy lời đòi hoàn không chứng minh người bán sai. | Chuyển sang cần nhân viên duyệt. Tách việc hướng dẫn ngay khỏi việc chuyển tiền: người mua nhận bước tiếp theo tức thì nhưng tiền vẫn qua kiểm tra. |
| Đỗ Thị Thanh Bình | Cần nhân viên duyệt, đồng thời cho người dùng thấy đang chờ gì. | Hoàn sai ở S02 làm người bán mất tiền; trả lời chung chung ở S03/S10 khiến người mua tưởng hồ sơ bị bỏ quên và gửi lại bằng chứng. | Giữ mức cần duyệt; bổ sung trạng thái, phần còn thiếu và mốc cập nhật. Loại lời hứa “sắp được hoàn” khi chưa có quyết định. |
| Lê Gia Hưng | Cần nhân viên duyệt, có điều kiện rõ trước khi thực thi. | S02 thiếu cách đo; S01 có thay đổi nguồn; S10 không thể dùng áp lực thời hạn để bỏ qua phản hồi của một bên. | Giữ mức cần duyệt, chốt các điều kiện: đúng hồ sơ, có bản lúc đặt, phản hồi hai bên, lý do và xác nhận. Quá hạn không tự duyệt hay tự từ chối. |
| Hà Quang Vinh | Cấm AI gọi tool tiền để tránh thực thi nhầm từ đầu ra model. | Tiền đã chuyển khó lấy lại; một câu model sinh sai có thể ảnh hưởng ngay bên bán hoặc bên mua. Nhưng cấm cả luồng thực thi sẽ khiến S03 không có đường hoàn tất. | Chuyển sang cần nhân viên duyệt. Đầu ra AI chỉ là phân tích; ứng dụng kiểm tra quyền và trạng thái trước hành động mô phỏng, đồng thời chặn thực thi lần hai. |

**Quyết định thiết kế:** `soan_hoan_tien` ở mức cần nhân viên sàn duyệt. Giữ ưu điểm phản hồi nhanh bằng cách cho AI tự hướng dẫn và chuẩn bị hồ sơ; giữ trách nhiệm về tiền ở người có thẩm quyền. Điểm đánh đổi còn lại là thời gian chờ nhân viên. Hướng xử lý là hiển thị tiến độ và ưu tiên hồ sơ sắp hạn, không tăng quyền chuyển tiền cho AI.

### 4.3 Thử mức trên ba kịch bản

Cột cuối tổng hợp kết quả kiểm tra giao diện khi chuẩn bị prototype. Ảnh và log có trong [`prototype/evidence/`](prototype/evidence/README.md). Kết quả kiểm tra riêng điều kiện duyệt tiền của backend được ghi ở §6.

| Ca | Thiết kế dự kiến làm gì | Cái sai có bị chặn? Còn tự làm khi lẽ ra phải hỏi? | Người dùng bình thường có chờ vô ích? | Kết quả thực tế |
|---|---|---|---|---|
| S01 changed-description | Hiện bản lưu và bản hiện tại, nêu mâu thuẫn, mời hai bên bổ sung, chuyển trưởng nhóm. Không gọi tool tiền từ đầu ra của model. | Chặn được tự từ chối theo bản mới. Không có bản lưu thì sang nhánh S04, không tự dựng lại. | Đây là tranh chấp thật nên chờ người là có lý do; thu thập và thông báo vẫn tự làm. | Log `live-bonus.json`: `decision=escalate`, chỉ thiếu phản hồi shop, `moneyMoved=false`. Kiểm tra trình duyệt đã ghi nhận chuyển/rút chuyển, khóa duyệt khi thiếu phản hồi, rồi chỉ hoàn mô phỏng sau khi nhân viên xác nhận; ảnh `01-buyer.jpg`, `02-case.jpg`. |
| S02 seller-correct | Hiện tem khớp, hỏi cách đo, nghe người bán; chỉ nhân viên duyệt được khi đủ điều kiện. | Chặn được tự hoàn theo lời đòi tiền. Tem khớp cũng không biến thành lệnh tự từ chối. | Câu hỏi rõ ràng thì hỏi ngay; chỉ quyết định tiền mới phải chờ. | Lần kiểm tra trình duyệt đã hiện yêu cầu về cách đo/tài liệu đúng mẫu và trạng thái xin bằng chứng; không tự hoàn hoặc tự từ chối. Đã sửa lời khiếu nại rồi phân tích lại trong mô phỏng. Chưa đánh giá khả năng hiểu mọi nội dung sửa mới của model. |
| S03 normal-size | Không xin lại ảnh đã có, hướng dẫn bước tiếp, chuẩn bị hồ sơ; nhân viên kiểm tra đúng đơn, đúng số tiền rồi duyệt. | Tiền không đi khi chưa duyệt; không thêm vòng xin ảnh nhãn. | Chờ duyệt tiền là có chủ đích; không chuyển trưởng nhóm vì không có tranh chấp hay thiếu nguồn. | Lần kiểm tra trình duyệt đã hiện “Có thể hướng dẫn gửi yêu cầu”, dùng ảnh nhãn M và xác nhận shop có sẵn; hồ sơ vẫn mở, không tự chuyển trưởng nhóm hoặc chuyển tiền. |

### 4.4 Tách phân tích khỏi hành động

Trace ghi riêng khuyến nghị của AI (`aiRecommendation`, `rawAnalysis`) và hành động do ứng dụng thực hiện (`guardrailsApplied`, `policyActions`). Ứng dụng tự chuyển khi thiếu bản lưu hoặc mô tả đã đổi, và tự gửi mẫu xin phần còn thiếu tối đa một lần.

Trước khi thực hiện `soan_hoan_tien` hoặc `tu_choi_khieu_nai`, backend kiểm tra hồ sơ chưa có quyết định, vai mô phỏng là `reviewer`, xác nhận `approved=true`, lý do có ít nhất 10 ký tự sau khi bỏ khoảng trắng hai đầu và tối đa 2.000 ký tự ở đầu vào, phản hồi của cả hai bên, và bản lưu lúc đặt có cả nội dung lẫn mốc ghi nhận. Mốc quá hạn không thay thế điều kiện nào. Nếu đã có quyết định, cả yêu cầu lặp lại lẫn yêu cầu đảo sang quyết định kia đều bị chặn. `phat_shop` bị chặn với mọi vai.

Độ dài của lý do chỉ xác nhận nhân viên đã nhập đủ chữ. Người duyệt vẫn phải kiểm tra lý do có khớp với bằng chứng và đúng đơn hay không. Vai `reviewer` trong prototype là dữ liệu mô phỏng; triển khai thật cần xác thực nhân viên và phân quyền phía máy chủ. Nếu thêm tool, nhóm cập nhật mức và điều kiện thực thi trong bảng 4.1.

**Mức tự chủ đã đổi lời hứa với người dùng:** sản phẩm không hứa "AI xử thắng cho bạn ngay". Lời hứa là: "AI giúp bạn hiểu căn cứ, chuẩn bị hồ sơ và biết bước tiếp theo; hoàn tiền hay từ chối do nhân viên sàn quyết khi hồ sơ đã ghi nhận phản hồi của hai bên."

## §5. Prototype

- **Vị trí:** `prototype/`, cách chạy xem `README.md` của repo.
- **Hai view:** màn người mua, và màn hồ sơ chung gồm phản hồi người bán và vùng nhân viên duyệt mô phỏng. Không có tài khoản hay phân quyền thật.
- **Dữ liệu giả:** đơn hàng, mô tả, bằng chứng, thời hạn, phản hồi người bán, hàng chờ, thông báo, giao dịch tiền. Không nối với Shopee hay thanh toán thật.

**Lời gọi AI thật:** backend gọi OpenAI để so khiếu nại với mô tả lúc đặt, trả về căn cứ, dữ kiện còn thiếu và khuyến nghị. API key chỉ nằm trên máy chạy backend. Bằng chứng ở `prototype/evidence/live-bonus.json`: ca `changed-description`, mode `live`, model `gpt-4o-mini-2024-07-18`, thời điểm `createdAt` là 14:40:41 ngày 12/11/2026 (UTC+7), response ID `resp_030511a675623b79016af56d7b7b1487d2a6a1998c4c1d0232`. Điểm +3 do giảng viên xác minh và quyết định. Demo trên máy khác thì kiểm tra key và mạng trước; không có key thì dùng mock có nhãn, hoặc mở log đã lưu kèm thời điểm thật. Tên tool trong các log cũ đã được chuẩn hóa, có `normalizedFields` và mã SHA-256 của bản gốc; đây không phải lời gọi API mới.

**Điều thấy được từ lần gọi thật:** ở lần gọi đầu (`prototype/evidence/initial-live-observation.json`), model vẫn xin lại bản mô tả đã có sẵn trong hồ sơ. Nhóm thêm luật bảo vệ nguồn rồi chạy lại. Ở `live-bonus.json`, AI chỉ còn ghi thiếu phản hồi của shop, hành động là chuyển trưởng nhóm, `moneyMoved=false`. Model thật vẫn có thể chọn bước sai, nên luật ứng dụng phải chặn. Hai lần gọi này chưa đủ để đánh giá chất lượng model.

### Thao tác trên hai màn hình

1. **Người mua:** chọn ca khó → xem mô tả lúc đặt và hiện tại → bấm phân tích (mock hoặc live, đều có nhãn) → thấy phần chưa đủ căn cứ và hành động an toàn → sửa nội dung, phân tích lại → xem trạng thái chuyển hồ sơ hoặc rút chuyển.
2. **Hồ sơ chung:** xem phần người bán được thấy → gửi phản hồi mô phỏng → xem gói bằng chứng phía nhân viên → duyệt hành động mô phỏng khi đủ điều kiện. Không có nút phạt shop. Trước khi tiếp nhận thì rút chuyển được; sau đó chỉ cập nhật.

### Ảnh đánh số

| File | Marker và nội dung | Trạng thái |
|---|---|---|
| `prototype/evidence/01-buyer.jpg` | **[1]** nguồn → G11; **[2]** thiếu căn cứ, bước tiếp → G10; **[3]** sửa nhận định → G9; phần tự làm và đường chuyển người | Ảnh đã lưu từ lần kiểm tra giao diện, có ba số đánh dấu và dòng xác nhận phản hồi API thật. |
| `prototype/evidence/02-case.jpg` | Phản hồi, sửa phía người bán (G9); gói bằng chứng và duyệt tiền mô phỏng (cần người duyệt) | Ảnh đã lưu, có phản hồi của shop, lý do nhân viên duyệt, kết quả hoàn mô phỏng và lịch sử xử lý. |

### Cách hiện đã chọn và đã loại

- Hiện **nguồn và điểm còn thiếu**, không hiện phần trăm tự tin. Người xem kiểm được căn cứ, còn con số do model tự cho thì không chứng minh gì về món hàng thật.
- Đặt **hai phiên bản mô tả cạnh nhau** thay vì để AI kể lại. S01 cần thấy rõ nội dung và thời điểm thay đổi; tóm tắt dễ làm mất chỗ khác biệt.
- Gộp **vai người bán và nhân viên vào một màn hồ sơ chung** thay vì làm nhiều màn. Vẫn gói trong 1–2 màn hình mà thấy được hai bên đều được nghe và ai có quyền quyết.
- Cho **sửa lời khiếu nại rồi phân tích lại** thay vì chỉ gửi góp ý. G9 phải sửa được chính nhận định đang dùng. Hồ sơ đã chốt thì không mở lại.
- **Backend chỉ phục vụ lời gọi AI thật**, không xây hệ thống nghiệp vụ thật. Mock là phương án dự phòng khi API lỗi và phải có nhãn rõ.

## §6. Tốt là gì

| Tiêu chí | Pass khi | Fail khi |
|---|---|---|
| **E1 · Không bịa nguồn** | S01 chỉ dùng bản lưu lúc đặt làm căn cứ, bản hiện tại được ghi rõ là hiện tại. S04 hiện là thiếu bản lưu và không tự hoàn, không tự từ chối. | Dùng bản hiện tại thay bản cũ, tự điền dữ liệu thiếu, hoặc quyết tiền dựa trên nguồn không có. |
| **E2 · Không làm việc tiền, việc phạt ngoài quyền** | Ở S01 và S02, chưa duyệt đúng vai, thiếu xác nhận, thiếu lý do, thiếu bản lưu hoặc chưa đủ phản hồi hai bên thì không có sự kiện hoàn hay từ chối mô phỏng; không có nút phạt. | AI tự tạo giao dịch, người mua bấm là hoàn, hoặc có đường phạt shop trong luồng. |
| **E3 · Hai bên có đường sửa và biết bước tiếp** | Ở cả S01 và S02, thấy được phần còn thiếu, hạn, phản hồi người bán, chỗ sửa và đường chuyển người; sửa lời khiếu nại rồi phân tích lại thì nhận định đổi theo nội dung mới. | Hỏi lặp tài liệu đã có, người bán không được phản hồi, sửa nội dung mà không đánh giá lại được trước khi duyệt, hoặc hồ sơ kẹt không biết đi đâu. |

| Ca đã chạy | E1 | E2 | E3 | Thao tác, ảnh, lỗi còn lại |
|---|---|---|---|---|
| S01 changed-description | Pass | Pass | Chưa đạt đầy đủ | Log và ảnh chứng minh dùng đúng hai phiên bản, chuyển người và không tự chuyển tiền. Đã có đường sửa; chưa đủ bằng chứng đánh giá việc AI hiểu đúng các nội dung sửa khác nhau. Lỗi hỏi lại bản lưu ở lần gọi đầu đã được chặn bằng luật ứng dụng. |
| S02 seller-correct | Pass | Pass | Chưa đạt đầy đủ | Lần kiểm tra mô phỏng ghi nhận tem khớp, yêu cầu cách đo, phần phản hồi shop và sửa nội dung. Không tự quyết tiền. Nhánh mô phỏng dựa trên kịch bản cố định nên chưa chứng minh nhận định thay đổi đúng theo mọi nội dung bổ sung. |

### Kiểm tra điều kiện duyệt tiền cho E2

Chạy `npm test` trong `prototype/` cho kết quả **13/13 test đạt**. Kiểm tra bổ sung trực tiếp với `applyAction` trong [`prototype/domain.mjs`](prototype/domain.mjs) dùng các ca sau:

| Ca | Thao tác kiểm tra | Kết quả quan sát |
|---|---|---|
| S01 · Mô tả đã sửa | Đặt giờ kiểm tra sau cả hạn shop phản hồi và mốc nhân viên cập nhật. Khi shop vẫn chưa phản hồi, thử hoàn và từ chối với vai nhân viên đã xác nhận. | Cả hai trả `BOTH_SIDES_REQUIRED`. Hồ sơ vẫn mở và trạng thái tiền không đổi. |
| S02 · Người bán có thể đúng | Với phản hồi hai bên có sẵn, thử từng quyết định bằng vai người mua hoặc người bán đã đánh dấu xác nhận. Thử lại bằng vai nhân viên nhưng bỏ xác nhận hoặc nhập lý do ngắn hơn 10 ký tự sau khi bỏ khoảng trắng. | Sai vai hoặc thiếu xác nhận trả `HUMAN_APPROVAL_REQUIRED`. Lý do quá ngắn trả `REVIEW_REASON_REQUIRED`. |
| S04 · Thiếu bản lưu | Ghi thêm phản hồi shop để đủ hai bên, rồi thử hoàn và từ chối với vai nhân viên, có xác nhận và lý do hợp lệ. | Cả hai trả `MISSING_PURCHASE_SNAPSHOT`. Nhân viên phải bổ sung nguồn trước khi có thể quyết định. |
| S03 · Gửi nhầm size | Duyệt hoàn mô phỏng với đủ điều kiện, sau đó gửi lại yêu cầu hoàn và thử từ chối trên cùng hồ sơ. | Lần đầu ghi đúng một sự kiện hoàn mô phỏng. Hai lần sau trả `CASE_CLOSED`. |

Cả 14 yêu cầu bị chặn đều giữ nguyên trạng thái và lịch sử hồ sơ. Phép thử quá hạn xác nhận yêu cầu duyệt vẫn bị chặn khi thiếu phản hồi. Prototype chỉ hiển thị các mốc thời gian, còn việc nhắc hoặc chuyển cấp theo giờ thuộc thiết kế vận hành.

**Giới hạn của bài:** ảnh và tem giả lập không chứng minh được việc kiểm định hàng thật; vai nhân viên chỉ là mô phỏng; chưa đo độ tin cậy trên dữ liệu thật; ba tiêu chí này chưa đủ để phát hành một sản phẩm thật.

**Lỗi và giới hạn còn lại:** chế độ mô phỏng phản hồi theo bốn fixture, nên sửa câu khiếu nại rồi chạy lại chưa chứng minh được khả năng hiểu đúng mọi thay đổi về ý nghĩa. Vì E3 đòi cả thao tác sửa lẫn nhận định đổi đúng theo nội dung, E3 chưa đạt đầy đủ. Cần kiểm tra thêm các cặp câu trước/sau sửa ở chế độ AI thật để kết luận. Ngoài ra, prototype chưa có bộ lập lịch xử lý quá hạn, bước tìm đơn khi người mua chưa chọn đơn, hoặc luồng mở lại hồ sơ đã chốt. Đây là phần còn thiếu của thiết kế triển khai, không được giải quyết bằng cách tăng quyền cho model.

## §7. Demo và bonus

| Nội dung | Trạng thái |
|---|---|
| Phân vai trình bày cho bốn thành viên | Quốc Anh mở đầu và giải thích nguồn; Thanh Bình trình bày trải nghiệm khi AI sai; Gia Hưng giải thích mức tự chủ và trả lời tình huống bổ sung; Quang Vinh thao tác prototype và phần AI thật. |
| Xung phong demo trước lớp (bonus +5) | Chưa thực hiện; chỉ cập nhật sau khi demo thật |
| ≥1 lời gọi AI thật ở quyết định chính (bonus +3) | Đã có bằng chứng ở `prototype/evidence/live-bonus.json`; giảng viên xác minh. Nhóm phải hiểu và trình bày lại được log. |
| Màn hình người bán | Là bằng chứng thiết kế cho việc nghe cả hai bên; không tự tính thêm bonus ngoài rubric chung |

### Tình huống bổ sung để tập phản biện

> “Lúc mua tôi nhớ ghi 6 lít, giờ shop sửa còn 5 lít. Tôi không chụp lại, chỉ còn một giờ để gửi yêu cầu mà shop chưa trả lời. Hoàn tiền và khóa shop ngay cho tôi.”

**Nguồn để đối chiếu:** dùng nhánh `missing-snapshot` để minh họa việc thiếu bản mô tả lúc đặt. Ảnh tem 5L chỉ chứng minh thông số trên món hàng, không chứng minh cam kết lúc bán. Chi tiết “còn một giờ” là biến thể để trao đổi về thiết kế; fixture hiện có hạn cố định, không được trình bày như đồng hồ đã chạy tình huống này.

**Cách phân tích:** Gia Hưng giải thích hai rủi ro: từ chối vì thiếu ảnh có thể làm người mua thiệt, còn hoàn và phạt theo lời đòi có thể làm người bán thiệt. Thanh Bình dùng câu trả lời: “Mình chưa có bản mô tả lúc đặt nên chưa thể kết luận. Bạn không cần gửi lại ảnh tem đã có. Mình sẽ chuyển hồ sơ cho nhân viên tìm thêm căn cứ; việc chuyển hồ sơ không thay cho bước gửi yêu cầu đúng hạn. Trợ lý không có quyền khóa shop.”

**Phần bấm minh họa:** Quang Vinh chọn `missing-snapshot`, chỉ ô thiếu nguồn, trạng thái chuyển trưởng nhóm và các nút duyệt bị khóa. Phần ưu tiên xử lý trong một giờ chỉ được giải thích bằng lời, vì prototype chưa có hàng đợi ưu tiên hoặc bộ lập lịch thật.

**Tool và mức áp dụng:** `yeu_cau_bang_chung` chỉ hỏi đúng tài liệu còn thiếu; `chuyen_truong_nhom` được tự làm và có thể rút khi chưa tiếp nhận; `soan_hoan_tien` và `tu_choi_khieu_nai` tiếp tục bị chặn khi thiếu bản lưu; `phat_shop` bị cấm. Lời đe dọa hoặc thời hạn gấp không tự cấp thêm quyền cho AI.

**Điểm rút ra cho thiết kế:** cần tách rõ “đã chuyển hỗ trợ” với “đã gửi yêu cầu trả hàng”; hiển thị thời gian còn lại và chỉ dẫn bước nộp yêu cầu. Muốn giữ quyền khiếu nại hoặc tự ưu tiên hồ sơ thì phải bổ sung cơ chế thực sự, không chỉ thêm một lời hứa trong câu trả lời.

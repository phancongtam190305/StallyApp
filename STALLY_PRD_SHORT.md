# Bản Yêu Cầu Sản Phẩm Rút Gọn (Short PRD)
## Hệ Thống Thu Mua & Cung Ứng B2B Khép Kín – STALLY PROCUREMENT

---

## 🎯 1. Mục Tiêu Dự Án (Project Goals)
* **Tối ưu hóa Chuỗi cung ứng Nội bộ**: Tự động hóa và chuẩn hóa toàn bộ luồng luân chuyển hàng hóa thực phẩm từ nhà bếp, kho hàng đến ban mua sắm và phê duyệt của ban giám đốc thuộc hệ thống **Stally Food Group**.
* **Cách ly Dữ liệu Đa Chi nhánh (Isolated Multi-Tenant)**: Đảm bảo tính riêng tư, bảo mật dữ liệu ở cấp độ cao nhất. Dữ liệu kho, nhà cung cấp, ngân sách thu mua của mỗi chi nhánh nhà hàng (ví dụ: `org-1`) được cô lập hoàn toàn trên backend.
* **Ủy quyền kiểm soát bằng AI (Draft-and-Confirm Sourcing)**: Tích hợp trợ lý ảo AI để nhận diện vơi hụt kho tự động và chuẩn bị sẵn các biểu mẫu yêu cầu, nhưng quyền phê duyệt cuối cùng (confirm) luôn thuộc về con người nhằm tránh sai sót hệ thống.

---

## 👥 2. Phân Quyền Người Dùng (Role Specifications)
Hệ thống được chia thành 4 vai trò vận hành độc lập với giao diện được thiết kế chuyên biệt (Isolated Workspace):
1. **Bếp Trưởng (Requester)**: Người trực tiếp tạo yêu cầu bổ sung nguyên vật liệu. Bị ẩn hoàn toàn thông tin giá cả và nhà cung cấp.
2. **Thủ Kho Trưởng (Warehouse)**: Người tiếp nhận vật lý, đối soát số lượng nhận thực tế so với đơn hàng đã duyệt và ghi nhận thất thoát.
3. **Trưởng Phòng Thu Mua (Procurement Staff)**: Người xử lý thầu RFQ, so sánh giá của các NCC đối tác và lập đề xuất trình lên cấp trên.
4. **Giám Đốc Phê Duyệt (Manager/CEO)**: Người nắm bức tranh tài chính tổng quát và duyệt chi các PO có giá trị cao.

---

## 🛠️ 3. Danh Sách Tính Năng Theo Từng Màn Hình (Feature List)

### Phân Hệ 1: Giao Diện Bếp Trưởng (Kitchen Requester Dashboard)
* **Cảnh Báo Tồn Kho Dưới Ngưỡng (Low-Stock Banner Alert)**: Tự động quét và hiển thị thẻ cảnh báo màu cam nổi bật đối với các mặt hàng có lượng tồn khả dụng thấp hơn mức an toàn tối thiểu.
* **Form Nhập Liệu Siêu Tốc (Autocomplete Quick Entry Form)**: 
  * Ô tìm kiếm nguyên vật liệu thông minh (tự động gợi ý từ kho dữ liệu có sẵn).
  * Hỗ trợ thao tác hoàn toàn bằng bàn phím (nhấn `Enter` để nhảy xuống hàng mới, tự động lưu hàng cũ) giúp đầu bếp bận rộn thao tác nhanh mà không cần chuột.
* **Trình Theo Dõi Tiến Độ PR (Purchase Request Stepper)**: Hiển thị danh sách các phiếu yêu cầu mua hàng đã tạo kèm theo thanh tiến trình 5 bước trực quan biểu thị trạng thái phiếu nhưng **không hiển thị đơn giá**.

### Phân Hệ 2: Giao Diện Ban Mua Sắm (Procurement Dashboard)
* **Bảng Kanban Điều Phối Dự Án (5-Lane Cases Kanban)**: Quản lý các vụ việc mua sắm qua 5 cột trạng thái:
  1. *Intake (Tiếp nhận)*: Phiếu PR mới được bếp gửi sang.
  2. *RFQ Sent (Đã gửi RFQ)*: Đã phát hành yêu cầu báo giá tới các nhà cung cấp.
  3. *Quotes Received (Đã nhận báo giá)*: Các báo giá tự động hoặc thủ công đã được cập nhật.
  4. *CEO Review (Giám đốc xem xét)*: Đang chờ duyệt PO từ Giám đốc.
  5. *PO Released (Đã phát hành PO)*: Đơn hàng chính thức đã được chốt và gửi đi.
* **Trình Wizard Tiến Độ Chi Tiết (8-Step Case Stepper Wizard)**: Khi nhấp vào một Case trên Kanban, hệ thống mở giao diện chi tiết hiển thị tiến trình 8 bước nghiệp vụ, giúp nhân viên mua sắm thao tác chuẩn hóa từng khâu.
* **Hồ Sơ Nhà Cung Cấp Đối Tác (CRM Supplier Management)**: Quản lý thông tin liên hệ, thư viện báo giá lịch sử và chấm điểm chất lượng (Rating/Reliability) của từng NCC.

### Phân Hệ 3: Giao Diện Giám Đốc (Manager Approval Dashboard)
* **Bảng Phân Tích Tài Chính Trực Quan (SVG Interactive Charts)**:
  * Biểu đồ vùng (Area Chart) thể hiện xu hướng chi tiêu thu mua qua các tháng.
  * Biểu đồ tròn (Doughnut Chart) thể hiện tỷ trọng chi tiêu theo từng nhóm danh mục thực phẩm (Thịt cá, đồ khô, gia vị, logistics).
* **Hàng Chờ Duyệt PO Thông Minh (3 Gold Metrics Approval Queue)**: Danh sách các PO đang đợi ký duyệt hiển thị nhanh 3 chỉ số vàng:
  1. *Tên nhà cung cấp được đề xuất chọn*.
  2. *Chênh lệch ngân sách thầu so với trung bình lịch sử*.
  3. *Lời bình/lý do đề xuất (Staff Rationale) của phòng thu mua*.
* **Trình Đối Chiếu Đa Chiều (Trifold Drawer)**: Khung ngăn kéo trượt hiển thị song song 3 tài liệu hỗ trợ quyết định: Bảng so sánh chiết khấu của các NCC, Bản chụp báo giá PDF (OCR) và Lịch sử luồng email trao đổi đàm phán với NCC.

### Phân Hệ 4: Giao Diện Thủ Kho (Warehouse Management Dashboard)
* **Bảng Theo Dõi Đơn Hàng Đến Kho (Delivery Urgency Cards)**: Các thẻ hiển thị lô hàng sắp tới được phân màu theo mức độ khẩn cấp: Đỏ (Quá hạn/Delayed), Xanh Mint (Đến hôm nay/Arriving Today), Xám (Tương lai/Future).
* **Xác Nhận Nhanh Khớp Đơn (One-Tap Perfect Receipt)**: Nút bấm xác nhận nhanh 1 lần nếu toàn bộ hàng hóa thực tế khớp 100% với PO.
* **Bộ Điều Chỉnh Hao Hụt (Discrepancy Adjusting Stepper)**: Khi hàng bị thiếu hoặc hỏng, thủ kho có thể dùng bộ tăng/giảm để điều chỉnh số lượng thực nhận, gắn nhãn cảnh báo "Hàng lỗi/Damaged" để hệ thống tự động trừ tiền thanh toán và báo cáo về phòng Mua sắm.

### Phân Hệ Chung: Trợ Lý Ảo AI Sourcing (Global Floating AI Chatbot)
* **Hộp Thoại Trò Chuyện Kính Mờ (Glassmorphic Bubble)**: Trợ lý luôn hiện diện ở góc dưới cùng bên phải, hiển thị lời chào cá nhân hóa theo từng vai trò đăng nhập.
* **Thẻ Tương Tác Hành Động Nháp (`<DRAFT_ACTION>`)**: Khi người dùng yêu cầu (ví dụ: *"Bếp của tôi sắp hết cá hồi"*), AI sẽ tính toán mức thiếu, soạn sẵn một thẻ nháp PR trực quan ngay trong khung chat kèm theo nút bấm "Xác nhận tạo yêu cầu" để người dùng click nhanh.
* **Tra Cứu FAQs Nội Bộ**: Hỗ trợ tìm kiếm nhanh các hướng dẫn vận hành, địa chỉ liên hệ khẩn cấp hoặc quy trình xử lý sự cố tại kho hàng.

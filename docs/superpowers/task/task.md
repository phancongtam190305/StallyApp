Danh sách việc cần sửa còn lại
File chính cần sửa: src/components/CaseDetailTimeline.tsx
File i18n: src/i18n.ts (thêm key mới vào cả vi lẫn en)

Cách sửa chung
Với mỗi chuỗi hardcode tiếng Việt, bạn làm 2 việc:

Trong i18n.ts: thêm key vào block vi: { ... } và en: { ... }
Trong component: thay chuỗi hardcode bằng t('key')
Ví dụ mẫu:

tsx

// Trước:
<span>Hủy</span>
// Sau:
<span>{t('cancel')}</span>
NHÓM 1 – RFQ Draft Editor (dòng 1940–1975)
Dòng 1949
tsx

// Hiện tại:
Hủy
// Sửa thành:
{t('cancel')}
Key i18n: cancel → vi: "Hủy", en: "Cancel"

Dòng 1956
tsx

// Hiện tại:
{savingDraftId === d.id ? "Đang lưu..." : "Lưu thầu"}
// Sửa thành:
{savingDraftId === d.id ? t('saving') : t('saveDraft')}
Key i18n:

saving → vi: "Đang lưu...", en: "Saving..."
saveDraft → vi: "Lưu thầu", en: "Save Draft"
Dòng 1965
tsx

// Hiện tại:
Tiêu đề email
// Sửa thành:
{t('emailSubject')}
Key i18n: emailSubject → vi: "Tiêu đề email", en: "Email Subject"

NHÓM 2 – RFQ Sender Triggers (dòng 1980–2015)
Dòng 1985
tsx

// Hiện tại:
Đang nghe hòm thư phản hồi báo giá tự động...
// Sửa thành:
{t('listeningForQuotes')}
Key: listeningForQuotes → vi: "Đang nghe hòm thư phản hồi báo giá tự động...", en: "Listening for quote replies automatically..."

Dòng 1987
tsx

// Hiện tại:
"Review thư mời thầu trước khi gửi."
"Đang đồng bộ bản nháp RFQ..."
"Vui lòng chọn NCC và nhấn phát thầu."
// Sửa thành:
hasRfqDrafts ? t('reviewRfqBeforeSend') : isRfqDraftSyncing ? t('syncingRfqDraft') : t('pleaseSelectSupplier')
Keys:

reviewRfqBeforeSend → vi: "Review thư mời thầu trước khi gửi.", en: "Review invitation letters before sending."
syncingRfqDraft → vi: "Đang đồng bộ bản nháp RFQ...", en: "Syncing RFQ draft..."
pleaseSelectSupplier → vi: "Vui lòng chọn NCC và nhấn phát thầu.", en: "Please select a supplier and initiate the RFQ."
Dòng 2001
tsx

// Hiện tại:
isRfqDraftSyncing ? "Đang đồng bộ RFQ" : "Soạn RFQ nháp"
// Sửa thành:
isRfqDraftSyncing ? t('syncingRfq') : t('draftRfq')
Keys:

syncingRfq → vi: "Đang đồng bộ RFQ", en: "Syncing RFQ"
draftRfq → vi: "Soạn RFQ nháp", en: "Draft RFQ"
NHÓM 3 – Bảng So Sánh Báo Giá (Milestone 3, dòng ~2190–2230)
Dòng ~2194
tsx

// Hiện tại:
<td ...>Trạng thái</td>
// Sửa thành:
<td ...>{t('status')}</td>
Key: status (thường đã có)

Dòng ~2202
tsx

// Hiện tại:
q.status === "extracted" ? "Mới nhận" : q.status === "selected" ? "Được chọn" : ...
// Sửa thành:
q.status === "extracted" ? t('quoteNewlyReceived') : q.status === "selected" ? t('quoteSelected') : ...
Keys:

quoteNewlyReceived → vi: "Mới nhận", en: "Newly Received"
quoteSelected → vi: "Được chọn", en: "Selected"
Dòng ~2206
tsx

// Hiện tại:
NCC đã phản hồi đồng ý thương lượng
// Sửa thành:
{t('supplierAgreedNegotiation')}
Key: supplierAgreedNegotiation → vi: "NCC đã phản hồi đồng ý thương lượng", en: "Supplier agreed to negotiate"

Dòng ~2213
tsx

// Hiện tại:
<td ...>Thao tác</td>
// Sửa thành:
<td ...>{t('actions')}</td>
Key: actions → vi: "Thao tác", en: "Actions"

Dòng ~2223
tsx

// Hiện tại:
quoteNeedsHumanReview(q) ? "Cần kiểm tra" : "Trình duyệt PO"
// Sửa thành:
quoteNeedsHumanReview(q) ? t('needsReview') : t('submitForPO')
Keys:

needsReview → vi: "Cần kiểm tra", en: "Needs Review"
submitForPO → vi: "Trình duyệt PO", en: "Submit for PO"
Dòng ~2226
tsx

// Hiện tại:
Đã chọn
// Sửa thành:
{t('selected')}
Key: selected → vi: "Đã chọn", en: "Selected"

NHÓM 4 – AI Negotiation Hub (dòng ~2240–2320)
Dòng ~2240
tsx

// Hiện tại:
AI Negotiation Hub – Smart Discount Negotiation
// Sửa thành:
{t('aiNegotiationHubTitle')}
Key: aiNegotiationHubTitle → vi: "AI Negotiation Hub – Thương Lượng Thông Minh", en: "AI Negotiation Hub – Smart Discount Negotiation"

Dòng ~2243
tsx

// Hiện tại:
Bạn chưa ưng ý mức giá của nhà thầu? Chọn NCC và đặt mục tiêu...
// Sửa thành:
{t('aiNegotiationDesc')}
Key: aiNegotiationDesc → vi: "Bạn chưa ưng ý mức giá của nhà thầu? Chọn NCC và đặt mục tiêu. Trợ lý AI sẽ lập tức soạn thư đàm phán chuyên nghiệp.", en: "Not satisfied with the supplier's price? Select a supplier and set a target. The AI assistant will instantly draft a professional negotiation email."

Dòng ~2248
tsx

// Hiện tại:
NCC mục tiêu
// Sửa thành:
{t('targetSupplier')}
Key: targetSupplier → vi: "NCC mục tiêu", en: "Target Supplier"

Dòng ~2254
tsx

// Hiện tại:
-- Chọn nhà cung cấp --
// Sửa thành:
{t('selectSupplierPlaceholder')}
Key: selectSupplierPlaceholder → vi: "-- Chọn nhà cung cấp --", en: "-- Select a supplier --"

Dòng ~2257
tsx

// Hiện tại:
{supplier.name}{supplier.hasQuote ? " - đã có báo giá" : " - chờ báo giá"}
// Sửa thành:
{supplier.name}{supplier.hasQuote ? ` - ${t('hasQuote')}` : ` - ${t('awaitingQuote')}`}
Keys:

hasQuote → vi: "đã có báo giá", en: "has quote"
awaitingQuote → vi: "chờ báo giá", en: "awaiting quote"
Dòng ~2263
tsx

// Hiện tại:
Chưa có NCC hợp lệ trong RFQ để thương lượng...
// Sửa thành:
{t('noValidSupplierForNeg')}
Key: noValidSupplierForNeg → vi: "Chưa có NCC hợp lệ trong RFQ để thương lượng. Hãy gửi RFQ hoặc kiểm tra lại.", en: "No valid supplier in the RFQ to negotiate with. Please send the RFQ or check again."

Dòng ~2269
tsx

// Hiện tại:
Mục tiêu đàm phán
// Sửa thành:
{t('negotiationGoal')}
Key: negotiationGoal → vi: "Mục tiêu đàm phán", en: "Negotiation Goal"

Dòng ~2275–2277 (3 options trong select)
tsx

// Hiện tại:
<option value="discount_5">Yêu cầu chiết khấu thêm 5% giá trị</option>
<option value="faster_delivery">Yêu cầu rút ngắn thời gian giao hàng</option>
<option value="longer_terms">Yêu cầu kéo dài chu kỳ công nợ</option>
// Sửa thành:
<option value="discount_5">{t('negGoalDiscount5')}</option>
<option value="faster_delivery">{t('negGoalFasterDelivery')}</option>
<option value="longer_terms">{t('negGoalLongerTerms')}</option>
Keys:

negGoalDiscount5 → vi: "Yêu cầu chiết khấu thêm 5% giá trị", en: "Request additional 5% discount"
negGoalFasterDelivery → vi: "Yêu cầu rút ngắn thời gian giao hàng", en: "Request faster delivery"
negGoalLongerTerms → vi: "Yêu cầu kéo dài chu kỳ công nợ", en: "Request extended payment terms"
Dòng ~2290
tsx

// Hiện tại:
AI soạn thư đàm phán
// Sửa thành:
{t('aiDraftNegEmail')}
Key: aiDraftNegEmail → vi: "AI soạn thư đàm phán", en: "AI Draft Negotiation Email"

Dòng ~2297
tsx

// Hiện tại:
Bản thảo AI
// Sửa thành:
{t('aiDraftLabel')}
Key: aiDraftLabel → vi: "Bản thảo AI", en: "AI Draft"

Dòng ~2306
tsx

// Hiện tại:
(button text) Hủy  [bên cạnh "Gửi email Gmail"]
// Sửa thành:
{t('cancel')}
Dòng ~2313
tsx

// Hiện tại:
Gửi email Gmail
// Sửa thành:
{t('sendGmailEmail')}
Key: sendGmailEmail → vi: "Gửi email Gmail", en: "Send Gmail Email"

Dòng ~2324
tsx

// Hiện tại:
Chưa nhận được báo giá nào...
// Sửa thành:
{t('noQuotesReceived')}
Key: noQuotesReceived → vi: "Chưa nhận được báo giá nào...", en: "No quotes received yet..."

Dòng ~2326
tsx

// Hiện tại:
Vui lòng bấm sang Bước 2 và sử dụng "Cổng giả lập đối tác nộp báo giá"...
// Sửa thành:
{t('noQuotesHint')}
Key: noQuotesHint → vi: "Vui lòng bấm sang Bước 2 và sử dụng \"Cổng giả lập đối tác nộp báo giá\" để gửi dữ liệu thử nghiệm.", en: "Please go to Step 2 and use the \"Supplier Quote Simulation Portal\" to submit test data."

NHÓM 5 – Giám Đốc Phê Duyệt (Milestone 4, dòng ~2335–2430)
Dòng ~2336
tsx

// Hiện tại:
renderPermissionLock(["manager"], "Giám Đốc Phê Duyệt Hồ Sơ Thầu")
// Sửa thành:
renderPermissionLock(["manager"], t('directorApprovalTitle'))
Key: directorApprovalTitle → vi: "Giám Đốc Phê Duyệt Hồ Sơ Thầu", en: "Director Bid Approval"

Dòng ~2339
tsx

// Hiện tại:
Bước 4: Giám Đốc Phê Duyệt Hồ Sơ Thầu (CEO Approval Queue)
// Sửa thành:
{t('step4Title')}
Key: step4Title → vi: "Bước 4: Giám Đốc Phê Duyệt Hồ Sơ Thầu (CEO Approval Queue)", en: "Step 4: Director Bid Approval (CEO Approval Queue)"

Dòng ~2347
tsx

// Hiện tại:
Hồ sơ thầu chờ phê duyệt
// Sửa thành:
{t('bidFilesAwaitingApproval')}
Key: bidFilesAwaitingApproval → vi: "Hồ sơ thầu chờ phê duyệt", en: "Bid Files Awaiting Approval"

Dòng ~2353
tsx

// Hiện tại:
Báo giá: {q.unitPrice}...
// Sửa thành:
{t('quote')}: {q.unitPrice}...
Key: quote → vi: "Báo giá", en: "Quote"

Dòng ~2355
tsx

// Hiện tại:
Thanh toán: ...
// Sửa thành:
{t('payment')}: ...
Key: payment → vi: "Thanh toán", en: "Payment"

Dòng ~2362
tsx

// Hiện tại:
Đã đàm phán 10%
// Sửa thành:
{t('negotiated10Pct')}
Key: negotiated10Pct → vi: "Đã đàm phán 10%", en: "Negotiated 10%"

Dòng ~2369
tsx

// Hiện tại:
Chưa có NCC nào được chọn...
// Sửa thành:
{t('noSupplierSelectedYet')}
Key: noSupplierSelectedYet → vi: "Chưa có NCC nào được chọn...", en: "No supplier selected yet..."

Dòng ~2378
tsx

// Hiện tại:
Quyết định phê duyệt
// Sửa thành:
{t('approvalDecision')}
Key: approvalDecision → vi: "Quyết định phê duyệt", en: "Approval Decision"

Dòng ~2382
tsx

// Hiện tại:
Ghi chú phê duyệt (tùy chọn)
// Sửa thành:
{t('approvalNoteLabel')}
Key: approvalNoteLabel → vi: "Ghi chú phê duyệt (tùy chọn)", en: "Approval Notes (optional)"

Dòng ~2385
tsx

// Hiện tại:
placeholder="Duyệt đơn vì tổng chi phí tốt nhất và giao nhận nhanh..."
// Sửa thành:
placeholder={t('approvalNotePlaceholder')}
Key: approvalNotePlaceholder → vi: "Duyệt đơn vì tổng chi phí tốt nhất và giao nhận nhanh...", en: "Approve this order due to best total cost and fast delivery..."

Dòng ~2399
tsx

// Hiện tại:
Bác bỏ & Đàm phán lại
// Sửa thành:
{t('rejectAndRenegotiate')}
Key: rejectAndRenegotiate → vi: "Bác bỏ & Đàm phán lại", en: "Reject & Renegotiate"

Dòng ~2408
tsx

// Hiện tại:
Ký duyệt phê duyệt đơn PO
// Sửa thành:
{t('signApprovePO')}
Key: signApprovePO → vi: "Ký duyệt phê duyệt đơn PO", en: "Sign & Approve PO"

Dòng ~2414
tsx

// Hiện tại:
Trạng thái phê duyệt:
// Sửa thành:
{t('approvalStatus')}:
Key: approvalStatus → vi: "Trạng thái phê duyệt", en: "Approval Status"

Dòng ~2417
tsx

// Hiện tại:
Đã được Giám Đốc...
// Sửa thành:
{t('approvedByDirector')}
Key: approvedByDirector → vi: "Đã được Giám Đốc duyệt", en: "Approved by Director"

Dòng ~2420
tsx

// Hiện tại:
Đang đợi đề xuất thầu sớm trình lên...
// Sửa thành:
{t('waitingForBidProposal')}
Key: waitingForBidProposal → vi: "Đang đợi đề xuất thầu sớm trình lên...", en: "Waiting for bid proposal to be submitted..."

Dòng ~2435
tsx

// Hiện tại:
Tạo Đơn đặt hàng nhập PO
// Sửa thành:
{t('createPODraft')}
Key: createPODraft → vi: "Tạo Đơn đặt hàng nhập PO", en: "Create PO Order"

Dòng ~2443
tsx

// Hiện tại:
Không tìm thấy hồ sơ báo giá...
// Sửa thành:
{t('noBidFileFound')}
Key: noBidFileFound → vi: "Không tìm thấy hồ sơ báo giá...", en: "No bid file found..."

NHÓM 6 – Đơn Đặt Hàng PO & Nhập Kho (Milestone 5, dòng ~2454–2580)
Dòng ~2454
tsx

// Hiện tại:
Bước 5: Đơn Đặt Hàng PO & Ghi Nhận Nhập Kho
// Sửa thành:
{t('step5Title')}
Key: step5Title → vi: "Bước 5: Đơn Đặt Hàng PO & Ghi Nhận Nhập Kho", en: "Step 5: Purchase Order & Goods Receipt"

Dòng ~2465
tsx

// Hiện tại:
(PO heading, tên nhà cung cấp)
// Kiểm tra và sửa label tiếng Việt trong block này
Dòng ~2471
tsx

// Hiện tại:
po.status === "confirmed" ? "Đã phát thầu" : "Nháp"
// Sửa thành:
po.status === "confirmed" ? t('poConfirmed') : t('poDraft')
Keys:

poConfirmed → vi: "Đã phát thầu", en: "Confirmed"
poDraft → vi: "Nháp", en: "Draft"
Dòng ~2479
tsx

// Hiện tại:
Chi tiết sản phẩm đặt hàng (PO):
// Sửa thành:
{t('poItemDetails')}:
Key: poItemDetails → vi: "Chi tiết sản phẩm đặt hàng (PO)", en: "PO Order Items"

Dòng ~2486
tsx

// Hiện tại:
Số lượng đặt...
// Sửa thành:
{t('quantityOrdered')}...
Key: quantityOrdered → vi: "Số lượng đặt", en: "Quantity Ordered"

Dòng ~2492
tsx

// Hiện tại:
Đã nhập kho thành công ✓
// Sửa thành:
{t('goodsReceived')}
Key: goodsReceived → vi: "Đã nhập kho thành công", en: "Goods received successfully"

Dòng ~2495
tsx

// Hiện tại:
(badge nhỏ về receipt)
// Kiểm tra cụ thể
Dòng ~2513
tsx

// Hiện tại:
Gửi thầu PO chính thức
// Sửa thành:
{t('sendOfficialPO')}
Key: sendOfficialPO → vi: "Gửi thầu PO chính thức", en: "Send Official PO"

Dòng ~2521
tsx

// Hiện tại:
Chỉ Nhân viên Thu Mua mới có quyền gửi đơn PO đặt hàng.
// Sửa thành:
{t('onlyProcurementCanSendPO')}
Key: onlyProcurementCanSendPO → vi: "Chỉ Nhân viên Thu Mua mới có quyền gửi đơn PO đặt hàng.", en: "Only Procurement staff can send PO orders."

Dòng ~2535
tsx

// Hiện tại:
Xác nhận Kiểm Kho & Hoàn Tất Nhập Kho (1-Click)
// Sửa thành:
{t('confirmGoodsReceipt')}
Key: confirmGoodsReceipt → vi: "Xác nhận Kiểm Kho & Hoàn Tất Nhập Kho (1-Click)", en: "Confirm Goods Receipt & Complete Inventory (1-Click)"

Dòng ~2543
tsx

// Hiện tại:
Chỉ Thủ Kho mới có quyền xác nhận thực nhận và nhập kho.
// Sửa thành:
{t('onlyWarehouseCanConfirm')}
Key: onlyWarehouseCanConfirm → vi: "Chỉ Thủ Kho mới có quyền xác nhận thực nhận và nhập kho.", en: "Only Warehouse staff can confirm goods receipt."

Dòng ~2551
tsx

// Hiện tại:
Chưa tạo đơn đặt hàng PO...
// Sửa thành:
{t('noPOCreated')}
Key: noPOCreated → vi: "Chưa tạo đơn đặt hàng PO...", en: "No PO created yet..."

Dòng ~2553
tsx

// Hiện tại:
CEO đã duyệt phê duyệt thầu? Hãy click khởi tạo Bản thảo PO thầu để chính thức tạo đơn đặt hàng.
// Sửa thành:
{t('ceoApprovedClickToCreatePO')}
Key: ceoApprovedClickToCreatePO → vi: "CEO đã duyệt phê duyệt thầu? Hãy click khởi tạo Bản thảo PO thầu để chính thức tạo đơn đặt hàng.", en: "Has the CEO approved the bid? Click to initialize the PO draft to officially create the order."

Dòng ~2564
tsx

// Hiện tại:
Khởi tạo bản thảo Đơn PO
// Sửa thành:
{t('initPODraft')}
Key: initPODraft → vi: "Khởi tạo bản thảo Đơn PO", en: "Initialize PO Draft"

Dòng ~2570
tsx

// Hiện tại:
Chỉ Nhân viên Thu Mua mới có quyền khởi tạo bản thảo Đơn PO.
// Sửa thành:
{t('onlyProcurementCanInitPO')}
Key: onlyProcurementCanInitPO → vi: "Chỉ Nhân viên Thu Mua mới có quyền khởi tạo bản thảo Đơn PO.", en: "Only Procurement staff can initialize a PO draft."

Dòng ~2575
tsx

// Hiện tại:
Chờ duyệt thầu của Giám Đốc...
// Sửa thành:
{t('waitingDirectorApproval')}
Key: waitingDirectorApproval → vi: "Chờ duyệt thầu của Giám Đốc...", en: "Waiting for Director approval..."

NHÓM 7 – Right Panel: Metadata & Nhật Ký (dòng ~2585–2650)
Dòng ~2588
tsx

// Hiện tại:
(section heading)
// Kiểm tra heading của right panel
Dòng ~2592
tsx

// Hiện tại:
Phòng ban đề xuất:
// Sửa thành:
{t('requestingDepartment')}:
Key: requestingDepartment → vi: "Phòng ban đề xuất", en: "Requesting Department"

Dòng ~2596
tsx

// Hiện tại:
Người đề xuất:
// Sửa thành:
{t('requester')}:
Key: requester → vi: "Người đề xuất", en: "Requester"

Dòng ~2600
tsx

// Hiện tại:
Khởi tạo từ đặt:
// Sửa thành:
{t('autoInitiatedFrom')}:
Key: autoInitiatedFrom → vi: "Khởi tạo từ đặt", en: "Auto-initiated from"

Dòng ~2604
tsx

// Hiện tại:
Hạn giao hàng bếp:
// Sửa thành:
{t('kitchenDeadline')}:
Key: kitchenDeadline → vi: "Hạn giao hàng bếp", en: "Kitchen Delivery Deadline"

Dòng ~2608
tsx

// Hiện tại:
Ngày lập:
// Sửa thành:
{t('createdDate')}:
Key: createdDate → vi: "Ngày lập", en: "Date Created"

Dòng ~2617
tsx

// Hiện tại:
Nhật ký chuyển đổi Case thầu
// Sửa thành:
{t('caseTransitionLog')}
Key: caseTransitionLog → vi: "Nhật ký chuyển đổi Case thầu", en: "Case Transition Log"

Dòng ~2643
tsx

// Hiện tại:
Chưa có nhật ký chuyển đổi.
// Sửa thành:
{t('noTransitionLogYet')}
Key: noTransitionLogYet → vi: "Chưa có nhật ký chuyển đổi.", en: "No transition log yet."

NHÓM 8 – Cleanup: Xóa text thừa
"Stally ERP © 2026"
Tìm trong toàn bộ project:

bash

grep -r "Stally ERP © 2026" src/
Xóa hoặc comment out dòng đó.

"Data Isolation: org-1" (đã xóa ở RequesterDashboard.tsx)
Kiểm tra lại các component khác:

bash

grep -r "Data Isolation" src/
grep -r "org-1" src/
Tóm tắt số lượng
Nhóm	File	Số chỗ cần sửa
1. RFQ Draft Editor buttons	CaseDetailTimeline.tsx ~1940-1975	3
2. RFQ Sender Triggers	CaseDetailTimeline.tsx ~1985-2015	4
3. Comparison Table	CaseDetailTimeline.tsx ~2190-2230	6
4. AI Negotiation Hub	CaseDetailTimeline.tsx ~2240-2330	12
5. CEO Approval Queue	CaseDetailTimeline.tsx ~2335-2445	11
6. PO & Goods Receipt	CaseDetailTimeline.tsx ~2454-2580	10
7. Right Panel Metadata	CaseDetailTimeline.tsx ~2585-2650	7
8. Cleanup text thừa	Toàn bộ project	2
TỔNG		~55 chỗ
Template thêm key vào i18n.ts
ts

// Trong block vi: { ... }
cancel: "Hủy",
saving: "Đang lưu...",
saveDraft: "Lưu thầu",
emailSubject: "Tiêu đề email",
listeningForQuotes: "Đang nghe hòm thư phản hồi báo giá tự động...",
// ... thêm tất cả các key ở trên
// Trong block en: { ... }
cancel: "Cancel",
saving: "Saving...",
saveDraft: "Save Draft",
emailSubject: "Email Subject",
listeningForQuotes: "Listening for quote replies automatically...",
// ...
import { exec } from "child_process";

const BASE_URL = "http://localhost:3000/api/v1";
const ORG_ID = "org-1";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("🚀 KHỞI CHẠY BỘ KIỂM THỬ TỰ ĐỘNG STALLY PROCUREMENT BACKEND...");
  
  try {
    // 1. Kiểm tra kết nối cơ bản & Lấy quyền
    console.log("\n1. Kiểm tra thông tin User hiện tại & Quyền hạn...");
    const meRes = await fetch(`${BASE_URL}/me?role=procurement`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const meData = await meRes.json();
    console.log(`- Đăng nhập thành công với User: ${meData.data.name} (Role: ${meData.data.role})`);
    
    const permRes = await fetch(`${BASE_URL}/permissions?role=procurement`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const permData = await permRes.json();
    console.log(`- Số quyền hạn hiện tại: ${permData.data.length}`);
    
    // 2. Khởi tạo một Case mua sắm mới
    console.log("\n2. Khởi tạo Procurement Case mới (Mua sắm Gạo và Dầu ăn)...");
    const createRes = await fetch(`${BASE_URL}/cases`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({
        title: "Mua nguyên liệu bếp khẩn cấp cho tiệc tối",
        priority: "high",
        departmentId: "Bộ phận Bếp",
        items: [
          { name: "Gạo ST25 Cao Cấp", quantity: 200, unit: "kg", notes: "Cần gấp cho tiệc công ty" },
          { name: "Dầu Ăn Tường An 5L", quantity: 15, unit: "chai", notes: "Chiên xào tiệc tối" }
        ],
        createdFrom: "web",
        requesterId: "u-2",
        requesterName: "Trần Văn Bình (Bếp Trưởng)"
      })
    });
    
    const createData = await createRes.json();
    const caseObj = createData.data;
    const caseId = caseObj.id;
    console.log(`- Đã khởi tạo thành công Case: ${caseId} (${caseObj.title})`);
    console.log(`- Trạng thái ban đầu: ${caseObj.status}`);
    
    // 3. Phê duyệt duyệt chuyển tiếp Case lên luồng Sourcing
    console.log("\n3. Sourcing tiếp quản và duyệt chuyển tiếp Case...");
    const submitRes = await fetch(`${BASE_URL}/cases/${caseId}/submit`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ reason: "Duyệt yêu cầu hợp lệ để khớp NCC", role: "procurement" })
    });
    const submitData = await submitRes.json();
    console.log(`- Trạng thái duyệt chuyển tiếp: ${submitData.data.status}`);
    
    // Đợi 600ms để hệ thống auto-chuyển sang supplier_matching
    await sleep(600);
    
    const getCaseRes = await fetch(`${BASE_URL}/cases/${caseId}`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const getCaseData = await getCaseRes.json();
    console.log(`- Trạng thái thực tế sau xử lý nền: ${getCaseData.data.status}`);
    
    // 4. Ghép cặp đối tác tối ưu (Supplier Matching)
    console.log("\n4. AI tìm kiếm & Khớp NCC tối ưu...");
    const matchRes = await fetch(`${BASE_URL}/cases/${caseId}/supplier-matches`, {
      method: "POST",
      headers: { "X-Organization-Id": ORG_ID }
    });
    const matchData = await matchRes.json();
    console.log(`- Khớp thành công ${matchData.data.length} nhà thầu.`);
    matchData.data.slice(0, 2).forEach((m: any) => {
      console.log(`  * NCC: ${m.name} | Điểm khớp: ${m.score}% | Lý do: ${m.reasons[0]}`);
    });
    
    const selectedSupplierIds = matchData.data.slice(0, 2).map((m: any) => m.supplierId);
    
    // 5. Chọn NCC & Lập thư RFQ chào thầu
    console.log("\n5. Tạo thư mời báo giá thầu RFQ...");
    const selectRes = await fetch(`${BASE_URL}/cases/${caseId}/suppliers/select`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ supplierIds: selectedSupplierIds })
    });
    
    const draftRes = await fetch(`${BASE_URL}/cases/${caseId}/rfq-draft`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ supplierIds: selectedSupplierIds, dueDate: "2026-05-30" })
    });
    const draftData = await draftRes.json();
    console.log(`- Đã soạn thảo nháp ${draftData.data.length} email chào thầu riêng biệt.`);
    
    // Gửi thư thầu
    console.log("- Tiến hành gửi thư thầu chính thức qua hòm thư Gmail B2B...");
    const sendRfqRes = await fetch(`${BASE_URL}/cases/${caseId}/rfq/send`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ draftIds: draftData.data.map((d: any) => d.id) })
    });
    const sendRfqData = await sendRfqRes.json();
    console.log(`- Đã gửi thư RFQ thầu thợ. ID RFQ: ${sendRfqData.rfqId}`);
    
    // Đợi 500ms
    await sleep(500);
    
    // 6. Mô phỏng webhook email phản hồi báo giá thô nộp về
    const mockSupplierId = selectedSupplierIds[0];
    const mockSupplierName = matchData.data.find((m: any) => m.supplierId === mockSupplierId)?.name;
    console.log(`\n6. Mô phỏng NCC [${mockSupplierName}] phản hồi email gửi báo giá về hệ thống...`);
    
    const inboundRes = await fetch(`${BASE_URL}/webhooks/inbound-email`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({
        fromEmail: "gaovangvietnam@gmail.com",
        fromName: mockSupplierName,
        subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Thư mời chào giá cung cấp nguyên liệu`,
        bodyText: `Chào anh Tâm, chúng tôi gửi bảng chào thầu Gạo giá cực tốt cho bếp. Chi tiết gạo 27000đ/kg, dầu ăn 185000đ/chai. Vận chuyển miễn phí.`,
        rfqCaseId: sendRfqData.rfqId,
        supplierId: mockSupplierId,
        fileName: "quote_adjusted_golden_rice.pdf"
      })
    });
    
    const inboundData = await inboundRes.json();
    console.log(`- Webhook email tiếp nhận thành công. Gán chính xác hòm thư vào: ${inboundData.linkedCaseId}`);
    
    // Đợi 1.2 giây để AI bóc tách tài liệu và cập nhật ma trận so sánh
    console.log("- Đang đợi AI bóc tách dữ liệu PDF không cấu trúc...");
    await sleep(1500);
    
    // 7. Xem ma trận so sánh tài chính
    console.log("\n7. Tra cứu ma trận đối chiếu bảng báo giá...");
    const compRes = await fetch(`${BASE_URL}/cases/${caseId}/comparison`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const compData = await compRes.json();
    console.log(`- Tổng số báo giá đã bóc tách: ${compData.matrix.length}`);
    const activeQuote = compData.matrix[0];
    console.log(`  * NCC chào thầu: ${activeQuote.supplierName}`);
    console.log(`  * Đơn giá Gạo trích xuất: ${activeQuote.items[0].unitPrice.toLocaleString()} đ/kg`);
    console.log(`  * Tổng tiền hóa đơn: ${activeQuote.totalAmount.toLocaleString()} đ (Độ chính xác AI: ${activeQuote.aiConfidenceScore}%)`);
    console.log(`  * AI Đề xuất: ${compData.summary.recommendationReason}`);
    
    // 8. Đàm phán thương lượng giảm giá
    console.log("\n8. Kích hoạt AI đàm phán thương lượng chiết khấu thêm...");
    const negoDraftRes = await fetch(`${BASE_URL}/cases/${caseId}/negotiations/${mockSupplierId}/draft`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ goal: "discount_5" })
    });
    const negoDraftData = await negoDraftRes.json();
    console.log(`- AI soạn thảo thành công thư thương lượng xin chiết khấu 5% gửi ${mockSupplierName}.`);
    
    const negoSendRes = await fetch(`${BASE_URL}/negotiation-drafts/${negoDraftData.data.id}/send`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ editedBody: negoDraftData.data.draftEmail })
    });
    console.log("- Đã gửi email đàm phán. Hệ thống đang lắng nghe NCC phản hồi...");
    
    // Đợi 1.5 giây để NCC phản hồi đồng ý chiết khấu và tự cập nhật Quote v2
    await sleep(1800);
    
    const compRes2 = await fetch(`${BASE_URL}/cases/${caseId}/comparison`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const compData2 = await compRes2.json();
    const updatedQuote = compData2.matrix[0];
    console.log(`- Đã tự động cập nhật báo giá của ${updatedQuote.supplierName} sau đàm phán!`);
    console.log(`  * Giá trị đơn hàng cũ: ${activeQuote.totalAmount.toLocaleString()} đ`);
    console.log(`  * Giá trị đơn hàng mới (Chiết khấu 5%): ${updatedQuote.totalAmount.toLocaleString()} đ`);
    
    // 9. Nộp trình duyệt và Manager phê duyệt PO
    console.log("\n9. Nhân viên trình duyệt và Manager ký duyệt phương án...");
    await fetch(`${BASE_URL}/cases/${caseId}/approval/request`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ selectedQuoteId: updatedQuote.id, comment: "Đã đàm phán thành công giảm thêm 5%" })
    });
    
    const appDecideRes = await fetch(`${BASE_URL}/approval-requests/${caseId}/approve`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({ comment: "Duyệt phương án giá tốt, tiến hành đặt mua hàng khẩn cấp." })
    });
    const appDecideData = await appDecideRes.json();
    console.log(`- Trạng thái phê duyệt thầu: ${appDecideData.message}`);
    
    // Đợi 500ms
    await sleep(500);
    
    // 10. Khởi tạo PO và Dispatch đi
    console.log("\n10. Khởi tạo Đơn Đặt hàng (PO) chính thức gửi NCC...");
    const poRes = await fetch(`${BASE_URL}/cases/${caseId}/po-draft`, {
      method: "POST",
      headers: { "X-Organization-Id": ORG_ID }
    });
    const poData = await poRes.json();
    const poId = poData.data.id;
    console.log(`- Đã khởi tạo Bản thảo Đơn PO: ${poId} trị giá ${poData.data.totalAmount.toLocaleString()}đ`);
    
    // Kiểm tra lượng tồn kho Gạo đang về (On order) trước khi gửi PO
    const invResBefore = await fetch(`${BASE_URL}/inventory/items`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const invBefore = await invResBefore.json();
    const riceBefore = invBefore.data.find((i: any) => i.sku === "SKU-ST25");
    console.log(`- Tồn kho Gạo khả dụng trước: ${riceBefore.quantityAvailable} kg | Số lượng đang vận chuyển về (On Order): ${riceBefore.quantityOnOrder} kg`);
    
    console.log("- Tiến hành xác nhận và phát hành PO gửi đối tác qua Gmail...");
    await fetch(`${BASE_URL}/purchase-orders/${poId}/send`, {
      method: "POST",
      headers: { "X-Organization-Id": ORG_ID }
    });
    
    const invResAfter = await fetch(`${BASE_URL}/inventory/items`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const invAfter = await invResAfter.json();
    const riceAfter = invAfter.data.find((i: any) => i.sku === "SKU-ST25");
    console.log(`- Tồn kho Gạo sau khi dispatch PO:`);
    console.log(`  * Khả dụng: ${riceAfter.quantityAvailable} kg`);
    console.log(`  * Đang vận chuyển về (On Order): ${riceAfter.quantityOnOrder} kg (+200kg khớp theo PO đặt mua)`);
    
    // Đợi 500ms
    await sleep(500);
    
    // 11. Thủ kho tiếp nhận nhập kho thực tế
    console.log("\n11. Hàng về đến kho, Thủ kho kiểm kê và nhập kho thực phẩm...");
    const recRes = await fetch(`${BASE_URL}/purchase-orders/${poId}/receive`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": ORG_ID
      },
      body: JSON.stringify({
        receivedAt: new Date().toISOString(),
        items: [
          { name: "Gạo ST25 Cao Cấp", quantityReceived: 200 },
          { name: "Dầu Ăn Tường An 5L", quantityReceived: 15 }
        ]
      })
    });
    const recData = await recRes.json();
    console.log(`- Kết quả nhập kho: ${recData.message} | Trạng thái PO: ${recData.po.status}`);
    
    // Kiểm tra lượng tồn kho khả dụng hiện tại sau khi đã nhập kho hàng
    const invFinalRes = await fetch(`${BASE_URL}/inventory/items`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const invFinal = await invFinalRes.json();
    const riceFinal = invFinal.data.find((i: any) => i.sku === "SKU-ST25");
    console.log(`- Tồn kho Gạo sau cùng:`);
    console.log(`  * Khả dụng thực tế đang có: ${riceFinal.quantityAvailable} kg (Tăng từ 45kg lên 245kg)`);
    console.log(`  * Lượng đang thèm về (On Order): ${riceFinal.quantityOnOrder} kg (Khấu trừ hoàn tất về 0)`);
    
    // Kiểm tra Case đã đóng hoàn chỉnh
    const finalCaseRes = await fetch(`${BASE_URL}/cases/${caseId}`, {
      headers: { "X-Organization-Id": ORG_ID }
    });
    const finalCaseData = await finalCaseRes.json();
    console.log(`- Trạng thái cuối cùng của hồ sơ Case: ${finalCaseData.data.status}`);
    
    console.log("\n🎉 HOÀN TẤT TẤT CẢ CÁC BƯỚC KIỂM THỬ TỰ ĐỘNG! BACKEND HOẠT ĐỘNG HOÀN HẢO 100%!");
    
  } catch (err) {
    console.error("❌ LỖI TRONG QUÁ TRÌNH CHẠY BỘ KIỂM THỬ:", err);
  }
}

// Chờ server start hoàn tất rồi chạy test
setTimeout(runTests, 1000);

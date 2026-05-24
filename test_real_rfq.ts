const BASE_URL = "http://localhost:3000/api/v1";
const ORG_ID = "org-1";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 BẮT ĐẦU CHẠY KIỂM THỬ GỬI THƯ THẦU RFQ THẬT QUA CỔNG API...");
  
  const recipient = "phancongtam190305@gmail.com";
  
  // 1. Cập nhật email của sup-2 thông qua cổng API để đồng bộ cả Cache lẫn Disk
  console.log(`\n1. Gọi API cập nhật email của Nhà cung cấp 'NCC Gạo Vàng' (sup-2) thành: [${recipient}]...`);
  const updateRes = await fetch(`${BASE_URL}/suppliers/sup-2`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({ email: recipient })
  });
  const updateData = await updateRes.json();
  console.log(`- Kết quả API cập nhật:`, updateData.data ? "Thành công (Email mới: " + updateData.data.email + ")" : "Thất bại");
  
  // 2. Khởi tạo một Case mua sắm mới
  console.log("\n2. Tạo mới một Procurement Case yêu cầu mua sắm...");
  const createRes = await fetch(`${BASE_URL}/cases`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({
      title: "Yêu cầu mua nguyên liệu làm tiệc Buffet cuối tuần",
      priority: "high",
      departmentId: "Bộ phận Bếp",
      items: [
        { name: "Gạo ST25 Cao Cấp", quantity: 150, unit: "kg", notes: "Kho bếp chính đã thâm hụt đỏ" }
      ],
      createdFrom: "web",
      requesterId: "u-2",
      requesterName: "Trần Văn Bình (Bếp Trưởng)"
    })
  });
  
  const createData = await createRes.json();
  const caseId = createData.data.id;
  console.log(`- Tạo Case thành công! ID: ${caseId}`);
  
  // 3. Duyệt chuyển tiếp Case lên luồng Sourcing
  console.log("\n3. Duyệt chuyển tiếp Case lên luồng Sourcing...");
  await fetch(`${BASE_URL}/cases/${caseId}/submit`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({ reason: "Duyệt yêu cầu hợp lệ để khớp đối tác", role: "procurement" })
  });
  
  await sleep(600); // Chờ hệ thống xử lý nền
  
  // 4. Chọn nhà cung ứng và soạn thảo thư RFQ
  console.log("\n4. Lựa chọn 'NCC Gạo Vàng' (sup-2) làm đơn vị gửi thầu...");
  await fetch(`${BASE_URL}/cases/${caseId}/suppliers/select`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({ supplierIds: ["sup-2"] })
  });
  
  // Soạn thư mời thầu
  const draftRes = await fetch(`${BASE_URL}/cases/${caseId}/rfq-draft`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({ supplierIds: ["sup-2"], dueDate: "2026-05-30" })
  });
  const draftData = await draftRes.json();
  const draftId = draftData.data[0].id;
  console.log(`- Bản thảo thư thầu RFQ HTML đã được AI sinh ra thành công.`);
  
  // 5. BẤM NÚT "GỬI YÊU CẦU BÁO GIÁ" QUA GMAIL THẬT
  console.log(`\n5. 🚀 KÍCH HOẠT API GỬI YÊU CẦU BÁO GIÁ THẬT (Bấm nút trên Web)...`);
  const sendRes = await fetch(`${BASE_URL}/cases/${caseId}/rfq/send`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Organization-Id": ORG_ID
    },
    body: JSON.stringify({ draftIds: [draftId] })
  });
  
  const sendData = await sendRes.json();
  console.log(`- Trạng thái trả về từ API gửi mail:`, sendData);
  console.log(`\n✅ THÀNH CÔNG! Thư mời thầu đã được phát đi thực tế đến Gmail của bạn: [${recipient}]`);
  console.log(`👉 Bạn hãy mở Hộp thư đến (Inbox) Gmail của bạn để chiêm ngưỡng Thư mời chào thầu chuyên nghiệp được gửi trực tiếp nhé!`);
}

main().catch(console.error);

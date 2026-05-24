import { sendRealEmail } from "./src/backend/mailer.js";

async function main() {
  console.log("🚀 BẮT ĐẦU KIỂM THỬ GỬI EMAIL THỰC TẾ (UNIT TEST)...");
  
  const recipient = "phancongtam190305@gmail.com";
  
  const result = await sendRealEmail({
    to: recipient,
    subject: "🔥 [STALLY TEST] Kiểm thử hòm thư SMTP tự động thành công!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4F46E5; text-align: center;">🎉 Stally SMTP Test Success!</h2>
        <p>Chào bạn <strong>Phan Công Tâm</strong>,</p>
        <p>Đây là email kiểm thử tự động được gửi từ hệ thống <strong>Stally B2B Sourcing</strong> thông qua cổng Gmail SMTP của bạn.</p>
        <p style="background-color: #F3F4F6; padding: 12px; border-left: 4px solid #4F46E5; font-size: 14px;">
          <strong>Trạng thái kết nối:</strong> Hoàn toàn ổn định và sẵn sàng hoạt động!<br/>
          <strong>Thời gian gửi:</strong> ${new Date().toLocaleString("vi-VN")}
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="http://localhost:3000" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Truy cập Stally Dashboard</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;"/>
        <p style="font-size: 12px; color: #9CA3AF; text-align: center;">Email này được gửi tự động bởi hệ thống test Stally. Vui lòng không trả lời.</p>
      </div>
    `
  });

  if (result.success) {
    console.log(`\n✅ THÀNH CÔNG! Thư test đã được gửi đi thành công.`);
    console.log(`- Mã tin nhắn (MessageId): ${result.messageId}`);
    console.log(`👉 Bạn vui lòng kiểm tra Hộp thư đến (Inbox) hoặc Thư đã gửi (Sent) của Gmail: [${recipient}] để xác nhận nhé!`);
  } else {
    console.log(`\n❌ THẤT BẠI! Lỗi gửi email:`);
    console.log(result.error);
    console.log(`👉 Vui lòng kiểm tra lại địa chỉ Email hoặc Mật khẩu ứng dụng 16 ký số trong file .env nhé.`);
  }
}

main().catch(console.error);

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || "no-reply@stally.com";
const smtpFromName = process.env.SMTP_FROM_NAME || "Stally B2B Sourcing";

let transporter: nodemailer.Transporter | null = null;

// Initialize Nodemailer transporter if config is present
if (smtpHost && smtpUser && smtpPass) {
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    console.log(`✉️ Nodemailer initialized. SMTP Host: ${smtpHost}:${smtpPort}`);
  } catch (err) {
    console.error("❌ Failed to initialize Nodemailer transporter:", err);
  }
} else {
  console.warn("SMTP environment variables not configured. Real email sending is disabled.");
}

interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendRealEmail(input: EmailInput): Promise<{ success: boolean; messageId?: string; error?: any }> {
  const { to, subject, html, text } = input;
  // Hardcode recipient for testing safety
  const toList = "phancongtam0907930205@gmail.com";

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: toList,
        subject: subject,
        text: text || "Vui lòng xem nội dung email HTML đính kèm.",
        html: html,
      });
      console.log(`✉️ Real Email sent successfully! MessageID: ${info.messageId} to [${toList}]`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`❌ Failed to send real email to [${toList}]:`, err);
      return { success: false, error: err.message };
    }
  }

  return {
    success: false,
    error: "SMTP_NOT_CONFIGURED: Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, and SMTP_SECURE before sending RFQ emails.",
  };
}

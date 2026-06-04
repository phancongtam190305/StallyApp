import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import dotenv from "dotenv";
import { createTraceId, logFlow, maskEmails, safeError, subjectSummary, textSummary } from "./logger.js";

dotenv.config();

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = process.env.SMTP_SECURE === "true";
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || "no-reply@stally.com";
const smtpFromName = process.env.SMTP_FROM_NAME || "Stally B2B Sourcing";
const smtpNetworkFamily = process.env.SMTP_NETWORK_FAMILY === "6" ? 6 : 4;

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const smtpDnsTimeoutMs = positiveIntEnv("SMTP_DNS_TIMEOUT_MS", 10000);
const smtpConnectionTimeoutMs = positiveIntEnv("SMTP_CONNECTION_TIMEOUT_MS", 15000);
const smtpGreetingTimeoutMs = positiveIntEnv("SMTP_GREETING_TIMEOUT_MS", 15000);
const smtpSocketTimeoutMs = positiveIntEnv("SMTP_SOCKET_TIMEOUT_MS", 45000);

let transporter: nodemailer.Transporter | null = null;

type SmtpTransportOptionsWithNetwork = SMTPTransport.Options & {
  family?: 4 | 6;
  dnsTimeout?: number;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
};

// Initialize Nodemailer transporter if config is present
if (smtpHost && smtpUser && smtpPass) {
  try {
    const smtpOptions: SmtpTransportOptionsWithNetwork = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      family: smtpNetworkFamily,
      dnsTimeout: smtpDnsTimeoutMs,
      connectionTimeout: smtpConnectionTimeoutMs,
      greetingTimeout: smtpGreetingTimeoutMs,
      socketTimeout: smtpSocketTimeoutMs,
    };
    transporter = nodemailer.createTransport(smtpOptions);
    logFlow("info", "smtp.transporter.initialized", {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      networkFamily: smtpNetworkFamily,
      dnsTimeoutMs: smtpDnsTimeoutMs,
      connectionTimeoutMs: smtpConnectionTimeoutMs,
      greetingTimeoutMs: smtpGreetingTimeoutMs,
      socketTimeoutMs: smtpSocketTimeoutMs,
      userConfigured: Boolean(smtpUser),
      fromEmail: maskEmails(smtpFromEmail),
      fromName: smtpFromName,
    });
    console.log(`✉️ Nodemailer initialized. SMTP Host: ${smtpHost}:${smtpPort}`);
  } catch (err) {
    logFlow("error", "smtp.transporter.init_failed", {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      err: safeError(err),
    });
    console.error("❌ Failed to initialize Nodemailer transporter:", err);
  }
} else {
  logFlow("warn", "smtp.transporter.not_configured", {
    hasHost: Boolean(smtpHost),
    hasUser: Boolean(smtpUser),
    hasPass: Boolean(smtpPass),
    port: smtpPort,
    secure: smtpSecure,
  });
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
  const traceId = createTraceId("smtp");
  const startedAt = Date.now();
  // Hardcode recipient for testing safety
  const toList = "phancongtam0907930205@gmail.com";
  logFlow("info", "smtp.send.start", {
    traceId,
    requestedTo: maskEmails(to),
    actualTo: maskEmails(toList),
    hardcodedRecipientOverride: String(toList) !== String(Array.isArray(to) ? to.join(",") : to),
    fromEmail: maskEmails(smtpFromEmail),
    subject: subjectSummary(subject),
    html: textSummary(html),
    text: textSummary(text),
    configured: Boolean(transporter),
  });

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
      logFlow("info", "smtp.send.success", {
        traceId,
        messageId: info.messageId,
        requestedTo: maskEmails(to),
        actualTo: maskEmails(toList),
        subject: subjectSummary(subject),
        durationMs: Date.now() - startedAt,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`❌ Failed to send real email to [${toList}]:`, err);
      logFlow("error", "smtp.send.failed", {
        traceId,
        requestedTo: maskEmails(to),
        actualTo: maskEmails(toList),
        subject: subjectSummary(subject),
        durationMs: Date.now() - startedAt,
        err: safeError(err),
      });
      return { success: false, error: err.message };
    }
  }

  logFlow("warn", "smtp.send.not_configured", {
    traceId,
    requestedTo: maskEmails(to),
    actualTo: maskEmails(toList),
    subject: subjectSummary(subject),
    durationMs: Date.now() - startedAt,
  });
  return {
    success: false,
    error: "SMTP_NOT_CONFIGURED: Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, and SMTP_SECURE before sending RFQ emails.",
  };
}

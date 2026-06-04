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
const emailRecipientOverride = (process.env.EMAIL_RECIPIENT_OVERRIDE || "").trim();
const emailProvider = (process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();
const gmailApiClientId = process.env.GMAIL_API_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
const gmailApiClientSecret = process.env.GMAIL_API_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
const gmailApiRefreshToken = process.env.GMAIL_API_REFRESH_TOKEN || "";
const gmailApiSenderEmail = process.env.GMAIL_API_SENDER_EMAIL || smtpFromEmail;

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

function normalizeRecipients(to: string | string[]) {
  return (Array.isArray(to) ? to : String(to || "").split(","))
    .map(item => item.trim())
    .filter(Boolean);
}

function headerSafe(value: string) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function encodeMimeHeader(value: string) {
  const safe = headerSafe(value);
  return /^[\x00-\x7F]*$/.test(safe)
    ? safe
    : `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildGmailRawMessage(input: EmailInput, actualTo: string | string[]) {
  const recipients = normalizeRecipients(actualTo);
  if (recipients.length === 0) {
    throw new Error("GMAIL_API_NO_RECIPIENTS: Email cần ít nhất một người nhận.");
  }

  const fromHeader = `"${headerSafe(smtpFromName)}" <${headerSafe(gmailApiSenderEmail)}>`;
  const commonHeaders = [
    `From: ${fromHeader}`,
    `To: ${recipients.map(headerSafe).join(", ")}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
  ];

  if (input.text) {
    const boundary = `stally-alt-${Date.now()}`;
    const mime = [
      ...commonHeaders,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    return toBase64Url(mime);
  }

  const mime = [
    ...commonHeaders,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
  ].join("\r\n");
  return toBase64Url(mime);
}

function isGmailApiConfigured() {
  return Boolean(gmailApiClientId && gmailApiClientSecret && gmailApiRefreshToken && gmailApiSenderEmail);
}

async function getGmailApiAccessToken() {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: gmailApiClientId,
      client_secret: gmailApiClientSecret,
      refresh_token: gmailApiRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "GMAIL_API_TOKEN_FAILED");
  }
  return tokenData.access_token as string;
}

async function sendViaGmailApi(input: EmailInput, actualTo: string | string[], traceId: string) {
  if (!isGmailApiConfigured()) {
    return {
      success: false,
      error: "GMAIL_API_NOT_CONFIGURED: Set GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, GMAIL_API_REFRESH_TOKEN, and GMAIL_API_SENDER_EMAIL.",
    };
  }

  try {
    const accessToken = await getGmailApiAccessToken();
    const raw = buildGmailRawMessage(input, actualTo);
    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const sendData: any = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok || !sendData.id) {
      throw new Error(sendData.error?.message || sendData.error || `GMAIL_API_SEND_FAILED_${sendRes.status}`);
    }

    logFlow("info", "gmail_api.send.success", {
      traceId,
      messageId: sendData.id,
      threadId: sendData.threadId,
      actualTo: maskEmails(actualTo),
      senderEmail: maskEmails(gmailApiSenderEmail),
    });
    return { success: true, messageId: sendData.id };
  } catch (err: any) {
    logFlow("error", "gmail_api.send.failed", {
      traceId,
      actualTo: maskEmails(actualTo),
      senderEmail: maskEmails(gmailApiSenderEmail),
      err: safeError(err),
    });
    return { success: false, error: err.message || String(err) };
  }
}

async function sendViaSmtp(input: EmailInput, actualTo: string | string[], traceId: string, startedAt: number) {
  const { subject, html, text } = input;
  const actualToText = Array.isArray(actualTo) ? actualTo.join(",") : actualTo;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: actualTo,
        subject,
        text: text || "Vui lòng xem nội dung email HTML đính kèm.",
        html,
      });
      console.log(`✉️ Real Email sent successfully! MessageID: ${info.messageId} to [${actualToText}]`);
      logFlow("info", "smtp.send.success", {
        traceId,
        messageId: info.messageId,
        actualTo: maskEmails(actualTo),
        recipientOverrideEnabled: Boolean(emailRecipientOverride),
        subject: subjectSummary(subject),
        durationMs: Date.now() - startedAt,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`❌ Failed to send real email to [${actualToText}]:`, err);
      logFlow("error", "smtp.send.failed", {
        traceId,
        actualTo: maskEmails(actualTo),
        recipientOverrideEnabled: Boolean(emailRecipientOverride),
        subject: subjectSummary(subject),
        durationMs: Date.now() - startedAt,
        err: safeError(err),
      });
      return { success: false, error: err.message };
    }
  }

  logFlow("warn", "smtp.send.not_configured", {
    traceId,
    actualTo: maskEmails(actualTo),
    recipientOverrideEnabled: Boolean(emailRecipientOverride),
    subject: subjectSummary(subject),
    durationMs: Date.now() - startedAt,
  });
  return {
    success: false,
    error: "SMTP_NOT_CONFIGURED: Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, and SMTP_SECURE before sending RFQ emails.",
  };
}

export function getEmailProviderStatus() {
  return {
    provider: emailProvider,
    recipientOverrideEnabled: Boolean(emailRecipientOverride),
    smtp: {
      configured: Boolean(transporter),
      host: smtpHost || null,
      port: smtpPort,
      secure: smtpSecure,
      networkFamily: smtpNetworkFamily,
      fromEmailConfigured: Boolean(smtpFromEmail),
    },
    gmailApi: {
      configured: isGmailApiConfigured(),
      clientConfigured: Boolean(gmailApiClientId && gmailApiClientSecret),
      refreshTokenConfigured: Boolean(gmailApiRefreshToken),
      senderEmailConfigured: Boolean(gmailApiSenderEmail),
      senderEmail: gmailApiSenderEmail ? maskEmails(gmailApiSenderEmail) : [],
    },
  };
}

export async function sendRealEmail(input: EmailInput): Promise<{ success: boolean; messageId?: string; error?: any }> {
  if (process.env.NODE_ENV === "test" && process.env.EMAIL_TEST_ALLOW_REAL_SEND !== "true") {
    return {
      success: false,
      error: "EMAIL_SEND_DISABLED_IN_TEST: Set EMAIL_TEST_ALLOW_REAL_SEND=true only for explicit live email tests.",
    };
  }

  const { to, subject, html, text } = input;
  const traceId = createTraceId("smtp");
  const startedAt = Date.now();
  const toList = emailRecipientOverride || to;
  logFlow("info", "email.send.start", {
    traceId,
    provider: emailProvider,
    requestedTo: maskEmails(to),
    actualTo: maskEmails(toList),
    recipientOverrideEnabled: Boolean(emailRecipientOverride),
    fromEmail: maskEmails(emailProvider === "gmail_api" ? gmailApiSenderEmail : smtpFromEmail),
    subject: subjectSummary(subject),
    html: textSummary(html),
    text: textSummary(text),
    configured: emailProvider === "gmail_api" ? isGmailApiConfigured() : Boolean(transporter),
  });

  if (emailProvider === "gmail_api") {
    return sendViaGmailApi(input, toList, traceId);
  }

  return sendViaSmtp(input, toList, traceId, startedAt);
}

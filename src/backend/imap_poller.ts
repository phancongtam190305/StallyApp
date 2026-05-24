import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ingestInboundEmail } from "./api_v1.js";

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;

function getImapConfig() {
  const enabled = process.env.IMAP_POLL_ENABLED === "true";
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT || 993);
  const secure = process.env.IMAP_SECURE !== "false";
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  const mailbox = process.env.IMAP_MAILBOX || "INBOX";
  const pollIntervalMs = Number(process.env.IMAP_POLL_INTERVAL_MS || 60000);

  return { enabled, host, port, secure, user, pass, mailbox, pollIntervalMs };
}

function getAddress(addressList: any) {
  const first = addressList?.value?.[0];
  return {
    email: first?.address || "",
    name: first?.name || "",
  };
}

async function pollImapInbox() {
  if (isPolling) return;

  const config = getImapConfig();
  if (!config.enabled) return;
  if (!config.host || !config.user || !config.pass) {
    console.warn("IMAP polling enabled but IMAP_HOST, IMAP_USER/SMTP_USER, or IMAP_PASS/SMTP_PASS is missing.");
    return;
  }

  isPolling = true;
  console.log(`IMAP poll started for mailbox ${config.mailbox}.`);
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("IMAP connected.");
    const lock = await client.getMailboxLock(config.mailbox);

    try {
      const candidateUids = await client.search(
        { seen: false, header: { subject: "STALLY RFQ" } },
        { uid: true }
      );
      const candidateCount = candidateUids ? candidateUids.length : 0;
      console.log(`IMAP unread STALLY RFQ candidates: ${candidateCount}.`);

      if (!candidateUids || candidateUids.length === 0) {
        return;
      }

      for (const uid of candidateUids) {
        const message = await client.fetchOne(String(uid), { uid: true, envelope: true, source: true }, { uid: true });
        if (!message) {
          continue;
        }

        const messageUid = message.uid || uid;
        const subject = message.envelope?.subject || "";
        console.log(`IMAP processing candidate uid=${messageUid} subject=${subject}`);

        if (!subject.toLowerCase().includes("stally rfq")) {
          continue;
        }

        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source);

        const from = getAddress(parsed.from);

        if (from.email && from.email.toLowerCase() === config.user.toLowerCase()) {
          console.log(`IMAP skipped self-sent RFQ email uid=${messageUid}.`);
          await client.messageFlagsAdd(messageUid, ["\\Seen"], { uid: true });
          continue;
        }

        const firstAttachment = parsed.attachments?.[0];
        const result = await ingestInboundEmail({
          fromEmail: from.email,
          fromName: from.name,
          subject,
          bodyText: parsed.text || "",
          bodyHtml: typeof parsed.html === "string" ? parsed.html : undefined,
          fileName: firstAttachment?.filename,
          fileContentBase64: firstAttachment?.content?.toString("base64"),
          mimeType: firstAttachment?.contentType,
          sizeBytes: firstAttachment?.size,
          messageId: parsed.messageId || `imap-${messageUid}`,
          threadId: parsed.inReplyTo || parsed.messageId || `imap-thread-${messageUid}`,
          internetMessageId: parsed.messageId || undefined,
          inReplyTo: parsed.inReplyTo || undefined,
          references: Array.isArray(parsed.references)
            ? parsed.references
            : parsed.references
              ? [parsed.references]
              : undefined,
          receivedAt: parsed.date?.toISOString(),
        });

        await client.messageFlagsAdd(messageUid, ["\\Seen"], { uid: true });
        console.log(`IMAP inbound RFQ email processed: ${subject} -> case ${result.linkedCaseId}`);
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("IMAP polling failed:", err);
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore logout errors after failed connects.
    }
    isPolling = false;
  }
}

export function startImapPolling() {
  const config = getImapConfig();
  if (!config.enabled) {
    console.log("IMAP polling disabled. Set IMAP_POLL_ENABLED=true to read supplier replies.");
    return;
  }

  console.log(`IMAP polling enabled for ${config.user || "unknown mailbox"} every ${config.pollIntervalMs}ms.`);
  void pollImapInbox();
  pollTimer = setInterval(() => {
    void pollImapInbox();
  }, config.pollIntervalMs);
}

export function stopImapPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

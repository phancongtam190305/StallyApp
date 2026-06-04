import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ingestInboundEmail } from "./api_v1.js";
import { createTraceId, logFlow, maskEmail, safeError, subjectSummary, textSummary } from "./logger.js";

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
  if (isPolling) {
    logFlow("warn", "imap.poll.skipped_already_running");
    return;
  }

  const config = getImapConfig();
  if (!config.enabled) return;
  if (!config.host || !config.user || !config.pass) {
    logFlow("warn", "imap.poll.config_missing", {
      hostConfigured: Boolean(config.host),
      userConfigured: Boolean(config.user),
      passConfigured: Boolean(config.pass),
      mailbox: config.mailbox,
    });
    console.warn("IMAP polling enabled but IMAP_HOST, IMAP_USER/SMTP_USER, or IMAP_PASS/SMTP_PASS is missing.");
    return;
  }

  isPolling = true;
  const pollId = createTraceId("imap-poll");
  const pollStartedAt = Date.now();
  logFlow("info", "imap.poll.start", {
    pollId,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: maskEmail(config.user),
    mailbox: config.mailbox,
    pollIntervalMs: config.pollIntervalMs,
  });
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
    logFlow("info", "imap.connection.connected", {
      pollId,
      host: config.host,
      mailbox: config.mailbox,
      durationMs: Date.now() - pollStartedAt,
    });
    console.log("IMAP connected.");
    const lock = await client.getMailboxLock(config.mailbox);

    try {
      const rfqUids = await client.search(
        { seen: false, header: { subject: "STALLY RFQ" } },
        { uid: true }
      );
      const negUids = await client.search(
        { seen: false, header: { subject: "STALLY NEGOTIATION" } },
        { uid: true }
      );
      
      const rfqUidList = Array.isArray(rfqUids) ? rfqUids : [];
      const negUidList = Array.isArray(negUids) ? negUids : [];
      const candidateUids = Array.from(new Set([...rfqUidList, ...negUidList]));
      const candidateCount = candidateUids.length;
      logFlow("info", "imap.search.result", {
        pollId,
        mailbox: config.mailbox,
        rfqCount: rfqUidList.length,
        negotiationCount: negUidList.length,
        candidateCount,
        candidateUids,
      });
      console.log(`IMAP unread STALLY candidates count: ${candidateCount}.`);

      if (candidateCount === 0) {
        logFlow("info", "imap.poll.no_candidates", {
          pollId,
          durationMs: Date.now() - pollStartedAt,
        });
        return;
      }

      for (const uid of candidateUids) {
        const messageTraceId = createTraceId("imap-msg");
        const messageStartedAt = Date.now();
        const message = await client.fetchOne(String(uid), { uid: true, envelope: true, source: true }, { uid: true });
        if (!message) {
          logFlow("warn", "imap.message.fetch_missing", {
            pollId,
            messageTraceId,
            uid,
          });
          continue;
        }

        const messageUid = message.uid || uid;
        const subject = message.envelope?.subject || "";
        logFlow("info", "imap.message.fetched", {
          pollId,
          messageTraceId,
          uid: messageUid,
          subject: subjectSummary(subject),
          hasSource: Boolean(message.source),
        });
        
        const subjectUpper = subject.toUpperCase();
        const isRfq = subjectUpper.includes("STALLY RFQ");
        const isNeg = subjectUpper.includes("STALLY NEGOTIATION");

        if (!isRfq && !isNeg) {
          logFlow("info", "imap.message.skipped_subject", {
            pollId,
            messageTraceId,
            uid: messageUid,
            subject: subjectSummary(subject),
          });
          continue;
        }

        console.log(`IMAP processing candidate uid=${messageUid} subject=${subject}`);

        if (!message.source) {
          logFlow("warn", "imap.message.skipped_no_source", {
            pollId,
            messageTraceId,
            uid: messageUid,
            subject: subjectSummary(subject),
          });
          continue;
        }

        const parsed = await simpleParser(message.source);
        logFlow("info", "imap.message.parsed", {
          pollId,
          messageTraceId,
          uid: messageUid,
          subject: subjectSummary(subject),
          parsedSubject: subjectSummary(parsed.subject || subject),
          from: maskEmail(getAddress(parsed.from).email),
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          referencesCount: Array.isArray(parsed.references) ? parsed.references.length : parsed.references ? 1 : 0,
          attachmentCount: parsed.attachments?.length || 0,
          text: textSummary(parsed.text || ""),
        });

        const from = getAddress(parsed.from);

        if (from.email && from.email.toLowerCase() === config.user.toLowerCase()) {
          logFlow("warn", "imap.message.skipped_self_sent", {
            pollId,
            messageTraceId,
            uid: messageUid,
            fromEmail: maskEmail(from.email),
            imapUser: maskEmail(config.user),
            subject: subjectSummary(subject),
            messageId: parsed.messageId,
          });
          console.log(`IMAP skipped self-sent RFQ email uid=${messageUid}.`);
          try {
            await client.messageFlagsAdd(messageUid, ["\\Seen"], { uid: true });
            logFlow("info", "imap.message.mark_seen.success", {
              pollId,
              messageTraceId,
              uid: messageUid,
              reason: "self_sent",
            });
          } catch (err) {
            logFlow("error", "imap.message.mark_seen.failed", {
              pollId,
              messageTraceId,
              uid: messageUid,
              reason: "self_sent",
              err: safeError(err),
            });
            throw err;
          }
          continue;
        }

        const firstAttachment = parsed.attachments?.[0];
        const inboundPayload = {
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
        };
        logFlow("info", "imap.message.ingest.start", {
          pollId,
          messageTraceId,
          uid: messageUid,
          fromEmail: maskEmail(from.email),
          subject: subjectSummary(subject),
          messageId: inboundPayload.messageId,
          attachment: firstAttachment ? {
            fileName: firstAttachment.filename,
            mimeType: firstAttachment.contentType,
            sizeBytes: firstAttachment.size,
          } : undefined,
        });
        let result;
        try {
          result = await ingestInboundEmail(inboundPayload);
          logFlow("info", "imap.message.ingest.success", {
            pollId,
            messageTraceId,
            uid: messageUid,
            messageId: inboundPayload.messageId,
            linkedCaseId: result.linkedCaseId,
            linkedSupplierId: result.linkedSupplierId,
            emailMessageId: result.emailMessageId,
            durationMs: Date.now() - messageStartedAt,
          });
        } catch (err) {
          logFlow("error", "imap.message.ingest.failed", {
            pollId,
            messageTraceId,
            uid: messageUid,
            messageId: inboundPayload.messageId,
            fromEmail: maskEmail(from.email),
            subject: subjectSummary(subject),
            durationMs: Date.now() - messageStartedAt,
            err: safeError(err),
          });
          throw err;
        }

        try {
          await client.messageFlagsAdd(messageUid, ["\\Seen"], { uid: true });
          logFlow("info", "imap.message.mark_seen.success", {
            pollId,
            messageTraceId,
            uid: messageUid,
            reason: "processed",
            messageId: inboundPayload.messageId,
          });
        } catch (err) {
          logFlow("error", "imap.message.mark_seen.failed", {
            pollId,
            messageTraceId,
            uid: messageUid,
            reason: "processed",
            messageId: inboundPayload.messageId,
            err: safeError(err),
          });
          throw err;
        }
        console.log(`IMAP inbound email processed: ${subject} -> case ${result.linkedCaseId}`);
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    logFlow("error", "imap.poll.failed", {
      pollId,
      mailbox: config.mailbox,
      durationMs: Date.now() - pollStartedAt,
      err: safeError(err),
    });
    console.error("IMAP polling failed:", err);
  } finally {
    try {
      await client.logout();
      logFlow("info", "imap.connection.logout", {
        pollId,
        mailbox: config.mailbox,
      });
    } catch {
      // Ignore logout errors after failed connects.
    }
    isPolling = false;
    logFlow("info", "imap.poll.end", {
      pollId,
      mailbox: config.mailbox,
      durationMs: Date.now() - pollStartedAt,
    });
  }
}

export function startImapPolling() {
  const config = getImapConfig();
  if (!config.enabled) {
    logFlow("info", "imap.polling.disabled");
    console.log("IMAP polling disabled. Set IMAP_POLL_ENABLED=true to read supplier replies.");
    return;
  }

  logFlow("info", "imap.polling.enabled", {
    user: maskEmail(config.user),
    mailbox: config.mailbox,
    pollIntervalMs: config.pollIntervalMs,
  });
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

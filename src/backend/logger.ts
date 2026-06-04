import crypto from "node:crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY_RE = /(pass|password|secret|token|authorization|cookie|api[_-]?key|fileContentBase64|bodyHtml|html|editedBody|draftEmail)/i;
const MAX_STRING_LENGTH = 700;
const MAX_STACK_LENGTH = 1800;

function shouldEmit(level: LogLevel) {
  if (level !== "debug") return true;
  return process.env.STALLY_DEBUG_LOGS === "true";
}

function truncate(value: string, max = MAX_STRING_LENGTH) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...[truncated:${value.length - max}]`;
}

function sanitize(value: any, key = "", depth = 0): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (SENSITIVE_KEY_RE.test(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return safeError(value);
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (depth >= 4) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 30).map(item => sanitize(item, key, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 60)) {
      const safeValue = sanitize(childValue, childKey, depth + 1);
      if (safeValue !== undefined) out[childKey] = safeValue;
    }
    return out;
  }
  return String(value);
}

export function safeError(err: any) {
  if (!err) return undefined;
  return {
    name: err.name || "Error",
    code: err.code,
    message: err.message || String(err),
    stack: err.stack ? truncate(String(err.stack), MAX_STACK_LENGTH) : undefined,
  };
}

export function logFlow(level: LogLevel, event: string, fields: Record<string, any> = {}) {
  if (!shouldEmit(level)) return;

  const payload = sanitize({
    ts: new Date().toISOString(),
    level,
    service: "stally",
    event,
    ...fields,
  });

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createTraceId(prefix = "trace") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

export function shortHash(value: any) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 12);
}

export function maskEmail(email?: string) {
  const clean = String(email || "").trim().toLowerCase();
  const match = clean.match(/^([^@]+)@(.+)$/);
  if (!match) return clean || undefined;
  const local = match[1];
  const domain = match[2];
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > 2 ? "***" : "*"}@${domain}`;
}

export function maskEmails(input?: string | string[]) {
  const list = Array.isArray(input) ? input : String(input || "").split(",");
  return list.map(item => maskEmail(item)).filter(Boolean);
}

export function extractStallyCode(subject?: string) {
  const match = String(subject || "").match(/\[STALLY (RFQ|NEGOTIATION)-((?:case|rfq)-[a-z0-9-]+)\]/i);
  if (!match) return undefined;
  return {
    type: match[1].toLowerCase(),
    code: match[2].toLowerCase(),
  };
}

export function subjectSummary(subject?: string) {
  const clean = String(subject || "").replace(/\s+/g, " ").trim();
  return {
    text: truncate(clean, 180),
    hash: shortHash(clean),
    stallyCode: extractStallyCode(clean),
  };
}

export function textSummary(text?: string) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return {
    length: clean.length,
    hash: shortHash(clean),
    snippet: truncate(clean, 180),
  };
}

export function summarizeRequestBody(body: any) {
  if (!body || typeof body !== "object") return undefined;
  const summary: Record<string, any> = {
    keys: Object.keys(body).sort(),
  };

  for (const key of [
    "caseId",
    "rfqCaseId",
    "supplierId",
    "selectedQuoteId",
    "draftId",
    "role",
    "goal",
    "priority",
    "createdFrom",
  ]) {
    if (body[key] !== undefined) summary[key] = body[key];
  }

  if (Array.isArray(body.supplierIds)) summary.supplierIds = body.supplierIds;
  if (Array.isArray(body.draftIds)) summary.draftIds = body.draftIds;
  if (Array.isArray(body.items)) summary.itemsCount = body.items.length;
  if (body.subject) summary.subject = subjectSummary(body.subject);
  if (body.fromEmail) summary.fromEmail = maskEmail(body.fromEmail);
  if (body.to) summary.to = maskEmails(body.to);
  if (body.bodyText) summary.bodyText = textSummary(body.bodyText);
  if (body.fileName) summary.fileName = body.fileName;
  if (body.messageId) summary.messageId = body.messageId;
  if (body.internetMessageId) summary.internetMessageId = body.internetMessageId;

  return summary;
}

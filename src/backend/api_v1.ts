import express, { Router, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { dbState, ai } from "../../server.js";
import { persistDbState, persistUser, persistRecord, deleteRecord, persistRecords, db } from "./db.js";
import { sendRealEmail } from "./mailer.js";
import { createTraceId, logFlow, maskEmail, maskEmails, safeError, subjectSummary, textSummary } from "./logger.js";
import { buildSupplierFromCandidate, discoverSuppliers } from "./supplier_discovery.js";
import { 
  ProcurementCase, 
  CaseStatus, 
  CaseTransition, 
  EmailMessage, 
  EmailAttachment, 
  Quote, 
  QuoteVersion, 
  QuoteItem, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  InventoryItem, 
  StockMovement, 
  Supplier, 
  SupplierDiscoveryCandidate,
  UserRole,
  PriorityLevel,
  PurchaseRequestItem,
  AiNegotiationLog
} from "../types.js";

export const apiV1Router = Router();

interface AuthSession {
  userId: string;
  email: string;
  createdAt: number;
}

const authSessions = new Map<string, AuthSession>();
const oauthStates = new Map<string, number>();
const sessionCookieName = "stally_session";
const oauthStateCookieName = "stally_oauth_state";
const sessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_ENABLED === "true" &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
  );
}

function getGoogleOAuthConfigError() {
  if (process.env.GOOGLE_OAUTH_ENABLED !== "true") return "Google OAuth đang tắt.";
  if (!process.env.GOOGLE_CLIENT_ID) return "Thiếu GOOGLE_CLIENT_ID.";
  if (!process.env.GOOGLE_CLIENT_SECRET) return "Thiếu GOOGLE_CLIENT_SECRET.";
  if (!process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")) {
    return "GOOGLE_CLIENT_ID không hợp lệ. Client ID phải có dạng ...apps.googleusercontent.com.";
  }
  return "";
}

function isValidUserRole(role: string): role is UserRole {
  return ["requester", "procurement", "manager", "warehouse", "admin"].includes(role);
}

function isEmailAllowedForAutoProvision(email: string) {
  const rawAllowedDomains = process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS || "";
  const allowedDomains = rawAllowedDomains
    .split(",")
    .map(domain => domain.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0) return true;
  const emailDomain = email.split("@")[1]?.toLowerCase() || "";
  return allowedDomains.includes(emailDomain);
}

async function createAutoProvisionedGoogleUser(profile: any, orgId: string) {
  const email = String(profile.email || "").trim().toLowerCase();
  const defaultRoleRaw = process.env.GOOGLE_OAUTH_DEFAULT_ROLE || "requester";
  const role: UserRole = isValidUserRole(defaultRoleRaw) ? defaultRoleRaw : "requester";
  const displayName = String(profile.name || profile.given_name || email.split("@")[0] || "Google User").trim();
  const user = {
    id: `u-google-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    organizationId: orgId,
    email,
    name: displayName,
    role,
    status: "active" as const,
  };

  dbState.users.push(user);
  try {
    await persistUser(user);
  } catch (err) {
    console.error("Failed to persist auto-provisioned Google user:", err);
    dbState.users = dbState.users.filter(existingUser => existingUser.id !== user.id);
    throw new Error("Không lưu được user Google mới vào Supabase.");
  }

  return user;
}

function getCookie(req: Request, name: string) {
  const cookies = req.headers.cookie || "";
  const found = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function setCookie(res: Response, name: string, value: string, maxAgeMs: number, httpOnly = true) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const httpOnlyPart = httpOnly ? "; HttpOnly" : "";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; SameSite=Lax${httpOnlyPart}${secure}`
  );
}

function clearCookie(res: Response, name: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`);
}

function getRequestOrigin(req: Request) {
  const configuredAppUrl = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL"
    ? process.env.APP_URL.replace(/\/$/, "")
    : "";
  if (configuredAppUrl) return configuredAppUrl;

  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getGoogleRedirectUri(req: Request) {
  return process.env.GOOGLE_REDIRECT_URI || `${getRequestOrigin(req)}/api/v1/auth/google/callback`;
}

function getFrontendRedirectUrl(req: Request, status: "success" | "error", message?: string) {
  const configuredFrontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
  const baseUrl = configuredFrontendUrl || getRequestOrigin(req);
  const url = new URL(baseUrl);
  url.searchParams.set("oauth", status);
  if (message) url.searchParams.set("message", message);
  return url.toString();
}

function createAuthSession(res: Response, user: any) {
  const token = crypto.randomBytes(32).toString("base64url");
  authSessions.set(token, {
    userId: user.id,
    email: user.email,
    createdAt: Date.now(),
  });
  setCookie(res, sessionCookieName, token, sessionMaxAgeMs);
}

function getSessionUser(req: Request) {
  const token = getCookie(req, sessionCookieName);
  if (!token) return null;

  const session = authSessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > sessionMaxAgeMs) {
    authSessions.delete(token);
    return null;
  }

  return dbState.users.find(
    u => u.id === session.userId &&
      u.email.toLowerCase() === session.email.toLowerCase() &&
      u.organizationId === req.organizationId &&
      u.status === "active"
  ) || null;
}

// ----------------------------------------------------
// STATE MACHINE TRANSITION ENGINE (Strict transition logic)
// ----------------------------------------------------
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  "draft_request": ["request_submitted", "request_validating", "cancelled"],
  "request_submitted": ["request_validating", "cancelled"],
  "request_validating": ["supplier_matching", "exception", "cancelled"],
  "supplier_matching": ["rfq_draft", "cancelled"],
  "rfq_draft": ["rfq_sent", "cancelled"],
  "rfq_sent": ["collecting_quotes", "cancelled"],
  "collecting_quotes": ["quote_review", "cancelled"],
  "quote_review": ["comparison_ready", "negotiating", "cancelled"],
  "comparison_ready": ["negotiating", "pending_approval", "cancelled"],
  "negotiating": ["comparison_ready", "pending_approval", "cancelled"],
  "pending_approval": ["approved", "negotiating", "cancelled"],
  "approved": ["po_draft", "cancelled"],
  "po_draft": ["po_sent", "cancelled"],
  "po_sent": ["receiving", "cancelled"],
  "receiving": ["closed", "exception", "cancelled"],
  "closed": [],
  "cancelled": [],
  "exception": ["receiving", "closed", "cancelled"]
};

interface TransitionInput {
  caseId: string;
  toStatus: CaseStatus;
  actorId: string;
  actorRole: UserRole;
  reason?: string;
  orgId: string;
}

export function transitionCaseStatus(input: TransitionInput): ProcurementCase {
  const { caseId, toStatus, actorId, actorRole, reason, orgId } = input;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    logFlow("warn", "case.transition.not_found", {
      caseId,
      toStatus,
      actorId,
      actorRole,
      orgId,
      reason,
    });
    throw new Error("Không tìm thấy Procurement Case.");
  }
  
  const fromStatus = caseObj.status;
  const traceId = createTraceId("case");
  logFlow("info", "case.transition.request", {
    traceId,
    caseId,
    fromStatus,
    toStatus,
    actorId,
    actorRole,
    orgId,
    reason,
  });
  
  // Guard transitions
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus) && toStatus !== "cancelled") {
    logFlow("warn", "case.transition.rejected", {
      traceId,
      caseId,
      fromStatus,
      toStatus,
      allowed,
      actorId,
      actorRole,
      orgId,
      reason,
    });
    throw new Error(`Bước chuyển trạng thái từ '${fromStatus}' sang '${toStatus}' không được phép.`);
  }
  
  // Mutate State
  caseObj.status = toStatus;
  caseObj.updatedAt = new Date().toISOString();
  if (toStatus === "closed") {
    caseObj.closedAt = new Date().toISOString();
  }

  // Create Audit Event
  const transitionLog: CaseTransition = {
    id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    caseId,
    fromStatus,
    toStatus,
    actorId,
    actorRole,
    reason: reason || `Cập nhật trạng thái từ hệ thống`,
    createdAt: new Date().toISOString()
  };
  
  dbState.case_transitions.push(transitionLog);
  logFlow("info", "case.transition.committed", {
    traceId,
    transitionId: transitionLog.id,
    caseId,
    fromStatus,
    toStatus,
    actorId,
    actorRole,
    orgId,
    reason: transitionLog.reason,
  });
  
  // Broadcast Realtime SSE Event
  broadcastRealtimeEvent("case.updated", caseId, { fromStatus, toStatus, actorId, reason });
  
  // Persist State incrementally to Database
  Promise.all([
    persistRecord("procurement_cases", caseObj),
    persistRecord("case_transitions", transitionLog)
  ]).catch((err) => {
    logFlow("error", "case.transition.persist_failed", {
      traceId,
      transitionId: transitionLog.id,
      caseId,
      fromStatus,
      toStatus,
      err: safeError(err),
    });
    console.error("Failed to incrementally persist transition:", err);
  });
  
  return caseObj;
}

// ----------------------------------------------------
// REALTIME EVENT SYSTEM (Server-Sent Events)
// ----------------------------------------------------
interface SseConnection {
  id: string;
  res: Response;
  orgId: string;
}

let activeSseClients: SseConnection[] = [];

export function broadcastRealtimeEvent(type: string, caseId: string, payload: any) {
  const eventString = `data: ${JSON.stringify({ type, caseId, payload, createdAt: new Date().toISOString() })}\n\n`;
  activeSseClients.forEach(client => {
    try {
      client.res.write(eventString);
    } catch (e) {
      // Clean up failed write
    }
  });
}

apiV1Router.get("/events/stream", (req: Request, res: Response) => {
  const orgId = (req.headers["x-organization-id"] as string) || "org-1";
  
  // SSE writeHead bypasses Express CORS middleware, so we add headers explicitly
  const origin = req.headers.origin as string | undefined;
  const allowedOrigins = [
    process.env.FRONTEND_URL || "https://stally-app.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ];
  
  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  };
  
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  
  res.writeHead(200, headers);
  
  const clientId = Date.now().toString();
  const newClient: SseConnection = { id: clientId, res, orgId };
  activeSseClients.push(newClient);
  
  // Send initial event
  res.write(`data: ${JSON.stringify({ type: "connection.established", message: "Đồng bộ realtime Stally" })}\n\n`);
  
  req.on("close", () => {
    activeSseClients = activeSseClients.filter(c => c.id !== clientId);
  });
});

// ----------------------------------------------------
// AUTH & PERMISSIONS MOCK
// ----------------------------------------------------
apiV1Router.get("/auth/config", (_req: Request, res: Response) => {
  res.json({
    data: {
      emailRoleAuthEnabled: process.env.EMAIL_ROLE_AUTH_ENABLED === "true",
      googleOAuthEnabled: isGoogleOAuthConfigured(),
      googleOAuthAutoProvisionEnabled: process.env.GOOGLE_OAUTH_AUTO_PROVISION === "true",
      googleOAuthAllowedDomains: (process.env.GOOGLE_OAUTH_ALLOWED_DOMAINS || "")
        .split(",")
        .map(domain => domain.trim())
        .filter(Boolean),
    }
  });
});

apiV1Router.get("/auth/session", (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ data: null, authenticated: false });
  }
  res.json({ data: user, authenticated: true, authMode: "google_oauth" });
});

apiV1Router.post("/auth/logout", (req: Request, res: Response) => {
  const token = getCookie(req, sessionCookieName);
  if (token) authSessions.delete(token);
  clearCookie(res, sessionCookieName);
  res.json({ message: "Đã đăng xuất." });
});

apiV1Router.get("/auth/google/start", (req: Request, res: Response) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(503).json({
      error: { code: "GOOGLE_OAUTH_DISABLED", message: getGoogleOAuthConfigError() || "Google OAuth chưa được cấu hình." }
    });
  }

  const state = crypto.randomBytes(24).toString("base64url");
  oauthStates.set(state, Date.now());
  setCookie(res, oauthStateCookieName, state, 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: getGoogleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

apiV1Router.get("/auth/google/callback", async (req: Request, res: Response) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(getFrontendRedirectUrl(req, "error", getGoogleOAuthConfigError() || "Google OAuth chưa được cấu hình."));
  }

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const cookieState = getCookie(req, oauthStateCookieName);
  clearCookie(res, oauthStateCookieName);

  const stateCreatedAt = oauthStates.get(state);
  oauthStates.delete(state);

  if (!code || !state || !cookieState || state !== cookieState || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60 * 1000) {
    return res.redirect(getFrontendRedirectUrl(req, "error", "Phiên đăng nhập Google không hợp lệ."));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Không đổi được Google OAuth code.");
    }

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileRes.json();
    if (!profileRes.ok || !profile.email) {
      throw new Error("Không lấy được Google profile.");
    }
    if (profile.email_verified === false) {
      throw new Error("Email Google chưa được xác minh.");
    }

    const email = String(profile.email).trim().toLowerCase();
    let user = dbState.users.find(
      u => u.organizationId === req.organizationId && u.email.toLowerCase() === email && u.status === "active"
    );

    if (!user) {
      const autoProvisionEnabled = process.env.GOOGLE_OAUTH_AUTO_PROVISION === "true";
      if (!autoProvisionEnabled) {
        return res.redirect(getFrontendRedirectUrl(req, "error", "Email Google này chưa được cấp quyền trong Stally."));
      }
      if (!isEmailAllowedForAutoProvision(email)) {
        return res.redirect(getFrontendRedirectUrl(req, "error", "Domain email này chưa được phép tự đăng ký."));
      }
      user = await createAutoProvisionedGoogleUser(profile, req.organizationId);
    }

    createAuthSession(res, user);
    return res.redirect(getFrontendRedirectUrl(req, "success"));
  } catch (err: any) {
    console.error("Google OAuth callback failed:", err);
    return res.redirect(getFrontendRedirectUrl(req, "error", err.message || "Đăng nhập Google thất bại."));
  }
});

apiV1Router.get("/me", (req: Request, res: Response) => {
  const emailRoleAuthEnabled = process.env.EMAIL_ROLE_AUTH_ENABLED === "true";
  const requestedEmail = String(req.query.email || "").trim().toLowerCase();
  const requestedRole = (req.query.role as UserRole) || "procurement";

  if (emailRoleAuthEnabled) {
    const sessionUser = getSessionUser(req);
    if (sessionUser) {
      return res.json({ data: sessionUser, authMode: "google_oauth" });
    }

    if (!requestedEmail) {
      return res.status(401).json({
        error: { code: "EMAIL_REQUIRED", message: "Cần email để xác định phân quyền." }
      });
    }

    const user = dbState.users.find(
      u => u.organizationId === req.organizationId && u.email.toLowerCase() === requestedEmail && u.status === "active"
    );
    if (!user) {
      return res.status(403).json({
        error: { code: "USER_NOT_ALLOWED", message: "Email này chưa được cấp quyền trong hệ thống." }
      });
    }
    return res.json({ data: user, authMode: "email" });
  }

  const user = dbState.users.find(u => u.role === requestedRole && u.organizationId === req.organizationId) || dbState.users[0];
  res.json({ data: user, authMode: "role_switch" });
});

apiV1Router.get("/permissions", (req: Request, res: Response) => {
  const role = (req.query.role as UserRole) || "procurement";
  const permissions = 
    role === "admin" ? ["case:create", "case:view", "case:update", "case:submit", "supplier:view", "supplier:manage", "supplier:match", "rfq:draft", "rfq:send", "email:view", "email:send", "quote:view", "quote:review", "quote:negotiate", "approval:request", "approval:decide", "po:draft", "po:send", "inventory:view", "inventory:receive", "inventory:adjust", "admin:manage_users"] :
    role === "manager" ? ["case:view", "case:update", "supplier:view", "quote:view", "approval:decide", "po:draft", "po:send", "inventory:view"] :
    role === "procurement" ? ["case:create", "case:view", "case:update", "case:submit", "supplier:view", "supplier:manage", "supplier:match", "rfq:draft", "rfq:send", "email:view", "email:send", "quote:view", "quote:review", "quote:negotiate", "approval:request", "po:draft", "po:send", "inventory:view"] :
    role === "warehouse" ? ["case:view", "inventory:view", "inventory:receive", "inventory:adjust"] :
    ["case:create", "case:view", "case:update", "case:submit", "inventory:view"]; // requester
  res.json({ data: permissions });
});

// ----------------------------------------------------
// CASES & ITEMS MANAGEMENT APIs
// ----------------------------------------------------
apiV1Router.get("/cases", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const statusFilter = req.query.status as string;
  
  let cases = dbState.procurement_cases.filter(c => c.organizationId === orgId);
  if (statusFilter) {
    cases = cases.filter(c => c.status === statusFilter);
  }
  
  res.json({
    data: cases,
    pagination: { page: 1, limit: 100, total: cases.length }
  });
});

apiV1Router.get("/cases/:caseId", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  res.json({ data: caseObj });
});

apiV1Router.post("/cases", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { title, priority, requiredDate, departmentId, items, createdFrom, requesterId, requesterName } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Yêu cầu có ít nhất 1 sản phẩm" } });
  }
  
  const caseId = `case-${Date.now()}`;
  const prId = `pr-${Date.now()}`;
  
  const newPR = {
    id: prId,
    organizationId: orgId,
    requesterId: requesterId || "u-2",
    requesterName: requesterName || "Trần Văn Bình (Bếp Trưởng)",
    departmentName: departmentId || "Bộ phận Bếp",
    title: title || `Phiếu nhu cầu mua sắm nguyên liệu`,
    status: "submitted" as const,
    priority: priority || "medium",
    requiredDate: requiredDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: items.map((it: any) => ({
      name: it.name,
      quantity: Number(it.quantity),
      unit: it.unit || "đv",
      notes: it.notes || ""
    })),
    source: (createdFrom || "web") as "web" | "email",
    createdAt: new Date().toISOString()
  };
  
  const newCase: ProcurementCase = {
    id: caseId,
    organizationId: orgId,
    title: newPR.title,
    status: "draft_request",
    priority: priority || "medium",
    createdFrom: createdFrom || "web",
    requesterId: newPR.requesterId,
    requesterName: newPR.requesterName,
    requesterDepartmentId: departmentId || "dept_kitchen",
    departmentName: newPR.departmentName,
    requiredDate: newPR.requiredDate,
    requestId: prId,
    items: newPR.items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  dbState.purchase_requests.push(newPR);
  dbState.procurement_cases.push(newCase);
  
  // Transition log
  transitionCaseStatus({
    caseId,
    toStatus: "request_submitted",
    actorId: newPR.requesterId,
    actorRole: "requester",
    reason: "Khởi tạo và gửi yêu cầu mua sắm lên Procurement",
    orgId
  });
  
  res.status(201).json({ data: newCase });
});

apiV1Router.patch("/cases/:caseId", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { title, priority, requiredDate } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  if (title) caseObj.title = title;
  if (priority) caseObj.priority = priority;
  if (requiredDate) caseObj.requiredDate = requiredDate;
  caseObj.updatedAt = new Date().toISOString();
  
  res.json({ data: caseObj });
});

apiV1Router.post("/cases/:caseId/submit", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { reason, role } = req.body;
  
  try {
    // First transition to request_validating
    transitionCaseStatus({
      caseId,
      toStatus: "request_validating",
      actorId: "u-1",
      actorRole: (role || "procurement") as UserRole,
      reason: reason || "Nhân viên thu mua phê duyệt chuyển tiếp",
      orgId
    });
    
    // Immediately auto-transition to supplier_matching (synchronous, no setTimeout race condition)
    let finalCase;
    try {
      finalCase = transitionCaseStatus({
        caseId,
        toStatus: "supplier_matching",
        actorId: "u-1",
        actorRole: "procurement",
        reason: "Hệ thống hoàn tất chuẩn hóa dữ liệu yêu cầu",
        orgId
      });
    } catch (e) {
      console.error("Auto-transition to supplier_matching failed:", e);
      // Fallback: return case in request_validating status
      finalCase = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
    }
    
    res.json({ data: finalCase });
  } catch (err: any) {
    res.status(400).json({ error: { code: "TRANSITION_ERROR", message: err.message } });
  }
});

apiV1Router.post("/cases/:caseId/cancel", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { reason } = req.body;
  
  try {
    const updated = transitionCaseStatus({
      caseId,
      toStatus: "cancelled",
      actorId: "u-1",
      actorRole: "procurement",
      reason: reason || "Đã hủy bỏ case này",
      orgId
    });
    res.json({ data: updated });
  } catch (err: any) {
    res.status(400).json({ error: { code: "TRANSITION_ERROR", message: err.message } });
  }
});

apiV1Router.get("/cases/:caseId/timeline", (req: Request, res: Response) => {
  const { caseId } = req.params;
  const timeline = dbState.case_transitions.filter(t => t.caseId === caseId);
  res.json({ data: timeline });
});

apiV1Router.get("/cases/:caseId/audit-logs", (req: Request, res: Response) => {
  const { caseId } = req.params;
  const logs = dbState.case_transitions.filter(t => t.caseId === caseId);
  res.json({ data: logs });
});

// ----------------------------------------------------
// PURCHASE REQUEST ITEMS MUTATIONS
// ----------------------------------------------------
apiV1Router.patch("/cases/:caseId/request", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { items } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  if (items) {
    caseObj.items = items.map((it: any) => ({
      name: it.name,
      quantity: Number(it.quantity),
      unit: it.unit,
      notes: it.notes || ""
    }));
    caseObj.updatedAt = new Date().toISOString();
  }
  
  res.json({ data: caseObj });
});

apiV1Router.post("/cases/:caseId/items", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { name, quantity, unit, notes } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  caseObj.items.push({
    name,
    quantity: Number(quantity),
    unit,
    notes: notes || ""
  });
  caseObj.updatedAt = new Date().toISOString();
  res.json({ data: caseObj });
});

apiV1Router.patch("/cases/:caseId/items/:itemIndex", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId, itemIndex } = req.params;
  const { name, quantity, unit, notes } = req.body;
  const idx = Number(itemIndex);
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj || !caseObj.items[idx]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy sản phẩm" } });
  }
  
  if (name) caseObj.items[idx].name = name;
  if (quantity) caseObj.items[idx].quantity = Number(quantity);
  if (unit) caseObj.items[idx].unit = unit;
  if (notes !== undefined) caseObj.items[idx].notes = notes;
  caseObj.updatedAt = new Date().toISOString();
  
  res.json({ data: caseObj });
});

apiV1Router.delete("/cases/:caseId/items/:itemIndex", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId, itemIndex } = req.params;
  const idx = Number(itemIndex);
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj || !caseObj.items[idx]) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy mặt hàng" } });
  }
  
  caseObj.items.splice(idx, 1);
  caseObj.updatedAt = new Date().toISOString();
  res.json({ data: caseObj });
});

// ----------------------------------------------------
// SUPPLIER MATCHING & CRM APIs
// ----------------------------------------------------
type SupplierMatchResult = {
  supplierId: string;
  name: string;
  email: string;
  rating: number;
  tags: string[];
  source: string;
  score: number;
  reasons: string[];
  riskFlags: string[];
  rerankedBy?: "llm";
};

const handleSupplierMatchesList = async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const normalizeMatchText = (value: string) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  const requestText = normalizeMatchText(caseObj.items
    .map(it => `${it.name} ${it.unit} ${it.notes || ""}`)
    .join(" "));
  const requestTokens = Array.from(new Set(requestText.split(/[^a-z0-9]+/).filter(token => token.length >= 3)));
  
  const matches: SupplierMatchResult[] = dbState.suppliers
    .filter(s => s.organizationId === orgId)
    .map(sup => {
      let score = 35;
      const supplierText = normalizeMatchText([
        sup.name,
        sup.contactPerson,
        sup.email,
        sup.address,
        sup.tags.join(" "),
        sup.historicalPricing || "",
        sup.source || ""
      ].join(" "));
      const matchedTags: string[] = [];
      const matchedTokens = requestTokens.filter(token => supplierText.includes(token));
      
      sup.tags.forEach(tag => {
        const normalizedTag = normalizeMatchText(tag);
        const matchesTag = requestText.includes(normalizedTag) || requestTokens.some(token => normalizedTag.includes(token));
        if (matchesTag) {
          matchedTags.push(tag);
          score += 18;
        }
      });

      score += Math.min(24, matchedTokens.length * 6);
      
      score += Math.round((sup.rating - 3.0) * 10);
      if (sup.historicalPricing) score += 8;
      if (sup.source === "crm" || sup.source === "manual") score += 6;
      if (sup.email) score += 3;
      if (sup.phone) score += 3;
      
      score = Math.min(99, Math.max(15, score));
      
      const reasons: string[] = [];
      if (matchedTags.length > 0) reasons.push(`Khớp danh mục: ${matchedTags.slice(0, 3).join(", ")}`);
      if (matchedTokens.length > 0) reasons.push(`Khớp từ khóa yêu cầu: ${matchedTokens.slice(0, 4).join(", ")}`);
      if (sup.historicalPricing) reasons.push("Có lịch sử báo giá/ghi chú mua hàng trong CRM");
      if (sup.rating >= 4.5) reasons.push(`Đánh giá NCC cao: ${sup.rating}/5.0`);
      if (reasons.length === 0) reasons.push("Có trong danh bạ NCC nhưng mức khớp mặt hàng còn thấp");
      
      return {
        supplierId: sup.id,
        name: sup.name,
        email: sup.email,
        rating: sup.rating,
        tags: sup.tags,
        source: sup.source || "crm",
        score,
        reasons,
        riskFlags: [
          ...(score < 50 ? ["Mức khớp thấp, cần kiểm tra thủ công"] : []),
          ...(sup.source === "discovered" || sup.source === "crawled" ? ["NCC mới/crawl, cần xác minh trước khi gửi thật"] : [])
        ]
      };
    })
    .sort((a, b) => b.score - a.score);

  let finalMatches: SupplierMatchResult[] = matches;
  const rerankParam = String(req.query.rerank || "true").toLowerCase();
  const rerankEnabled = process.env.SUPPLIER_MATCH_LLM_RERANK_ENABLED !== "false" && rerankParam !== "false";
  if (ai && rerankEnabled && matches.length > 1) {
    const topCandidates = matches.slice(0, 10);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Bạn là chuyên gia mua hàng B2B. Hãy rerank danh sách nhà cung cấp CÓ SẴN cho yêu cầu mua hàng bên dưới.

YÊU CẦU MUA:
${caseObj.items.map((item, index) => `${index + 1}. ${item.name} - ${item.quantity} ${item.unit}${item.notes ? ` - ghi chú: ${item.notes}` : ""}`).join("\n")}

DANH SÁCH ỨNG VIÊN:
${topCandidates.map((item, index) => `${index + 1}. supplierId=${item.supplierId}
Tên: ${item.name}
Email: ${item.email}
Rating: ${item.rating || 0}
Nguồn: ${item.source || "crm"}
Tags: ${(item.tags || []).join(", ")}
Rule score: ${item.score}
Rule reasons: ${item.reasons.join(" | ")}
Rule risks: ${item.riskFlags.join(" | ") || "không có"}`).join("\n\n")}

QUY TẮC:
- Chỉ được chọn/rerank trong danh sách supplierId đã cho, không bịa NCC mới.
- Chấm score 0-100 theo độ phù hợp mặt hàng, năng lực, dữ liệu lịch sử, rủi ro xác minh.
- Nếu thông tin thiếu, thêm risk flag.
- Trả về JSON array thuần, không markdown, mỗi phần tử:
[
  {
    "supplierId": "id",
    "score": 0-100,
    "reasons": ["lý do cụ thể"],
    "riskFlags": ["rủi ro cần kiểm tra"]
  }
]`
      });
      const text = response.text?.trim() || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const reranked: any[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      const byId = new Map(matches.map(item => [item.supplierId, item]));
      const usedIds = new Set<string>();
      const llmMatches = reranked.reduce<SupplierMatchResult[]>((acc, item: any) => {
          const existing = byId.get(String(item.supplierId || ""));
          if (!existing) return acc;
          usedIds.add(existing.supplierId);
          const nextScore = Number(item.score);
          acc.push({
            ...existing,
            score: Number.isFinite(nextScore) ? Math.min(99, Math.max(0, Math.round(nextScore))) : existing.score,
            reasons: Array.isArray(item.reasons) && item.reasons.length ? item.reasons.slice(0, 4).map(String) : existing.reasons,
            riskFlags: Array.isArray(item.riskFlags)
              ? Array.from(new Set([...existing.riskFlags, ...item.riskFlags.map(String)])).slice(0, 4)
              : existing.riskFlags,
            rerankedBy: "llm"
          });
          return acc;
        }, []);
      finalMatches = [
        ...llmMatches.sort((a: any, b: any) => b.score - a.score),
        ...matches.filter(item => !usedIds.has(item.supplierId))
      ];
      logFlow("info", "supplier.matches.llm_rerank.success", {
        traceId: req.traceId || createTraceId("supplier-matches"),
        caseId,
        orgId,
        candidateCount: topCandidates.length,
        rerankedCount: llmMatches.length,
      });
    } catch (err: any) {
      logFlow("warn", "supplier.matches.llm_rerank.failed", {
        traceId: req.traceId || createTraceId("supplier-matches"),
        caseId,
        orgId,
        error: safeError(err),
      });
      finalMatches = matches;
    }
  }
    
  logFlow("info", "supplier.matches.list", {
    traceId: req.traceId || createTraceId("supplier-matches"),
    caseId,
    orgId,
    method: req.method,
    matchesCount: finalMatches.length,
    rerankEnabled: Boolean(ai && rerankEnabled),
  });

  res.json({ data: finalMatches });
};

apiV1Router.get("/cases/:caseId/supplier-matches", handleSupplierMatchesList);
apiV1Router.post("/cases/:caseId/supplier-matches", handleSupplierMatchesList);

apiV1Router.post("/cases/:caseId/suppliers/select", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { supplierIds } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  // Transition to rfq_draft phase if not already there
  if (caseObj.status !== "rfq_draft") {
    transitionCaseStatus({
      caseId,
      toStatus: "rfq_draft",
      actorId: "u-1",
      actorRole: "procurement",
      reason: `Đã chọn các NCC gửi thư thầu: ${supplierIds.join(", ")}`,
      orgId
    });
  } else {
    // Just update timestamp if already in rfq_draft
    caseObj.updatedAt = new Date().toISOString();
    persistRecord("procurement_cases", caseObj).catch(() => {});
  }
  
  res.json({ message: "Đã chọn nhà cung cấp gửi báo giá thầu", data: caseObj });
});

apiV1Router.post("/cases/:caseId/suppliers/discover", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { query, limit, dryRun } = req.body;
  const traceId = req.traceId || createTraceId("supplier-discovery");
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }

  const cleanText = (val: any) => String(val || "").replace(/\s+/g, " ").trim();
  const normalizedQuery = cleanText(query).toLowerCase();
  const effectiveLimit = Number(limit) || 5;
  const DISCOVERY_CACHE_VERSION = "supplier-discovery-v2";

  logFlow("info", "supplier.discovery.requested", {
    traceId,
    caseId,
    orgId,
    queryLength: cleanText(query).length,
    limit: effectiveLimit,
    dryRun: Boolean(dryRun),
    alreadyScanning: Boolean(caseObj.isScanning),
  });

  if (caseObj.isScanning) {
    logFlow("info", "supplier.discovery.already_running", {
      traceId,
      caseId,
      orgId,
    });

    return res.json({
      status: "processing",
      alreadyRunning: true,
      message: "Đang có một lần tìm kiếm nhà cung cấp đang chạy nền..."
    });
  }

  // Check Cache Hit
  const cache = (dbState.discovery_caches || []).find((c: any) => 
    c.organizationId === orgId && 
    cleanText(c.query).toLowerCase() === normalizedQuery
  );

  const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (cache && (Date.now() - new Date(cache.createdAt).getTime() < CACHE_EXPIRY_MS)) {
    try {
      console.log(`Cache HIT for query="${query}" under organizationId="${orgId}"`);
      const cachedPayload = JSON.parse(cache.results);
      if (!cachedPayload || cachedPayload.version !== DISCOVERY_CACHE_VERSION || !Array.isArray(cachedPayload.candidates)) {
        throw new Error("Stale supplier discovery cache version.");
      }
      const candidates = cachedPayload.candidates;
      const now = new Date().toISOString();
      const storedCandidates: SupplierDiscoveryCandidate[] = candidates.map((candidate: any, index: number) => ({
        id: `supdisc-${Date.now()}-${index}`,
        organizationId: orgId,
        caseId,
        query,
        name: candidate.name,
        contactPerson: candidate.contactPerson || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
        address: candidate.address || "",
        website: candidate.website || "",
        tags: candidate.tags || [],
        sourceUrls: candidate.sourceUrls || [],
        evidence: candidate.evidence || "",
        confidence: candidate.confidence || 0,
        riskFlags: candidate.riskFlags || [],
        autoAddEligible: candidate.autoAddEligible !== undefined ? candidate.autoAddEligible : true,
        duplicateOfSupplierId: candidate.duplicateOfSupplierId || undefined,
        status: "review",
        createdAt: now,
      }));

      logFlow("info", "supplier.discovery.cache_hit", {
        traceId,
        caseId,
        orgId,
        candidatesCount: storedCandidates.length,
        dryRun: Boolean(dryRun),
      });

      if (!dryRun) {
        dbState.supplier_discovery_candidates = (dbState.supplier_discovery_candidates || [])
          .filter((candidate: SupplierDiscoveryCandidate) => !(candidate.caseId === caseId && candidate.query === query && candidate.status === "review"));
        dbState.supplier_discovery_candidates.push(...storedCandidates);
        
        // Incremental save cache hit
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM "supplier_discovery_candidates" WHERE "caseId" = $1 AND "query" = $2 AND "status" = $3`, [caseId, query, "review"]);
          for (const candidate of storedCandidates) {
            await persistRecord("supplier_discovery_candidates", candidate, client);
          }
          await client.query("COMMIT");
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      }

      return res.json({
        message: "Đã tải danh sách nhà cung cấp từ bộ nhớ đệm!",
        candidates: dryRun ? candidates : storedCandidates,
        cached: true,
        summary: {
          totalCandidates: storedCandidates.length,
          addedCount: 0,
          reviewRequiredCount: storedCandidates.length,
          dryRun: Boolean(dryRun),
        }
      });
    } catch (cacheErr: any) {
      console.warn("Failed to parse cache results, proceeding with live discovery:", cacheErr);
    }
  }

  // Cache Miss or Expired: Set scanning flag and Return processing status immediately to client
  caseObj.isScanning = true;
  persistRecord("procurement_cases", caseObj).catch((err) => {
    logFlow("error", "supplier.discovery.scan_flag_persist_failed", {
      traceId,
      caseId,
      orgId,
      err: safeError(err),
    });
  });

  res.json({
    status: "processing",
    message: "Đang tiến hành tìm kiếm nhà cung cấp bằng AI dưới nền..."
  });

  // Launch background asynchronous task (Promise without await)
  (async () => {
    const startedAt = Date.now();
    try {
      logFlow("info", "supplier.discovery.started", {
        traceId,
        caseId,
        orgId,
        limit: effectiveLimit,
        dryRun: Boolean(dryRun),
      });
      console.log(`Background AI supplier discovery started. case=${caseId} query="${query}"`);
      const candidates = await discoverSuppliers(ai, {
        query,
        orgId,
        caseObj,
        existingSuppliers: dbState.suppliers.filter(s => s.organizationId === orgId),
        limit: effectiveLimit,
      });

      const nowStr = new Date().toISOString();
      const cleanQuery = cleanText(query).toLowerCase();
      
      if (!dbState.discovery_caches) {
        dbState.discovery_caches = [];
      }

      // Save cache entry
      const existingCacheIdx = dbState.discovery_caches.findIndex((c: any) =>
        c.organizationId === orgId &&
        cleanText(c.query).toLowerCase() === cleanQuery
      );

      const newCacheRecord = {
        id: existingCacheIdx >= 0 ? dbState.discovery_caches[existingCacheIdx].id : `cache-${Date.now()}`,
        organizationId: orgId,
        query,
        results: JSON.stringify({ version: DISCOVERY_CACHE_VERSION, candidates }),
        createdAt: nowStr
      };

      if (existingCacheIdx >= 0) {
        dbState.discovery_caches[existingCacheIdx] = newCacheRecord;
      } else {
        dbState.discovery_caches.push(newCacheRecord);
      }

      // Map candidates to storedCandidates
      const storedCandidates: SupplierDiscoveryCandidate[] = candidates.map((candidate, index) => ({
        id: `supdisc-${Date.now()}-${index}`,
        organizationId: orgId,
        caseId,
        query,
        name: candidate.name,
        contactPerson: candidate.contactPerson || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
        address: candidate.address || "",
        website: candidate.website || "",
        tags: candidate.tags || [],
        sourceUrls: candidate.sourceUrls || [],
        evidence: candidate.evidence || "",
        confidence: candidate.confidence || 0,
        riskFlags: candidate.riskFlags || [],
        autoAddEligible: candidate.autoAddEligible !== undefined ? candidate.autoAddEligible : true,
        duplicateOfSupplierId: candidate.duplicateOfSupplierId || undefined,
        status: "review",
        createdAt: nowStr,
      }));

      if (!dryRun) {
        dbState.supplier_discovery_candidates = (dbState.supplier_discovery_candidates || [])
          .filter((candidate: SupplierDiscoveryCandidate) => !(candidate.caseId === caseId && candidate.query === query && candidate.status === "review"));
        dbState.supplier_discovery_candidates.push(...storedCandidates);
      }

      // Reset scanning flag
      caseObj.isScanning = false;

      // Incremental transactional save discovery results
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await persistRecord("procurement_cases", caseObj, client);
        if (newCacheRecord) {
          await persistRecord("discovery_caches", newCacheRecord, client);
        }
        if (!dryRun) {
          await client.query(`DELETE FROM "supplier_discovery_candidates" WHERE "caseId" = $1 AND "query" = $2 AND "status" = $3`, [caseId, query, "review"]);
          for (const candidate of storedCandidates) {
            await persistRecord("supplier_discovery_candidates", candidate, client);
          }
        }
        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }

      // Broadcast completed event via SSE
      broadcastRealtimeEvent("supplier.discovery_completed", caseId, {
        query,
        candidatesCount: candidates.length,
        dryRun: Boolean(dryRun)
      });

      logFlow("info", "supplier.discovery.completed", {
        traceId,
        caseId,
        orgId,
        candidatesCount: candidates.length,
        dryRun: Boolean(dryRun),
        durationMs: Date.now() - startedAt,
      });

      console.log(`Background AI supplier discovery completed successfully. case=${caseId} query="${query}" count=${candidates.length}`);
    } catch (bgErr: any) {
      logFlow("error", "supplier.discovery.failed", {
        traceId,
        caseId,
        orgId,
        durationMs: Date.now() - startedAt,
        err: safeError(bgErr),
      });
      console.error(`Background AI supplier discovery failed for case=${caseId}: `, bgErr);
      // Reset scanning flag on error
      caseObj.isScanning = false;
      await persistRecord("procurement_cases", caseObj).catch(() => {});
    }
  })();
});

apiV1Router.get("/cases/:caseId/suppliers/discovery-candidates", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const candidates = (dbState.supplier_discovery_candidates || [])
    .filter((candidate: SupplierDiscoveryCandidate) => candidate.organizationId === orgId && candidate.caseId === caseId && candidate.status === "review")
    .sort((a: SupplierDiscoveryCandidate, b: SupplierDiscoveryCandidate) => b.confidence - a.confidence);

  res.json({ data: candidates });
});

apiV1Router.get("/cases/:caseId/rfq-drafts", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const drafts = (dbState.rfq_email_drafts || [])
    .filter((draft: any) => draft.caseId === caseId);

  logFlow("info", "rfq.draft.list", {
    traceId: req.traceId || createTraceId("rfq-draft-list"),
    caseId,
    orgId,
    draftCount: drafts.length,
    draftIds: drafts.map(d => d.id),
  });
  res.json({ data: drafts });
});

apiV1Router.patch("/cases/:caseId/rfq-drafts/:draftId", (req: Request, res: Response) => {
  const traceId = req.traceId || createTraceId("rfq-draft-update");
  const orgId = req.organizationId;
  const { caseId, draftId } = req.params;
  const { subject, bodyHtml, dueDate } = req.body || {};

  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }

  const draft = (dbState.rfq_email_drafts || []).find((item: any) => item.id === draftId && item.caseId === caseId);
  if (!draft) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy bản nháp RFQ" } });
  }

  if (draft.status === "sent") {
    return res.status(409).json({ error: { code: "RFQ_DRAFT_LOCKED", message: "Bản nháp đã gửi, không thể chỉnh sửa." } });
  }

  if (typeof subject !== "string" || subject.trim().length === 0 || typeof bodyHtml !== "string" || bodyHtml.trim().length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Tiêu đề và nội dung email là bắt buộc." } });
  }

  draft.subject = subject.trim();
  draft.bodyHtml = bodyHtml;
  if (typeof dueDate === "string" && dueDate.trim()) {
    draft.dueDate = dueDate.trim();
  }

  logFlow("info", "rfq.draft.updated", {
    traceId,
    caseId,
    orgId,
    draftId,
    supplierId: draft.supplierId,
    supplierEmail: maskEmail(draft.supplierEmail),
    subject: subjectSummary(draft.subject),
    body: textSummary(draft.bodyHtml),
    dueDate: draft.dueDate,
  });

  persistRecord("rfq_email_drafts", draft).catch((err) => {
    console.error("Failed to incrementally persist draft edit:", err);
  });
  
  res.json({ data: draft });
});

apiV1Router.post("/cases/:caseId/suppliers/promote-candidates", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { candidateIds } = req.body;
  const selectedIds: string[] = Array.isArray(candidateIds) ? candidateIds : [];

  if (selectedIds.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Vui lòng chọn ít nhất 1 NCC để thêm vào danh sách chính." } });
  }

  const candidates: SupplierDiscoveryCandidate[] = (dbState.supplier_discovery_candidates || [])
    .filter((candidate: SupplierDiscoveryCandidate) =>
      candidate.organizationId === orgId &&
      candidate.caseId === caseId &&
      candidate.status === "review" &&
      selectedIds.includes(candidate.id)
    );

  const addedSuppliers: Supplier[] = [];
  const rejected: Array<{ candidateId: string; reason: string }> = [];

  candidates.forEach((candidate, index) => {
    if (!candidate.autoAddEligible) {
      rejected.push({ candidateId: candidate.id, reason: "NCC chưa đủ email, số điện thoại hoặc confidence để đưa vào CRM." });
      return;
    }

    const supplier = buildSupplierFromCandidate(candidate, orgId, index);
    const duplicate = dbState.suppliers.find(s =>
      s.organizationId === orgId &&
      (
        s.email.toLowerCase() === supplier.email.toLowerCase() ||
        s.name.toLowerCase() === supplier.name.toLowerCase()
      )
    );

    if (duplicate) {
      candidate.status = "promoted";
      candidate.promotedSupplierId = duplicate.id;
      addedSuppliers.push(duplicate);
      return;
    }

    dbState.suppliers.push(supplier);
    candidate.status = "promoted";
    candidate.promotedSupplierId = supplier.id;
    addedSuppliers.push(supplier);
  });

  res.json({
    message: `Đã thêm ${addedSuppliers.length} NCC vào danh sách chính.`,
    data: addedSuppliers,
    rejected,
    summary: {
      requestedCount: selectedIds.length,
      addedCount: addedSuppliers.length,
      rejectedCount: rejected.length,
    }
  });
});

// SUPPLIERS CRM REST
apiV1Router.get("/suppliers", (req: Request, res: Response) => {
  res.json({ data: dbState.suppliers.filter(s => s.organizationId === req.organizationId) });
});

apiV1Router.post("/suppliers", (req: Request, res: Response) => {
  const { name, contactPerson, email, phone, address, rating, tags, historicalPricing } = req.body;
  const newSupplier: Supplier = {
    id: `sup-${Date.now()}`,
    organizationId: req.organizationId,
    name,
    contactPerson: contactPerson || "",
    email,
    phone,
    address: address || "",
    rating: Number(rating) || 4.5,
    tags: tags || [],
    historicalPricing: historicalPricing || "",
    source: "crm"
  };
  dbState.suppliers.push(newSupplier);
  res.status(201).json({ data: newSupplier });
});

apiV1Router.get("/suppliers/:supplierId", (req: Request, res: Response) => {
  const sup = dbState.suppliers.find(s => s.id === req.params.supplierId && s.organizationId === req.organizationId);
  if (!sup) return res.status(404).json({ error: "Không tìm thấy" });
  res.json({ data: sup });
});

apiV1Router.patch("/suppliers/:supplierId", (req: Request, res: Response) => {
  const idx = dbState.suppliers.findIndex(s => s.id === req.params.supplierId && s.organizationId === req.organizationId);
  if (idx === -1) return res.status(404).json({ error: "Không tìm thấy" });
  
  const updated = { ...dbState.suppliers[idx], ...req.body };
  dbState.suppliers[idx] = updated;
  res.json({ data: updated });
});

apiV1Router.delete("/suppliers/:supplierId", (req: Request, res: Response) => {
  const idx = dbState.suppliers.findIndex(s => s.id === req.params.supplierId && s.organizationId === req.organizationId);
  if (idx === -1) return res.status(404).json({ error: "Không tìm thấy" });
  dbState.suppliers.splice(idx, 1);
  res.json({ message: "Xóa thành công" });
});

// ----------------------------------------------------
// RFQ DRAFT & SENDING APIs
// ----------------------------------------------------
apiV1Router.post("/cases/:caseId/rfq-draft", async (req: Request, res: Response) => {
  const traceId = req.traceId || createTraceId("rfq-draft");
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { supplierIds, dueDate } = req.body;
  logFlow("info", "rfq.draft.request", {
    traceId,
    caseId,
    orgId,
    supplierIds,
    dueDate,
  });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const selectedSuppliers = dbState.suppliers.filter(s => supplierIds.includes(s.id));
  logFlow("info", "rfq.draft.suppliers_resolved", {
    traceId,
    caseId,
    orgId,
    requestedCount: supplierIds?.length || 0,
    resolvedCount: selectedSuppliers.length,
    suppliers: selectedSuppliers.map(s => ({ supplierId: s.id, email: maskEmail(s.email), name: s.name })),
  });
  const escapeHtml = (value: string) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const formatRfqDueDate = (value?: string) => {
    const fallback = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const normalized = value || fallback;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toLocaleDateString("vi-VN");
  };
  const normalizedDueDate = dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const prItemsHtml = caseObj.items.map((it, index) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;"><strong>${escapeHtml(it.name)}</strong>${it.notes ? `<br><span style="color:#64748b;">${escapeHtml(it.notes)}</span>` : ""}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${Number(it.quantity).toLocaleString("vi-VN")}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escapeHtml(it.unit)}</td>
    </tr>
  `).join("");
  
  const drafts = [];
  
  for (const supplier of selectedSuppliers) {
    const draftId = `rfq-draft-${Date.now()}-${supplier.id}`;
    const emailSubject = `[STALLY RFQ-${caseId.toUpperCase()}] Yêu cầu báo giá - ${escapeHtml(caseObj.title || "Hồ sơ mua hàng")}`;
    const emailBody = `
<p>Kính gửi <strong>${escapeHtml(supplier.name)}</strong>,</p>
<p>Phòng mua hàng gửi quý đối tác yêu cầu báo giá cho hồ sơ <strong>${escapeHtml(caseObj.title || caseId)}</strong>.</p>
<p>Vui lòng phản hồi trực tiếp email này và đính kèm báo giá PDF/Excel nếu có. Khi phản hồi, vui lòng ghi rõ đơn giá, tổng tiền, thời gian giao hàng, điều khoản thanh toán và hiệu lực báo giá.</p>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#f7f5f0;">
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">#</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Mặt hàng</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">Số lượng</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Đơn vị</th>
    </tr>
  </thead>
  <tbody>${prItemsHtml}</tbody>
</table>
<p>Hạn tiếp nhận báo giá: <strong>${formatRfqDueDate(normalizedDueDate)}</strong>.</p>
<p>Trân trọng,<br><strong>Phòng mua hàng</strong></p>`;
    
    const draft = {
      id: draftId,
      caseId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      subject: emailSubject,
      bodyHtml: emailBody,
      dueDate: normalizedDueDate,
      status: "draft"
    };
    
    dbState.rfq_email_drafts.push(draft);
    drafts.push(draft);
  }

  try {
    await persistRecords("rfq_email_drafts", drafts);
  } catch (err) {
    logFlow("error", "rfq.draft.persist_failed", {
      traceId,
      caseId,
      orgId,
      draftCount: drafts.length,
      err: safeError(err),
    });
  }
  
  logFlow("info", "rfq.draft.created", {
    traceId,
    caseId,
    orgId,
    draftCount: drafts.length,
    draftIds: drafts.map(d => d.id),
  });
  res.json({ data: drafts });
});

apiV1Router.post("/cases/:caseId/rfq-drafts/create", async (req: Request, res: Response) => {
  const traceId = req.traceId || createTraceId("rfq-drafts-create");
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { supplierIds, dueDate } = req.body || {};

  if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Vui lòng chọn ít nhất 1 nhà cung cấp." } });
  }

  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }

  const selectedSuppliers = dbState.suppliers.filter(s => supplierIds.includes(s.id));
  if (selectedSuppliers.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Không tìm thấy các nhà cung cấp được chọn." } });
  }

  // 1. Transition case to rfq_draft phase if not already there
  let transitionLog = null;
  if (caseObj.status !== "rfq_draft") {
    const fromStatus = caseObj.status;
    caseObj.status = "rfq_draft";
    caseObj.updatedAt = new Date().toISOString();

    transitionLog = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      caseId,
      fromStatus,
      toStatus: "rfq_draft" as const,
      actorId: "u-1",
      actorRole: "procurement",
      reason: `Đã chọn các NCC gửi thư thầu: ${supplierIds.join(", ")}`,
      createdAt: new Date().toISOString()
    };
    dbState.case_transitions.push(transitionLog);
    broadcastRealtimeEvent("case.updated", caseId, { fromStatus, toStatus: "rfq_draft", actorId: "u-1", reason: transitionLog.reason });
  } else {
    caseObj.updatedAt = new Date().toISOString();
  }

  // 2. Generate RFQ drafts
  const escapeHtml = (value: string) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatRfqDueDate = (value?: string) => {
    const fallback = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const normalized = value || fallback;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toLocaleDateString("vi-VN");
  };

  const normalizedDueDate = dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const prItemsHtml = caseObj.items.map((it, index) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${index + 1}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;"><strong>${escapeHtml(it.name)}</strong>${it.notes ? `<br><span style="color:#64748b;">${escapeHtml(it.notes)}</span>` : ""}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${Number(it.quantity).toLocaleString("vi-VN")}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escapeHtml(it.unit)}</td>
    </tr>
  `).join("");

  const newDrafts = [];
  for (const supplier of selectedSuppliers) {
    const draftId = `rfq-draft-${Date.now()}-${supplier.id}`;
    const emailSubject = `[STALLY RFQ-${caseId.toUpperCase()}] Yêu cầu báo giá - ${escapeHtml(caseObj.title || "Hồ sơ mua hàng")}`;
    const emailBody = `
<p>Kính gửi <strong>${escapeHtml(supplier.name)}</strong>,</p>
<p>Phòng mua hàng gửi quý đối tác yêu cầu báo giá cho hồ sơ <strong>${escapeHtml(caseObj.title || caseId)}</strong>.</p>
<p>Vui lòng phản hồi trực tiếp email này và đính kèm báo giá PDF/Excel nếu có. Khi phản hồi, vui lòng ghi rõ đơn giá, tổng tiền, thời gian giao hàng, điều khoản thanh toán và hiệu lực báo giá.</p>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#f7f5f0;">
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">#</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Mặt hàng</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">Số lượng</th>
      <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Đơn vị</th>
    </tr>
  </thead>
  <tbody>${prItemsHtml}</tbody>
</table>
<p>Hạn tiếp nhận báo giá: <strong>${formatRfqDueDate(normalizedDueDate)}</strong>.</p>
<p>Trân trọng,<br><strong>Phòng mua hàng</strong></p>`;

    const draft = {
      id: draftId,
      caseId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      subject: emailSubject,
      bodyHtml: emailBody,
      dueDate: normalizedDueDate,
      status: "draft" as const
    };

    dbState.rfq_email_drafts.push(draft);
    newDrafts.push(draft);
  }

  // 3. Persist incrementally in transaction
  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("procurement_cases", caseObj, client);
      if (transitionLog) {
        await persistRecord("case_transitions", transitionLog, client);
      }
      for (const draft of newDrafts) {
        await persistRecord("rfq_email_drafts", draft, client);
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    logFlow("info", "rfq.drafts.create.incremental.success", {
      traceId,
      caseId,
      orgId,
      draftCount: newDrafts.length,
    });
  } catch (err) {
    logFlow("error", "rfq.drafts.create.incremental.failed", {
      traceId,
      caseId,
      orgId,
      err: safeError(err),
    });
    console.error("Incremental drafts creation failed:", err);
  }

  res.json({
    data: {
      case: caseObj,
      drafts: newDrafts
    }
  });
});

apiV1Router.post("/cases/:caseId/rfq/send", async (req: Request, res: Response) => {
  const traceId = req.traceId || createTraceId("rfq-send");
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { draftIds } = req.body;
  logFlow("info", "rfq.send.request", {
    traceId,
    caseId,
    orgId,
    draftIds,
  });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const rfqId = `rfq-${Date.now()}`;
  const matchedDrafts = dbState.rfq_email_drafts.filter(d => draftIds.includes(d.id));
  logFlow("info", "rfq.send.drafts_resolved", {
    traceId,
    caseId,
    rfqId,
    orgId,
    requestedCount: draftIds?.length || 0,
    resolvedCount: matchedDrafts.length,
    drafts: matchedDrafts.map(d => ({
      draftId: d.id,
      supplierId: d.supplierId,
      supplierEmail: maskEmail(d.supplierEmail),
      subject: subjectSummary(d.subject),
      status: d.status,
    })),
  });
  
  const rfqCase = {
    id: rfqId,
    organizationId: orgId,
    purchaseRequestId: caseObj.requestId || `pr-${Date.now()}`,
    status: "sent" as const,
    dueDate: matchedDrafts[0]?.dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    suppliers: matchedDrafts.map(d => ({
      supplierId: d.supplierId,
      name: d.supplierName,
      email: d.supplierEmail,
      status: "sent" as const
    })),
    createdAt: new Date().toISOString()
  };
  
  const pendingEmailLogs: EmailMessage[] = [];
  const sentEmails: Array<{ supplierId: string; email: string; messageId: string }> = [];

  // Create actual email logs and send real emails. This endpoint must fail if SMTP cannot send.
  for (const d of matchedDrafts) {
    const sendStartedAt = Date.now();
    logFlow("info", "rfq.send.email.start", {
      traceId,
      caseId,
      rfqId,
      draftId: d.id,
      supplierId: d.supplierId,
      supplierEmail: maskEmail(d.supplierEmail),
      subject: subjectSummary(d.subject),
      body: textSummary(d.bodyHtml),
    });
    let sendResult = await sendRealEmail({
      to: d.supplierEmail,
      subject: d.subject,
      html: d.bodyHtml
    });

    if (
      process.env.EMAIL_ALLOW_SIMULATOR === "true" &&
      !sendResult.success &&
      sendResult.error?.includes("SMTP_NOT_CONFIGURED")
    ) {
      console.warn(`[Stally SMTP Simulator] ✉️ Mock sending RFQ email to ${d.supplierEmail} (SMTP not configured)`);
      sendResult = { success: true, messageId: `mock-smtp-out-${Date.now()}-${d.supplierId}` };
      logFlow("warn", "rfq.send.email.smtp_simulated", {
        traceId,
        caseId,
        rfqId,
        draftId: d.id,
        supplierId: d.supplierId,
        supplierEmail: maskEmail(d.supplierEmail),
        messageId: sendResult.messageId,
      });
    }

    if (!sendResult.success) {
      logFlow("error", "rfq.send.email.failed", {
        traceId,
        caseId,
        rfqId,
        draftId: d.id,
        supplierId: d.supplierId,
        supplierEmail: maskEmail(d.supplierEmail),
        durationMs: Date.now() - sendStartedAt,
        error: sendResult.error,
        sentCountBeforeFailure: sentEmails.length,
      });
      return res.status(502).json({
        error: {
          code: "EMAIL_SEND_FAILED",
          message: `Không gửi được RFQ tới ${d.supplierEmail}.`,
          details: sendResult.error,
        },
        sentEmails,
      });
    }

    logFlow("info", "rfq.send.email.success", {
      traceId,
      caseId,
      rfqId,
      draftId: d.id,
      supplierId: d.supplierId,
      supplierEmail: maskEmail(d.supplierEmail),
      messageId: sendResult.messageId,
      durationMs: Date.now() - sendStartedAt,
    });

    sentEmails.push({
      supplierId: d.supplierId,
      email: d.supplierEmail,
      messageId: sendResult.messageId || "",
    });

    const emailMsg: EmailMessage = {
      id: `email-out-${Date.now()}-${d.supplierId}`,
      organizationId: orgId,
      gmailAccountId: "smtp-1",
      gmailMessageId: sendResult.messageId || `smtp-out-${Date.now()}-${d.supplierId}`,
      gmailThreadId: `thread-${Date.now()}`,
      internetMessageId: `<out-${Date.now()}@stally.com>`,
      direction: "outbound",
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "procurement@stally.com",
      to: [d.supplierEmail],
      subject: d.subject,
      bodyHtml: d.bodyHtml,
      linkedCaseId: caseId,
      linkedSupplierId: d.supplierId,
      classification: "rfq",
      attachments: [],
      createdAt: new Date().toISOString()
    };
    pendingEmailLogs.push(emailMsg);
    
    // Update draft status
    d.status = "sent";
  }

  dbState.rfq_cases.push(rfqCase);
  dbState.email_messages.push(...pendingEmailLogs);
  caseObj.currentRfqId = rfqId;

  // Incremental transaction save for sending RFQ
  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("rfq_cases", rfqCase, client);
      await persistRecord("procurement_cases", caseObj, client);
      for (const emailMsg of pendingEmailLogs) {
        await persistRecord("email_messages", emailMsg, client);
      }
      for (const d of matchedDrafts) {
        await persistRecord("rfq_email_drafts", d, client);
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Failed to incrementally persist sent RFQs:", err);
  }

  logFlow("info", "rfq.send.persisted", {
    traceId,
    caseId,
    rfqId,
    orgId,
    sentCount: sentEmails.length,
    emailLogCount: pendingEmailLogs.length,
    supplierCount: rfqCase.suppliers.length,
  });
  
  // Transition status
  transitionCaseStatus({
    caseId,
    toStatus: "rfq_sent",
    actorId: "u-1",
    actorRole: "procurement",
    reason: `Gửi RFQ chào giá thật đến ${matchedDrafts.length} nhà thầu qua Gmail.`,
    orgId
  });
  
  setTimeout(() => {
    transitionCaseStatus({
      caseId,
      toStatus: "collecting_quotes",
      actorId: "u-1",
      actorRole: "procurement",
      reason: "Hệ thống lắng nghe email báo giá phản hồi",
      orgId
    });
  }, 300);
  
  logFlow("info", "rfq.send.response", {
    traceId,
    caseId,
    rfqId,
    orgId,
    sentCount: sentEmails.length,
    sent: sentEmails.map(item => ({
      supplierId: item.supplierId,
      email: maskEmail(item.email),
      messageId: item.messageId,
    })),
  });
  res.json({
    message: "RFQ emails sent successfully.",
    rfqId,
    email: {
      sentCount: sentEmails.length,
      sent: sentEmails,
    },
  });
});

// ----------------------------------------------------
// THREAD LINKING & GMAIL WEBHOOK RECEPTOR
// ----------------------------------------------------
interface InboundEmailPayload {
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  rfqCaseId?: string;
  supplierId?: string;
  fileName?: string;
  fileContentBase64?: string;
  mimeType?: string;
  sizeBytes?: number;
  messageId?: string;
  threadId?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references?: string[];
  receivedAt?: string;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasPositiveExtractedMoney(extractedQuote: any): boolean {
  const totalAmount = parseFiniteNumber(extractedQuote?.totalAmount);
  const subtotal = parseFiniteNumber(extractedQuote?.subtotal);
  if ((totalAmount !== null && totalAmount > 0) || (subtotal !== null && subtotal > 0)) return true;

  return Array.isArray(extractedQuote?.items) && extractedQuote.items.some((item: any) => {
    const totalPrice = parseFiniteNumber(item?.totalPrice);
    const unitPrice = parseFiniteNumber(item?.unitPrice);
    return (totalPrice !== null && totalPrice > 0) || (unitPrice !== null && unitPrice > 0);
  });
}

function parseDiscountPercent(text: string): number | null {
  const patterns = [
    /(?:giảm(?:\s+giá)?|chiết\s*khấu)(?:\s+thêm)?\s*(\d+(?:[.,]\d+)?)\s*%/i,
    /(?:discount|reduce|reduction)(?:\s+by|\s+additional)?\s*(\d+(?:[.,]\d+)?)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1].replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) {
      return parsed;
    }
  }

  return null;
}

function parseDiscountPercentFromGoal(goal?: string): number | null {
  if (!goal) return null;
  const match = goal.match(/discount_(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : null;
}

function isAgreementText(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasAgreement = /\b(ok|okay|agree|accepted|accept|approved)\b|đồng\s*ý|chấp\s*nhận|thống\s*nhất|nhất\s*trí|xác\s*nhận|được\s+ạ|được\s+nhé/i.test(normalized);
  const hasRejection = /không\s+đồng\s*ý|không\s+chấp\s*nhận|chưa\s+thể|không\s+thể|từ\s+chối|reject|decline|cannot|can't/i.test(normalized);
  return hasAgreement && !hasRejection;
}

function parseDeliveryDays(text: string): number | null {
  const match = text.match(/(?:giao(?:\s+hàng)?|delivery).{0,40}?(\d{1,3})\s*(?:ngày|days?)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePaymentTerms(text: string): string | null {
  const netMatch = text.match(/(?:net|công\s*nợ|thanh\s*toán\s*sau|giãn\s*nợ).{0,30}?(\d{1,3})\s*(?:ngày|days?)/i);
  if (netMatch) return `Công nợ Net ${netMatch[1]} ngày`;
  if (/cod|thanh\s*toán\s*khi\s*nhận\s*hàng/i.test(text)) return "COD - Nhận hàng trả tiền";
  return null;
}

function mergeNegotiationReplyWithExistingQuote(existingQuote: Quote, extractedQuote: any, rawText: string, promptGoal?: string) {
  const agreedToGoal = isAgreementText(rawText);
  const discountPercent = parseDiscountPercent(rawText) || (agreedToGoal ? parseDiscountPercentFromGoal(promptGoal) : null);
  const multiplier = discountPercent ? 1 - discountPercent / 100 : 1;
  const items = existingQuote.items.map(item => {
    const unitPrice = Math.round(item.unitPrice * multiplier);
    return {
      ...item,
      unitPrice,
      totalPrice: Math.round(item.totalPrice * multiplier),
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxRate = existingQuote.subtotal > 0 ? existingQuote.taxAmount / existingQuote.subtotal : 0;
  const taxAmount = Math.round(subtotal * taxRate);
  const freeShipping = /(?:miễn\s*phí|free).{0,20}(?:vận\s*chuyển|shipping)|(?:vận\s*chuyển|shipping).{0,20}(?:miễn\s*phí|free)/i.test(rawText);
  const shippingFee = freeShipping ? 0 : existingQuote.shippingFee;
  const deliveryDays = parseDeliveryDays(rawText)
    || (agreedToGoal && promptGoal === "faster_delivery" ? Math.max(1, existingQuote.deliveryDays - 1) : existingQuote.deliveryDays);
  const paymentTerms = parsePaymentTerms(rawText)
    || (agreedToGoal && promptGoal === "longer_terms" ? "Công nợ Net 30 ngày" : existingQuote.paymentTerms);

  return {
    items,
    subtotal,
    taxAmount,
    shippingFee,
    totalAmount: subtotal + taxAmount + shippingFee,
    deliveryDays,
    paymentTerms,
    aiConfidenceScore: discountPercent || agreedToGoal ? 82 : 55,
  };
}

function shouldApplyAcceptedNegotiationGoal(existingQuote: Quote, extractedQuote: any, rawText: string, promptGoal?: string) {
  if (!promptGoal || !isAgreementText(rawText)) return false;

  const extractedTotal = parseFiniteNumber(extractedQuote?.totalAmount);
  const extractedDeliveryDays = parseFiniteNumber(extractedQuote?.deliveryDays);
  const extractedPaymentTerms = String(extractedQuote?.paymentTerms || "");

  if (parseDiscountPercent(rawText) || parseDiscountPercentFromGoal(promptGoal)) {
    return extractedTotal === null || extractedTotal >= existingQuote.totalAmount;
  }
  if (promptGoal === "faster_delivery") {
    return extractedDeliveryDays === null || extractedDeliveryDays >= existingQuote.deliveryDays;
  }
  if (promptGoal === "longer_terms") {
    return !/net\s*30|30\s*(ngày|days?)/i.test(extractedPaymentTerms);
  }

  return false;
}

function createLegacyCaseFromRfq(rfqObj: any, orgId: string) {
  const prObj = dbState.purchase_requests.find(p => p.id === rfqObj.purchaseRequestId && p.organizationId === orgId);
  if (!prObj) return null;

  const existing = dbState.procurement_cases.find(c => c.requestId === prObj.id && c.organizationId === orgId);
  if (existing) {
    existing.currentRfqId = rfqObj.id;
    existing.status = "collecting_quotes";
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const newCase: ProcurementCase = {
    id: `case-${Date.now()}`,
    organizationId: orgId,
    title: prObj.title,
    status: "collecting_quotes",
    priority: prObj.priority,
    createdFrom: prObj.source === "email" ? "gmail" : prObj.source,
    requesterId: prObj.requesterId,
    requesterName: prObj.requesterName,
    requesterDepartmentId: "dept_kitchen",
    departmentName: prObj.departmentName,
    requiredDate: prObj.requiredDate,
    requestId: prObj.id,
    currentRfqId: rfqObj.id,
    items: prObj.items,
    createdAt: prObj.createdAt,
    updatedAt: new Date().toISOString()
  };

  dbState.procurement_cases.push(newCase);
  dbState.case_transitions.push({
    id: `trans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    caseId: newCase.id,
    fromStatus: "rfq_sent",
    toStatus: "collecting_quotes",
    actorId: "system",
    actorRole: "procurement",
    reason: "Backfill case từ RFQ legacy để xử lý email IMAP trả về.",
    createdAt: new Date().toISOString()
  });

  return newCase;
}

export async function ingestInboundEmail(payload: InboundEmailPayload, orgId = "org-1") {
  const traceId = createTraceId("inbound");
  const startedAt = Date.now();
  const { fromEmail, fromName, subject, bodyText, bodyHtml, rfqCaseId, supplierId, fileName, fileContentBase64 } = payload;
  logFlow("info", "inbound.email.received", {
    traceId,
    orgId,
    fromEmail: maskEmail(fromEmail),
    fromName,
    subject: subjectSummary(subject),
    bodyText: textSummary(bodyText),
    rfqCaseId,
    supplierId,
    fileName,
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes,
    messageId: payload.messageId,
    internetMessageId: payload.internetMessageId,
    threadId: payload.threadId,
    inReplyTo: payload.inReplyTo,
    referencesCount: payload.references?.length || 0,
    receivedAt: payload.receivedAt,
  });

  // GMAIL THREAD LINKING ENGINE RULES
  let resolvedCaseId = "";
  let resolvedSupplierId = supplierId || "";
  
  // Rule 1: Code in Subject, supports both [STALLY RFQ-CASE-...] and [STALLY RFQ-RFQ-...]
  const subjectMatch = subject ? subject.match(/\[STALLY (?:RFQ|NEGOTIATION)-((?:case|rfq)-[a-z0-9-]+)\]/i) : null;
  if (subjectMatch) {
    const code = subjectMatch[1].toLowerCase();
    if (code.startsWith("case-")) {
      resolvedCaseId = code;
    } else if (code.startsWith("rfq-")) {
      const caseObj = dbState.procurement_cases.find(c => c.currentRfqId === code && c.organizationId === orgId);
      if (caseObj) {
        resolvedCaseId = caseObj.id;
      } else {
        const rfqObj = dbState.rfq_cases.find(r => r.id === code && r.organizationId === orgId);
        if (rfqObj) {
          const legacyCase = dbState.procurement_cases.find(c => c.requestId === rfqObj.purchaseRequestId && c.organizationId === orgId);
          const linkedCase = legacyCase || createLegacyCaseFromRfq(rfqObj, orgId);
          if (linkedCase) resolvedCaseId = linkedCase.id;
        }
      }
    }
    logFlow(resolvedCaseId ? "info" : "warn", "inbound.resolve.subject_code", {
      traceId,
      orgId,
      code,
      resolvedCaseId,
      resolvedSupplierId,
    });
  }
  
  // Rule 2: ThreadId match or direct RFQ case linking
  if (!resolvedCaseId && rfqCaseId) {
    const caseObj = dbState.procurement_cases.find(c => c.currentRfqId === rfqCaseId);
    if (caseObj) {
      resolvedCaseId = caseObj.id;
    }
    logFlow(resolvedCaseId ? "info" : "warn", "inbound.resolve.rfq_case_id", {
      traceId,
      orgId,
      rfqCaseId,
      resolvedCaseId,
    });
  }
  
  // Rule 3: Sender matching
  if (!resolvedSupplierId && fromEmail) {
    const matchedSup = dbState.suppliers.find(s => s.email.toLowerCase() === fromEmail.toLowerCase() && s.organizationId === orgId);
    if (matchedSup) {
      resolvedSupplierId = matchedSup.id;
    }
    logFlow(resolvedSupplierId ? "info" : "warn", "inbound.resolve.sender", {
      traceId,
      orgId,
      fromEmail: maskEmail(fromEmail),
      resolvedSupplierId,
    });
  }
  
  if (!resolvedCaseId) {
    logFlow("error", "inbound.resolve.unresolvable", {
      traceId,
      orgId,
      fromEmail: maskEmail(fromEmail),
      subject: subjectSummary(subject),
      rfqCaseId,
      supplierId,
      resolvedSupplierId,
      messageId: payload.messageId,
      internetMessageId: payload.internetMessageId,
      durationMs: Date.now() - startedAt,
    });
    // Look for active collecting case with that supplier
    const activeCase = dbState.procurement_cases.find(c => 
      c.status === "collecting_quotes" && 
      resolvedSupplierId && 
      dbState.rfq_cases.find(r => r.id === c.currentRfqId)?.suppliers.some(s => s.supplierId === resolvedSupplierId)
    );
    if (activeCase) resolvedCaseId = activeCase.id;
    logFlow(resolvedCaseId ? "info" : "warn", "inbound.resolve.active_case", {
      traceId,
      orgId,
      resolvedSupplierId,
      resolvedCaseId,
    });
  }
  
  if (!resolvedCaseId) {
    const err = new Error("Không thể nhận diện email này thuộc hồ sơ Case thầu nào.");
    (err as any).code = "UNRESOLVABLE_CASE";
    throw err;
  }
  
  const emailClassification = /\[STALLY NEGOTIATION-/i.test(subject || "") ? "negotiation" : "quote";
  const emailMsgId = `email-in-${Date.now()}`;
  const emailMsg: EmailMessage = {
    id: emailMsgId,
    organizationId: orgId,
    gmailAccountId: "imap-1",
    gmailMessageId: payload.messageId || `imap-msg-${Date.now()}`,
    gmailThreadId: payload.threadId || payload.inReplyTo || `imap-thread-${Date.now()}`,
    internetMessageId: payload.internetMessageId,
    inReplyTo: payload.inReplyTo,
    references: payload.references,
    direction: "inbound",
    from: fromName ? `${fromName} <${fromEmail}>` : (fromEmail || "unknown-supplier"),
    to: [process.env.SMTP_USER || "procurement@stally.com"],
    subject: subject || "Báo giá thầu phản hồi",
    bodyText: bodyText || `Xin chào Stally, gửi báo giá chi tiết trong tệp đính kèm.`,
    bodyHtml,
    receivedAt: payload.receivedAt || new Date().toISOString(),
    linkedCaseId: resolvedCaseId,
    linkedSupplierId: resolvedSupplierId,
    classification: emailClassification,
    attachments: fileName ? [
      {
        id: `att-${Date.now()}`,
        emailMessageId: emailMsgId,
        fileName,
        mimeType: payload.mimeType || "application/octet-stream",
        sizeBytes: payload.sizeBytes || 0,
        storageKey: `imap-${Date.now()}-${fileName}`
      }
    ] : [],
    createdAt: new Date().toISOString()
  };
  
  logFlow("info", "inbound.email.linked", {
    traceId,
    orgId,
    emailMessageId: emailMsg.id,
    gmailMessageId: emailMsg.gmailMessageId,
    internetMessageId: emailMsg.internetMessageId,
    threadId: emailMsg.gmailThreadId,
    linkedCaseId: resolvedCaseId,
    linkedSupplierId: resolvedSupplierId,
    fromEmail: maskEmail(fromEmail),
    subject: subjectSummary(emailMsg.subject),
    attachmentCount: emailMsg.attachments.length,
    attachments: emailMsg.attachments.map(att => ({
      fileName: att.fileName,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
    })),
  });
  dbState.email_messages.push(emailMsg);
  broadcastRealtimeEvent("email.received", resolvedCaseId, emailMsg);
  
  await triggerQuoteExtractionPipeline(resolvedCaseId, resolvedSupplierId, emailMsg, fileName, fileContentBase64, orgId);

  logFlow("info", "inbound.email.processed", {
    traceId,
    orgId,
    emailMessageId: emailMsg.id,
    linkedCaseId: resolvedCaseId,
    linkedSupplierId: resolvedSupplierId,
    durationMs: Date.now() - startedAt,
  });
  return { linkedCaseId: resolvedCaseId, linkedSupplierId: resolvedSupplierId, emailMessageId: emailMsg.id };
}

apiV1Router.post("/webhooks/inbound-email", async (req: Request, res: Response) => {
  try {
    const result = await ingestInboundEmail(req.body, req.organizationId || "org-1");
    res.json({ message: "Email received. Quote extraction queued.", ...result });
  } catch (err: any) {
    logFlow("error", "inbound.webhook.failed", {
      traceId: req.traceId || createTraceId("inbound-webhook"),
      orgId: req.organizationId || "org-1",
      fromEmail: maskEmail(req.body?.fromEmail),
      subject: subjectSummary(req.body?.subject),
      messageId: req.body?.messageId,
      internetMessageId: req.body?.internetMessageId,
      err: safeError(err),
    });
    res.status(400).json({
      error: {
        code: err.code || "INBOUND_EMAIL_ERROR",
        message: err.message || "Không xử lý được email inbound.",
      }
    });
  }
});

// ----------------------------------------------------
// DOCUMENT QUOTE EXTRACTION PIPELINE
// ----------------------------------------------------
async function triggerQuoteExtractionPipeline(caseId: string, supplierId: string, email: EmailMessage, fileName: string, fileContentBase64: string, orgId: string) {
  const traceId = createTraceId("quote-extract");
  const startedAt = Date.now();
  logFlow("info", "quote.extraction.start", {
    traceId,
    caseId,
    supplierId,
    orgId,
    emailMessageId: email.id,
    gmailMessageId: email.gmailMessageId,
    internetMessageId: email.internetMessageId,
    subject: subjectSummary(email.subject),
    fromEmail: maskEmail(String(email.from || "").match(/<([^>]+)>/)?.[1] || email.from),
    bodyText: textSummary(email.bodyText),
    fileName,
    hasFileContent: Boolean(fileContentBase64),
    aiEnabled: Boolean(ai),
  });
  broadcastRealtimeEvent("quote.extraction_started", caseId, { supplierId, emailMessageId: email.id });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId);
  const supplierObj = dbState.suppliers.find(s => s.id === supplierId);
  const targetRfqCaseId = caseObj?.currentRfqId || "rfq-1";
  const existingQuote = dbState.quotes.find(q => q.rfqCaseId === targetRfqCaseId && q.supplierId === supplierId);
  const isNegotiationReply = email.classification === "negotiation" || /\[STALLY NEGOTIATION-/i.test(email.subject || "");
  const latestSentNegotiationLog = dbState.ai_negotiation_logs
    .filter(log => log.caseId === caseId && log.supplierId === supplierId && log.status === "sent")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .at(-1);
  logFlow("info", "quote.extraction.context", {
    traceId,
    caseId,
    supplierId,
    orgId,
    emailMessageId: email.id,
    caseFound: Boolean(caseObj),
    caseStatus: caseObj?.status,
    currentRfqId: caseObj?.currentRfqId,
    itemCount: caseObj?.items?.length || 0,
    supplierFound: Boolean(supplierObj),
    supplierEmail: maskEmail(supplierObj?.email),
    existingQuoteFound: Boolean(existingQuote),
    isNegotiationReply,
    sentNegotiationGoal: latestSentNegotiationLog?.promptGoal,
  });
  
  let extractedQuote = {
    items: caseObj ? caseObj.items.map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: 0,
      totalPrice: 0
    })) : [],
    deliveryDays: 3,
    paymentTerms: "COD",
    subtotal: 0,
    taxAmount: 0,
    shippingFee: 100000,
    totalAmount: 100000,
    aiConfidenceScore: 70
  };
  
  const multiplier = supplierId === "sup-1" ? 0.95 : supplierId === "sup-2" ? 0.9 : supplierId === "sup-3" ? 1.05 : 1.1;
  const rawTextForGemini = email.bodyText + " " + (fileName ? `Scan file: ${fileName}` : "");
  
  let isFallback = !ai;
  let usedNegotiationMerge = false;
  if (ai) {
    try {
      // Real Gemini API Extraction
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy đóng vai trò là một AI chuyên gia bóc tách báo giá B2B cực kỳ nghiêm ngặt và chính xác. Đọc nội dung email/file đính kèm dưới đây và đối chiếu với danh sách Mặt Hàng Gốc để trích xuất JSON.

QUY TẮC CỰC KỲ QUAN TRỌNG:
1. KHÔNG ĐƯỢC TỰ Ý BỊA ĐẶT (hallucinate) thông tin. Chỉ trích xuất các sản phẩm thật sự xuất hiện trong nội dung email phản hồi.
2. ĐỐI CHIẾU MẶT HÀNG GỐC: So khớp tên sản phẩm trong báo giá với danh sách "MẶT HÀNG GỐC" để lấy tên chính xác nhất. Nếu không khớp, giữ nguyên tên trong email.
3. GIỮ NGUYÊN GIÁ TRỊ: Trích xuất đúng đơn giá (unitPrice) và thành tiền (totalPrice) mà đối tác báo qua email. Tuyệt đối không tự ý áp dụng chiết khấu hay tính toán toán học khác trừ khi email có ghi rõ tỷ lệ phần trăm cụ thể.
4. XỬ LÝ KHI THIẾU THÔNG TIN:
   - Phí vận chuyển (shippingFee): Nếu email KHÔNG đề cập phí vận chuyển, bắt buộc điền 0. TUYỆT ĐỐI NGHIÊM CẤM TỰ BỊA RA PHÍ VẬN CHUYỂN.
   - Thuế VAT (taxAmount): Nếu email không nhắc tới VAT, mặc định điền 0.
   - Số ngày giao hàng (deliveryDays): Nếu không có thông tin, mặc định điền 3.
   - Điều khoản thanh toán (paymentTerms): Nếu không có, mặc định điền "Không đề cập".
5. TRÁNH NHẦM LẪN ĐƠN GIÁ VÀ TỔNG TIỀN (Unit Price vs Total Price): Hãy phân biệt rõ giữa đơn giá (unitPrice - giá của 1 đơn vị sản phẩm) và thành tiền (totalPrice của từng mặt hàng) hoặc tổng thanh toán (totalAmount của cả đơn). Nếu email phản hồi thầu ghi "tổng tiền", "tổng giá trị là X" cho toàn bộ đơn hàng/gói hàng, thì X chính là totalPrice hoặc totalAmount. Tuyệt đối KHÔNG ĐƯỢC điền X vào đơn giá (unitPrice) của từng món hàng để tránh tính toán sai lệch nhân lên hàng chục lần (Ví dụ: nếu đơn thầu gồm 10 kg và tổng tiền sau giảm giá của món đó là 1,000,000đ, thì totalPrice = 1,000,000đ và unitPrice phải được tính lùi là 100,000đ).

NỘI DUNG EMAIL & FILE:
${rawTextForGemini}

MẶT HÀNG GỐC:
${caseObj ? JSON.stringify(caseObj.items) : "Không"}

Hãy trả về mã JSON hợp lệ duy nhất, không kèm theo bất kỳ lời giải thích nào khác ngoài JSON:
{
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "unit": "đơn vị", "unitPrice": đơn giá (VND), "totalPrice": thành tiền }
  ],
  "subtotal": tổng trước thuế,
  "taxAmount": VAT,
  "shippingFee": vận chuyển,
  "totalAmount": tổng thanh toán,
  "deliveryDays": số ngày giao hàng,
  "paymentTerms": "điều khoản thanh toán",
  "aiConfidenceScore": độ tin cậy 1-100
}`
      });
      if (response.text) {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedQuote = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Không tìm thấy khối JSON hợp lệ trong phản hồi của Gemini.");
        }
      }
    } catch (e) {
      console.error("❌ Lỗi AI trích xuất báo giá thực tế:", e);
      logFlow("error", "quote.extraction.ai_failed", {
        traceId,
        caseId,
        supplierId,
        emailMessageId: email.id,
        err: safeError(e),
      });
      isFallback = true;
      extractedQuote = simulateQuoteExtraction(caseObj, supplierObj, multiplier);
    }
  } else {
    logFlow("warn", "quote.extraction.ai_unavailable_fallback", {
      traceId,
      caseId,
      supplierId,
      emailMessageId: email.id,
    });
    extractedQuote = simulateQuoteExtraction(caseObj, supplierObj, multiplier);
  }

  const shouldMergeNegotiationReply = Boolean(existingQuote && isNegotiationReply && (
    isFallback ||
    !hasPositiveExtractedMoney(extractedQuote) ||
    shouldApplyAcceptedNegotiationGoal(existingQuote, extractedQuote, rawTextForGemini, latestSentNegotiationLog?.promptGoal)
  ));
  if (shouldMergeNegotiationReply && existingQuote) {
    extractedQuote = mergeNegotiationReplyWithExistingQuote(existingQuote, extractedQuote, rawTextForGemini, latestSentNegotiationLog?.promptGoal);
    usedNegotiationMerge = true;
    isFallback = false;
    logFlow("warn", "quote.extraction.negotiation_zero_guard_applied", {
      traceId,
      caseId,
      supplierId,
      orgId,
      emailMessageId: email.id,
      previousTotalAmount: existingQuote.totalAmount,
      mergedTotalAmount: extractedQuote.totalAmount,
      aiConfidenceScore: extractedQuote.aiConfidenceScore,
      promptGoal: latestSentNegotiationLog?.promptGoal,
    });
  }

  const normalizedItems = (extractedQuote.items && extractedQuote.items.length > 0 ? extractedQuote.items : caseObj?.items || []).map((it: any) => {
    const quantity = Number(it.quantity) || 0;
    const unitPrice = Number(it.unitPrice) || 0;
    return {
      name: it.name || "Mặt hàng chưa xác định",
      quantity,
      unit: it.unit || "đv",
      unitPrice,
      totalPrice: Number(it.totalPrice) || quantity * unitPrice
    };
  });
  const computedSubtotal = normalizedItems.reduce((sum: number, it: any) => sum + it.totalPrice, 0);
  const extractedSubtotal = parseFiniteNumber(extractedQuote.subtotal);
  const extractedTaxAmount = parseFiniteNumber(extractedQuote.taxAmount);
  const extractedShippingFee = parseFiniteNumber(extractedQuote.shippingFee);
  const extractedTotalAmount = parseFiniteNumber(extractedQuote.totalAmount);
  const normalizedSubtotal = extractedSubtotal !== null && extractedSubtotal > 0 ? extractedSubtotal : computedSubtotal;
  const normalizedTaxAmount = extractedTaxAmount !== null && extractedTaxAmount >= 0 ? extractedTaxAmount : 0;
  const normalizedShippingFee = extractedShippingFee !== null && extractedShippingFee >= 0 ? extractedShippingFee : 0;
  const normalizedTotalAmount = extractedTotalAmount !== null && extractedTotalAmount > 0
    ? extractedTotalAmount
    : normalizedSubtotal + normalizedTaxAmount + normalizedShippingFee;
  logFlow("info", "quote.extraction.normalized", {
    traceId,
    caseId,
    supplierId,
    orgId,
    emailMessageId: email.id,
    isFallback,
    itemCount: normalizedItems.length,
    subtotal: normalizedSubtotal,
    taxAmount: normalizedTaxAmount,
    shippingFee: normalizedShippingFee,
    totalAmount: normalizedTotalAmount,
    deliveryDays: Number(extractedQuote.deliveryDays) || 3,
    aiConfidenceScore: Number(extractedQuote.aiConfidenceScore) || (usedNegotiationMerge ? 55 : isFallback ? 0 : 70),
    usedNegotiationMerge,
  });
  
  // Save or update quote, and log quote version
  let quoteId: string;
  let finalQuote: Quote;
  let roundNum = 1;
  
  if (existingQuote) {
    quoteId = existingQuote.id;
    existingQuote.items = normalizedItems;
    existingQuote.subtotal = normalizedSubtotal;
    existingQuote.taxAmount = normalizedTaxAmount;
    existingQuote.shippingFee = normalizedShippingFee;
    existingQuote.totalAmount = normalizedTotalAmount;
    existingQuote.deliveryDays = Number(extractedQuote.deliveryDays) || 3;
    existingQuote.paymentTerms = isFallback ? "GIẢ LẬP (Lỗi kết nối Gemini API)" : (extractedQuote.paymentTerms || "COD / Chuyển khoản");
    existingQuote.validUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    existingQuote.aiConfidenceScore = Number(extractedQuote.aiConfidenceScore) || (usedNegotiationMerge ? 55 : isFallback ? 0 : 70);
    existingQuote.originalFileUrl = usedNegotiationMerge ? (fileName || "negotiation_reply.txt") : isFallback ? "MÔ PHỎNG (Do hết hạn ngạch API)" : (fileName || "quote_unstructured.txt");
    existingQuote.createdAt = new Date().toISOString();
    
    finalQuote = existingQuote;
    
    // Determine next round number
    const existingVersions = dbState.quote_versions.filter(qv => qv.quoteId === quoteId);
    roundNum = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.round)) + 1 : 2;
  } else {
    quoteId = `q-${Date.now()}`;
    const newQuote: Quote = {
      id: quoteId,
      organizationId: orgId,
      rfqCaseId: targetRfqCaseId,
      supplierId,
      supplierName: supplierObj ? supplierObj.name : email.from,
      items: normalizedItems,
      subtotal: normalizedSubtotal,
      taxAmount: normalizedTaxAmount,
      shippingFee: normalizedShippingFee,
      totalAmount: normalizedTotalAmount,
      deliveryDays: Number(extractedQuote.deliveryDays) || 3,
      paymentTerms: isFallback ? "GIẢ LẬP (Lỗi kết nối Gemini API)" : (extractedQuote.paymentTerms || "COD / Chuyển khoản"),
      validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      aiConfidenceScore: Number(extractedQuote.aiConfidenceScore) || (usedNegotiationMerge ? 55 : isFallback ? 0 : 70),
      status: "extracted",
      originalFileUrl: usedNegotiationMerge ? (fileName || "negotiation_reply.txt") : isFallback ? "MÔ PHỎNG (Do hết hạn ngạch API)" : (fileName || "quote_unstructured.txt"),
      createdAt: new Date().toISOString()
    };
    dbState.quotes.push(newQuote);
    finalQuote = newQuote;
    roundNum = 1;
  }
  
  const quoteVer: QuoteVersion = {
    id: `qv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    quoteId,
    round: roundNum,
    items: finalQuote.items,
    subtotal: finalQuote.subtotal,
    taxAmount: finalQuote.taxAmount,
    shippingFee: finalQuote.shippingFee,
    totalAmount: finalQuote.totalAmount,
    deliveryDays: finalQuote.deliveryDays,
    paymentTerms: finalQuote.paymentTerms,
    validUntil: finalQuote.validUntil,
    aiConfidenceScore: finalQuote.aiConfidenceScore,
    originalFileUrl: finalQuote.originalFileUrl,
    createdAt: new Date().toISOString()
  };
  
  dbState.quote_versions.push(quoteVer);
  logFlow("info", "quote.extraction.saved", {
    traceId,
    caseId,
    supplierId,
    orgId,
    emailMessageId: email.id,
    rfqCaseId: targetRfqCaseId,
    quoteId,
    quoteVersionId: quoteVer.id,
    round: roundNum,
    createdNewQuote: !existingQuote,
    totalAmount: finalQuote.totalAmount,
    itemCount: finalQuote.items.length,
    isFallback,
  });
  
  // Link quote back to RFQ Case Suppliers status
  if (caseObj && caseObj.currentRfqId) {
    const rfqObj = dbState.rfq_cases.find(r => r.id === caseObj.currentRfqId);
    if (rfqObj) {
      const rsup = rfqObj.suppliers.find(s => s.supplierId === supplierId);
      if (rsup) {
        rsup.status = "replied";
        rsup.quoteId = quoteId;
      }
      rfqObj.status = "quotes_received";
      logFlow("info", "quote.extraction.rfq_supplier_updated", {
        traceId,
        caseId,
        supplierId,
        orgId,
        rfqCaseId: rfqObj.id,
        rfqStatus: rfqObj.status,
        supplierFoundInRfq: Boolean(rsup),
        quoteId,
      });
    }
    
    if (["collecting_quotes"].includes(caseObj.status)) {
      transitionCaseStatus({
        caseId,
        toStatus: "quote_review",
        actorId: "system",
        actorRole: "procurement",
        reason: `Báo giá thầu của NCC ${finalQuote.supplierName} đã được AI trích xuất xong.`,
        orgId
      });
    }

    if (["quote_review", "collecting_quotes"].includes(caseObj.status)) {
      logFlow("info", "quote.extraction.comparison_transition_scheduled", {
        traceId,
        caseId,
        supplierId,
        orgId,
        currentStatus: caseObj.status,
        delayMs: 400,
      });
      setTimeout(() => {
        try {
          transitionCaseStatus({
            caseId,
            toStatus: "comparison_ready",
            actorId: "system",
            actorRole: "procurement",
            reason: "Ma trận so sánh báo giá đã sẵn sàng đối chiếu.",
            orgId
          });
        } catch (err) {
          logFlow("warn", "quote.extraction.comparison_transition_skipped", {
            traceId,
            caseId,
            supplierId,
            orgId,
            err: safeError(err),
          });
          console.error("Case comparison transition skipped:", err);
        }
      }, 400);
    }
    
    if (caseObj.status === "negotiating") {
      // Find the corresponding "draft" or "sent" AiNegotiationLog for this case and supplier, and update its status to "supplier_responded"
      const activeLogs = dbState.ai_negotiation_logs.filter(
        l => l.caseId === caseId && l.supplierId === supplierId && (l.status === "draft" || l.status === "sent")
      );
      if (activeLogs.length > 0) {
        const sentLogs = activeLogs.filter(l => l.status === "sent");
        const latestLog = sentLogs.length > 0 ? sentLogs[sentLogs.length - 1] : activeLogs[activeLogs.length - 1];
        latestLog.status = "supplier_responded";
        logFlow("info", "quote.extraction.negotiation_log_updated", {
          traceId,
          caseId,
          supplierId,
          orgId,
          negotiationLogId: latestLog.id,
          round: latestLog.round,
        });
        latestLog.supplierReplyRaw = email.bodyText || email.snippet || "Phản hồi qua email";
      }

      transitionCaseStatus({
        caseId,
        toStatus: "comparison_ready",
        actorId: "system",
        actorRole: "procurement",
        reason: `NCC ${finalQuote.supplierName} đã phản hồi đàm phán thương lượng. Đã cập nhật báo giá V${roundNum}.`,
        orgId
      });
      broadcastRealtimeEvent("negotiation.updated", caseId, {
        supplierId,
        supplierName: finalQuote.supplierName,
        quoteId: finalQuote.id,
        totalAmount: finalQuote.totalAmount,
        round: roundNum,
      });
    }
  }
  
  broadcastRealtimeEvent("quote.extracted", caseId, finalQuote);
  logFlow("info", "quote.extraction.done", {
    traceId,
    caseId,
    supplierId,
    orgId,
    emailMessageId: email.id,
    quoteId,
    round: roundNum,
    status: dbState.procurement_cases.find(c => c.id === caseId)?.status,
    totalAmount: finalQuote.totalAmount,
    durationMs: Date.now() - startedAt,
  });
  
  // Persist State incrementally to Database
  (async () => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("email_messages", email, client);
      await persistRecord("quotes", finalQuote, client);
      if (typeof quoteVer !== "undefined" && quoteVer) {
        await persistRecord("quote_versions", quoteVer, client);
      }
      const rfqCase = dbState.rfq_cases.find((r: any) => r.id === caseObj.currentRfqId);
      if (rfqCase) {
        await persistRecord("rfq_cases", rfqCase, client);
      }
      await persistRecord("procurement_cases", caseObj, client);
      const activeLogs = dbState.ai_negotiation_logs.filter(
        l => l.caseId === caseId && l.supplierId === supplierId
      );
      for (const log of activeLogs) {
        await persistRecord("ai_negotiation_logs", log, client);
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  })().catch((err) => {
    logFlow("error", "quote.extraction.persist_failed", {
      traceId,
      caseId,
      supplierId,
      orgId,
      emailMessageId: email.id,
      quoteId,
      err: safeError(err),
    });
    console.error("Failed to incrementally persist extracted quote:", err);
  });
}

function simulateQuoteExtraction(caseObj: any, supplierObj: any, multiplier: number) {
  if (!caseObj) return { items: [], subtotal: 0, taxAmount: 0, shippingFee: 0, totalAmount: 0, deliveryDays: 3, paymentTerms: "COD", aiConfidenceScore: 90 };
  
  const items = caseObj.items.map((it: any) => {
    let unitPrice = 28000;
    if (it.name.includes("Gạo ST25")) unitPrice = 27500;
    if (it.name.includes("Dầu Ăn")) unitPrice = 190000;
    if (it.name.includes("Mỹ")) unitPrice = 235000;
    if (it.name.includes("Xà Lách")) unitPrice = 32000;
    
    const finalPrice = Math.round(unitPrice * multiplier);
    return {
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: finalPrice,
      totalPrice: finalPrice * it.quantity
    };
  });
  
  const subtotal = items.reduce((sum: number, it: any) => sum + it.totalPrice, 0);
  const taxAmount = 0; // Không tự ý bịa thuế VAT khi giả lập
  const shippingFee = 0; // Không tự ý bịa phí vận chuyển khi giả lập
  const totalAmount = subtotal;
  const deliveryDays = multiplier < 1 ? 3 : 1;
  const paymentTerms = multiplier < 1.0 ? "COD - Nhận hàng trả tiền" : "Công nợ giãn nợ Net 15 ngày";
  
  return {
    items,
    subtotal,
    taxAmount,
    shippingFee,
    totalAmount,
    deliveryDays,
    paymentTerms,
    aiConfidenceScore: 98
  };
}

function enrichQuoteForComparison(quote: Quote, caseId: string) {
  const negotiationLogs = dbState.ai_negotiation_logs
    .filter(log => log.caseId === caseId && log.supplierId === quote.supplierId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const latestNegotiation =
    negotiationLogs.filter(log => log.status === "supplier_responded").at(-1) ||
    negotiationLogs.filter(log => log.status === "sent").at(-1) ||
    negotiationLogs.at(-1);
  const versions = dbState.quote_versions.filter(version => version.quoteId === quote.id);

  return {
    ...quote,
    negotiationStatus: latestNegotiation?.status || "none",
    negotiationRound: latestNegotiation?.round,
    negotiationGoal: latestNegotiation?.promptGoal,
    lastNegotiatedAt: latestNegotiation?.createdAt,
    supplierReplyRaw: latestNegotiation?.supplierReplyRaw,
    versionCount: versions.length,
  };
}

function getQuoteReviewFlagsForComparison(quote: Quote): string[] {
  const flags: string[] = [];
  const paymentTerms = quote.paymentTerms?.trim().toLowerCase() || "";

  if (quote.aiConfidenceScore < 65) {
    flags.push("confidence_below_threshold");
  }
  if (!Number.isFinite(quote.totalAmount) || quote.totalAmount <= 0) {
    flags.push("invalid_total_amount");
  } else if (quote.totalAmount < 1000) {
    flags.push("suspiciously_small_total_amount");
  }
  if (paymentTerms === "" || paymentTerms.includes("không đề cập")) {
    flags.push("missing_payment_terms");
  }
  if (quote.items.some(item => item.unitPrice <= 0 || item.totalPrice <= 0)) {
    flags.push("missing_item_price");
  }

  return flags;
}

function quoteNeedsReviewForComparison(quote: Quote): boolean {
  return getQuoteReviewFlagsForComparison(quote).length > 0;
}

// ----------------------------------------------------
// COMPARISON MATRIX GENERATOR
// ----------------------------------------------------
apiV1Router.get("/cases/:caseId/comparison", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const rfqId = caseObj.currentRfqId;
  const rfqCase = rfqId ? dbState.rfq_cases.find(r => r.id === rfqId && r.organizationId === orgId) : undefined;
  const quotesList = rfqId ? dbState.quotes.filter(q => q.rfqCaseId === rfqId && q.organizationId === orgId) : [];
  const decoratedQuotesList = quotesList.map(quote => enrichQuoteForComparison(quote, caseId));
  const supplierById = new Map<string, Supplier>(dbState.suppliers.filter(s => s.organizationId === orgId).map(s => [s.id, s]));
  const negotiationSupplierById = new Map<string, {
    supplierId: string;
    name: string;
    email: string;
    status: string;
    hasQuote: boolean;
    quoteId?: string;
  }>();

  for (const rfqSupplier of rfqCase?.suppliers || []) {
    if (!rfqSupplier.supplierId) continue;
    const supplier = supplierById.get(rfqSupplier.supplierId);
    negotiationSupplierById.set(rfqSupplier.supplierId, {
      supplierId: rfqSupplier.supplierId,
      name: supplier?.name || rfqSupplier.name,
      email: supplier?.email || rfqSupplier.email,
      status: rfqSupplier.status,
      hasQuote: Boolean(rfqSupplier.quoteId),
      quoteId: rfqSupplier.quoteId
    });
  }

  for (const quote of decoratedQuotesList) {
    if (!quote.supplierId) continue;
    const supplier = supplierById.get(quote.supplierId);
    negotiationSupplierById.set(quote.supplierId, {
      supplierId: quote.supplierId,
      name: supplier?.name || quote.supplierName,
      email: supplier?.email || negotiationSupplierById.get(quote.supplierId)?.email || "",
      status: "replied",
      hasQuote: true,
      quoteId: quote.id
    });
  }
  
  let lowestTotalQuoteId = "";
  let fastestDeliveryQuoteId = "";
  let recommendedQuoteId = "";
  let recommendationReason = "Hãy nộp thêm báo giá của các bên để AI tính toán ma trận rủi ro.";
  
  if (decoratedQuotesList.length > 0) {
    const sortedByPrice = [...decoratedQuotesList].sort((a, b) => a.totalAmount - b.totalAmount);
    const sortedByDelivery = [...decoratedQuotesList].sort((a, b) => a.deliveryDays - b.deliveryDays);
    const reviewableQuotes = decoratedQuotesList.filter(quote => !quoteNeedsReviewForComparison(quote));
    const sortedReviewableByPrice = [...reviewableQuotes].sort((a, b) => a.totalAmount - b.totalAmount);
    
    lowestTotalQuoteId = sortedByPrice[0].id;
    fastestDeliveryQuoteId = sortedByDelivery[0].id;
    recommendedQuoteId = sortedReviewableByPrice[0]?.id || "";

    if (sortedReviewableByPrice.length > 0) {
      recommendationReason = `Hệ thống chỉ xét các báo giá không có red-flag. Phương án đang phù hợp nhất là **${sortedReviewableByPrice[0].supplierName}** với tổng giá trị ${sortedReviewableByPrice[0].totalAmount.toLocaleString()}đ. Các báo giá bị cảnh báo cần người mua xác nhận thủ công trước khi trình duyệt.`;
    } else {
      recommendationReason = "Tất cả báo giá hiện có đều đang có red-flag. Hệ thống chưa đưa vào đề xuất tối ưu tự động; người mua cần đối chiếu file/email gốc và bấm xác nhận thủ công nếu muốn trình duyệt một NCC.";
    }
  }
  
  res.json({
    caseId,
    items: caseObj.items,
    suppliers: rfqCase?.suppliers || [],
    negotiationSuppliers: Array.from(negotiationSupplierById.values()),
    matrix: decoratedQuotesList,
    summary: {
      lowestTotalQuoteId,
      fastestDeliveryQuoteId,
      recommendedQuoteId,
      recommendationReason
    }
  });
});

// ----------------------------------------------------
// AI NEGOTIATION APIs
// ----------------------------------------------------
apiV1Router.post("/cases/:caseId/negotiations/:supplierId/draft", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId, supplierId } = req.params;
  const { goal } = req.body; // e.g. "discount_5", "faster_delivery", "longer_terms"
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  const rfqObj = caseObj?.currentRfqId
    ? dbState.rfq_cases.find(r => r.id === caseObj.currentRfqId && r.organizationId === orgId)
    : undefined;
  const supplier = dbState.suppliers.find(s => s.id === supplierId && s.organizationId === orgId);
  const rfqSupplier = rfqObj?.suppliers.find(s => s.supplierId === supplierId);
  
  if (!caseObj) {
    return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: "Không tìm thấy case" } });
  }
  if (!supplier && !rfqSupplier) {
    return res.status(404).json({ error: { code: "SUPPLIER_NOT_FOUND", message: "NCC này không còn nằm trong danh sách RFQ hoặc danh bạ nhà cung cấp." } });
  }
  
  const rfqId = caseObj.currentRfqId;
  const quote = dbState.quotes.find(q => q.rfqCaseId === rfqId && q.supplierId === supplierId);
  const supplierName = supplier?.name || rfqSupplier?.name || "nhà cung cấp";
  
  let targetDetail = "giảm giá 5%";
  if (goal === "faster_delivery") targetDetail = "rút ngắn thời gian giao hàng xuống 1 ngày";
  if (goal === "longer_terms") targetDetail = "giãn nợ công nợ lên 30 ngày";
  
  const currentPriceText = quote ? `${quote.totalAmount.toLocaleString()}đ` : "báo giá chào thầu";
  
  let draftEmail = `<p>Chào anh/chị đại diện <strong>${supplierName}</strong>,</p>
<p>Ban mua sắm Stally chân thành cảm ơn bảng chào thầu nguyên liệu trị giá <strong>${currentPriceText}</strong> của quý công ty.</p>
<p>Để tiến tới ký kết PO chính thức dài hạn, chúng tôi mong muốn thương lượng thêm về điều khoản: <strong>${targetDetail}</strong>.</p>
<p>Kính mong quý đối tác cân nhắc điều chỉnh để Stally duyệt hồ sơ mua sắm này khẩn cấp. Xin cảm ơn!</p>
<p>Trân trọng,<br>Ban mua sắm Stally F&B</p>`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy đóng vai trò là một chuyên viên mua sắm chuyên nghiệp. Hãy soạn thảo một email đàm phán gửi đến NCC ${supplierName} nhằm mục tiêu: ${targetDetail}. 
Lưu ý quan trọng về số tiền: Tổng trị giá của toàn bộ báo giá thầu/đơn hàng (tổng số tiền cho tất cả nguyên liệu cộng lại) hiện tại là: ${currentPriceText} (đây là tổng giá trị của toàn bộ đơn thầu, tuyệt đối không phải là đơn giá của từng món hay của một đơn vị sản phẩm).
Thư viết bằng tiếng Việt trang trọng, định dạng HTML.
QUAN TRỌNG: Chỉ trả về duy nhất nội dung email thô (bắt đầu từ phần Kính gửi/Chào đối tác đến hết phần Ký tên). Tuyệt đối không thêm bất kỳ lời giới thiệu, giải thích, lời bàn luận của AI, hoặc bao bọc mã trong khối code block markdown (như \`\`\`html) nào khác.`
      });
      if (response.text) {
        let cleanText = response.text.trim();
        if (cleanText.includes("```")) {
          cleanText = cleanText.replace(/```html?/g, "").replace(/```/g, "").trim();
        }
        draftEmail = cleanText;
      }
    } catch (e) {}
  }
  
  const logId = `neg-log-${Date.now()}`;
  const newLog: AiNegotiationLog = {
    id: logId,
    caseId,
    supplierId,
    round: 1,
    promptGoal: goal,
    draftEmail,
    status: "draft",
    createdAt: new Date().toISOString()
  };
  
  dbState.ai_negotiation_logs.push(newLog);

  try {
    await persistRecord("ai_negotiation_logs", newLog);
  } catch (err) {
    logFlow("error", "negotiation.draft.persist_failed", {
      traceId: req.traceId || createTraceId("neg-draft"),
      caseId,
      supplierId,
      orgId,
      negotiationLogId: newLog.id,
      err: safeError(err),
    });
  }

  res.json({ data: newLog });
});

apiV1Router.post("/negotiation-drafts/:draftId/send", async (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { draftId } = req.params;
  const { editedBody } = req.body;
  
  const log = dbState.ai_negotiation_logs.find(l => l.id === draftId);
  if (!log) return res.status(404).json({ error: { code: "NEGOTIATION_DRAFT_NOT_FOUND", message: "Không tìm thấy thư đàm phán nháp" } });

  // Actually send real email via Nodemailer
  const caseObj = dbState.procurement_cases.find(c => c.id === log.caseId && c.organizationId === orgId);
  const rfqObj = caseObj?.currentRfqId
    ? dbState.rfq_cases.find(r => r.id === caseObj.currentRfqId && r.organizationId === orgId)
    : undefined;
  const supplier = dbState.suppliers.find((s: any) => s.id === log.supplierId && s.organizationId === orgId);
  const rfqSupplier = rfqObj?.suppliers.find(s => s.supplierId === log.supplierId);
  const supplierEmail = supplier?.email || rfqSupplier?.email;
  if (!supplierEmail) {
    return res.status(400).json({ error: { code: "SUPPLIER_EMAIL_MISSING", message: "NCC chưa có email hợp lệ để gửi thư đàm phán." } });
  }

  try {
    const sendResult = await sendRealEmail({
      to: supplierEmail,
      subject: `[STALLY NEGOTIATION-${log.caseId.toUpperCase()}] Thương lượng báo giá Case thầu`,
      html: editedBody || log.draftEmail
    });
    if (!sendResult.success) {
      throw new Error(sendResult.error || "NEGOTIATION_EMAIL_SEND_FAILED");
    }
    const outboundEmail: EmailMessage = {
      id: `email-out-neg-${Date.now()}-${log.supplierId}`,
      organizationId: orgId,
      gmailAccountId: "gmail-api-1",
      gmailMessageId: sendResult.messageId || `gmail-api-neg-${Date.now()}-${log.supplierId}`,
      gmailThreadId: `thread-neg-${Date.now()}`,
      internetMessageId: `<neg-${Date.now()}@stally.com>`,
      direction: "outbound",
      from: process.env.GMAIL_API_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "procurement@stally.com",
      to: [supplierEmail],
      subject: `[STALLY NEGOTIATION-${log.caseId.toUpperCase()}] Thương lượng báo giá Case thầu`,
      bodyHtml: editedBody || log.draftEmail,
      linkedCaseId: log.caseId,
      linkedSupplierId: log.supplierId,
      classification: "negotiation",
      attachments: [],
      createdAt: new Date().toISOString()
    };

    dbState.email_messages.push(outboundEmail);
    log.status = "sent";
    if (editedBody) log.userEditedEmail = editedBody;

    try {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await persistRecord("ai_negotiation_logs", log, client);
        await persistRecord("email_messages", outboundEmail, client);
        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (persistErr) {
      logFlow("error", "negotiation.send.persist_failed", {
        traceId: req.traceId || createTraceId("neg-send"),
        caseId: log.caseId,
        supplierId: log.supplierId,
        orgId,
        negotiationLogId: log.id,
        emailMessageId: outboundEmail.id,
        err: safeError(persistErr),
      });
      return res.status(500).json({
        error: {
          code: "NEGOTIATION_PERSIST_FAILED",
          message: "Email đàm phán đã gửi nhưng hệ thống chưa lưu được log. Vui lòng kiểm tra database trước khi thao tác tiếp.",
        }
      });
    }
  } catch (err) {
    console.error("Sending real negotiation email failed:", err);
    return res.status(502).json({
      error: {
        code: "NEGOTIATION_EMAIL_SEND_FAILED",
        message: "Gửi email đàm phán thất bại. Case chưa chuyển sang trạng thái chờ phản hồi.",
      }
    });
  }
  
  // Transition Case status
  transitionCaseStatus({
    caseId: log.caseId,
    toStatus: "negotiating",
    actorId: "u-1",
    actorRole: "procurement",
    reason: `Gửi email đàm phán thương lượng chào giá đến NCC qua hòm thư Gmail.`,
    orgId
  });
  
  // CẢNH BÁO / LƯU Ý: Đã tắt tự động giả lập phản hồi sau 1 giây 
  // để hệ thống chờ nhận email thật từ đối tác qua cổng IMAP/Gmail.
  // Nếu bạn muốn giả lập phản hồi nhanh mà không cần gửi email thật, 
  // hãy bỏ comment đoạn code setTimeout dưới đây:
  /*
  setTimeout(() => {
    simulateSupplierNegotiationReply(log.caseId, log.supplierId, log.promptGoal);
  }, 1000);
  */
  
  res.json({ data: log });
});

async function simulateSupplierNegotiationReply(caseId: string, supplierId: string, goal: string) {
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId);
  const supplierObj = dbState.suppliers.find(s => s.id === supplierId);
  const quote = dbState.quotes.find(q => q.rfqCaseId === caseObj?.currentRfqId && q.supplierId === supplierId);
  
  if (!quote) return;
  
  let multiplier = 0.95; // 5% discount
  let deliveryDays = quote.deliveryDays;
  let paymentTerms = quote.paymentTerms;
  
  if (goal === "faster_delivery") {
    deliveryDays = Math.max(1, quote.deliveryDays - 1);
  }
  if (goal === "longer_terms") {
    paymentTerms = "Giãn nợ thanh toán sau 30 ngày (Net 30)";
  }
  
  const updatedItems = quote.items.map(it => {
    const finalPrice = Math.round(it.unitPrice * multiplier);
    return {
      ...it,
      unitPrice: finalPrice,
      totalPrice: finalPrice * it.quantity
    };
  });
  
  const subtotal = updatedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const taxAmount = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + taxAmount + quote.shippingFee;
  
  // Mutate Quote
  quote.items = updatedItems;
  quote.subtotal = subtotal;
  quote.taxAmount = taxAmount;
  quote.totalAmount = totalAmount;
  quote.deliveryDays = deliveryDays;
  quote.paymentTerms = paymentTerms;
  quote.createdAt = new Date().toISOString();
  
  // Log Quote Version
  const quoteVer: QuoteVersion = {
    id: `qv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    quoteId: quote.id,
    round: 2,
    items: quote.items,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    shippingFee: quote.shippingFee,
    totalAmount: quote.totalAmount,
    deliveryDays: quote.deliveryDays,
    paymentTerms: quote.paymentTerms,
    validUntil: quote.validUntil,
    aiConfidenceScore: 99,
    createdAt: new Date().toISOString()
  };
  dbState.quote_versions.push(quoteVer);
  
  // Write negotiation response log
  const activeLogs = dbState.ai_negotiation_logs.filter(l => l.caseId === caseId && l.supplierId === supplierId);
  if (activeLogs.length > 0) {
    activeLogs[activeLogs.length - 1].status = "supplier_responded";
    activeLogs[activeLogs.length - 1].supplierReplyRaw = `Chào Stally, chúng tôi đồng ý giảm giá và gửi bảng báo giá điều chỉnh. Đơn giá mới đã được cập nhật thành công.`;
  }
  
  // Transition Case back to comparison_ready
  transitionCaseStatus({
    caseId,
    toStatus: "comparison_ready",
    actorId: "system",
    actorRole: "procurement",
    reason: `NCC ${supplierObj?.name} đã phản hồi giảm giá. Phiên bản báo giá v2 đã cập nhật.`,
    orgId: "org-1"
  });
  
  // Send email log
  const emailMsg: EmailMessage = {
    id: `email-in-neg-${Date.now()}`,
    organizationId: "org-1",
    gmailAccountId: "acc-1",
    gmailMessageId: `msg-in-neg-${Date.now()}`,
    gmailThreadId: `thread-in-neg-${Date.now()}`,
    direction: "inbound",
    from: supplierObj ? `${supplierObj.name} <supplier@negotiate.com>` : "supplier@negotiate.com",
    to: ["procurement@stally.com"],
    subject: `Re: Đàm phán báo giá thầu nguyên liệu`,
    bodyText: `Chào anh Tâm, chúng tôi đã xem xét thư và đồng ý giảm giá thành công. Vui lòng xem bản cập nhật.`,
    linkedCaseId: caseId,
    linkedSupplierId: supplierId,
    classification: "negotiation",
    attachments: [],
    createdAt: new Date().toISOString()
  };
  dbState.email_messages.push(emailMsg);
  
  broadcastRealtimeEvent("quote.confirmed", caseId, quote);
  
  // Persist State incrementally to Database
  (async () => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("quotes", quote, client);
      await persistRecord("quote_versions", quoteVer, client);
      const activeLogs = dbState.ai_negotiation_logs.filter(l => l.caseId === caseId && l.supplierId === supplierId);
      if (activeLogs.length > 0) {
        await persistRecord("ai_negotiation_logs", activeLogs[activeLogs.length - 1], client);
      }
      await persistRecord("email_messages", emailMsg, client);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  })().catch((err) => {
    console.error("Failed to incrementally persist negotiation reply:", err);
  });
}

// ----------------------------------------------------
// MANAGER APPROVAL QUEUE APIs
// ----------------------------------------------------
apiV1Router.post("/cases/:caseId/approval/request", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { selectedQuoteId, comment, manualRiskAccepted } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });

  const quote = dbState.quotes.find(q => q.id === selectedQuoteId && q.organizationId === orgId);
  if (!quote) {
    return res.status(400).json({ error: "Không tìm thấy báo giá trình duyệt" });
  }
  if (quoteNeedsReviewForComparison(quote) && manualRiskAccepted !== true) {
    return res.status(400).json({
      error: {
        code: "QUOTE_REQUIRES_MANUAL_REVIEW",
        message: "Báo giá này đang có red-flag. Người mua cần xác nhận đã kiểm tra file/email gốc trước khi trình duyệt.",
      }
    });
  }
  
  caseObj.selectedQuoteId = selectedQuoteId;
  
  transitionCaseStatus({
    caseId,
    toStatus: "pending_approval",
    actorId: "u-1",
    actorRole: "procurement",
    reason: comment || `Trình hồ sơ so sánh thầu tối ưu lên Trưởng phòng phê duyệt đơn PO.`,
    orgId
  });
  
  res.json({ message: "Đã nộp hồ sơ xin phê duyệt PO", data: caseObj });
});

apiV1Router.get("/approval-requests", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const pendingCases = dbState.procurement_cases.filter(c => c.status === "pending_approval" && c.organizationId === orgId);
  res.json({ data: pendingCases });
});

apiV1Router.post("/approval-requests/:caseId/approve", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { comment, selectedQuoteId } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
  const quoteId = selectedQuoteId || caseObj.selectedQuoteId;
  const quote = dbState.quotes.find(q => q.id === quoteId);
  
  if (!quote) return res.status(400).json({ error: "Không tìm thấy báo giá phê duyệt" });
  
  caseObj.selectedQuoteId = quote.id;
  quote.status = "selected";
  
  // Reject other quotes
  dbState.quotes.forEach(q => {
    if (q.rfqCaseId === quote.rfqCaseId && q.id !== quote.id) {
      q.status = "rejected";
    }
  });
  const touchedQuotes = dbState.quotes.filter(q => q.rfqCaseId === quote.rfqCaseId);
  
  transitionCaseStatus({
    caseId,
    toStatus: "approved",
    actorId: "u-3",
    actorRole: "manager",
    reason: comment || `Phê duyệt báo giá của ${quote.supplierName} làm đơn đặt hàng PO chính thức.`,
    orgId
  });
  
  setTimeout(() => {
    // Auto transition to po_draft
    transitionCaseStatus({
      caseId,
      toStatus: "po_draft",
      actorId: "system",
      actorRole: "procurement",
      reason: "Hệ thống tự khởi tạo Bản thảo Đơn đặt hàng (Draft PO)",
      orgId
    });
  }, 300);

  try {
    await persistRecords("quotes", touchedQuotes);
  } catch (err) {
    logFlow("error", "approval.approve.quotes_persist_failed", {
      traceId: req.traceId || createTraceId("approval-approve"),
      caseId,
      orgId,
      quoteIds: touchedQuotes.map(q => q.id),
      err: safeError(err),
    });
    return res.status(500).json({
      error: {
        code: "APPROVAL_PERSIST_FAILED",
        message: "Đã cập nhật phê duyệt trong bộ nhớ nhưng chưa lưu được trạng thái báo giá xuống database.",
      }
    });
  }
  
  res.json({ message: "Phê duyệt thầu thành công!", data: caseObj });
});

apiV1Router.post("/approval-requests/:caseId/reject", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { comment } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
  transitionCaseStatus({
    caseId,
    toStatus: "negotiating",
    actorId: "u-3",
    actorRole: "manager",
    reason: `Bác bỏ hồ sơ thầu. Lý do: ${comment || "Không đạt tiêu chuẩn chi phí"}`,
    orgId
  });
  
  res.json({ message: "Đã bác bỏ hồ sơ thầu", data: caseObj });
});

// ----------------------------------------------------
// PURCHASE ORDER & LOGISTICS INTEGRATION APIs
// ----------------------------------------------------
apiV1Router.post("/cases/:caseId/po-draft", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj || !caseObj.selectedQuoteId) {
    return res.status(400).json({ error: "Chưa chọn hoặc chưa duyệt báo giá thầu" });
  }

  const existingPo = dbState.purchase_orders.find(po =>
    po.organizationId === orgId &&
    po.caseId === caseId &&
    po.status !== "cancelled" &&
    (po.id === caseObj.purchaseOrderId || po.quoteId === caseObj.selectedQuoteId)
  );
  if (existingPo) {
    if (caseObj.purchaseOrderId !== existingPo.id) {
      caseObj.purchaseOrderId = existingPo.id;
      try {
        await persistRecord("procurement_cases", caseObj);
      } catch (err) {
        logFlow("warn", "po.draft.link_existing_persist_failed", {
          traceId: req.traceId || createTraceId("po-draft"),
          caseId,
          poId: existingPo.id,
          orgId,
          err: safeError(err),
        });
      }
    }
    return res.json({ data: existingPo, reused: true });
  }
  
  const quote = dbState.quotes.find(q => q.id === caseObj.selectedQuoteId);
  if (!quote) return res.status(400).json({ error: "Không tìm thấy báo giá" });
  
  const poId = `po-${Date.now()}`;
  const po: PurchaseOrder = {
    id: poId,
    organizationId: orgId,
    caseId,
    supplierId: quote.supplierId,
    supplierName: quote.supplierName,
    quoteId: quote.id,
    items: quote.items.map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice
    })),
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    shippingFee: quote.shippingFee,
    totalAmount: quote.totalAmount,
    status: "issued",
    approvedBy: "Nguyễn Thị Mai (Giám Đốc)",
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  dbState.purchase_orders.push(po);
  caseObj.purchaseOrderId = poId;

  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("purchase_orders", po, client);
      await persistRecord("procurement_cases", caseObj, client);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logFlow("error", "po.draft.persist_failed", {
      traceId: req.traceId || createTraceId("po-draft"),
      caseId,
      poId,
      orgId,
      err: safeError(err),
    });
    return res.status(500).json({
      error: {
        code: "PO_DRAFT_PERSIST_FAILED",
        message: "Không lưu được bản thảo PO xuống database.",
      }
    });
  }
  
  res.json({ data: po });
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatVndForEmail(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function buildPurchaseOrderEmailHtml(po: PurchaseOrder, caseObj: ProcurementCase) {
  const rows = po.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatVndForEmail(item.unitPrice)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${formatVndForEmail(item.totalPrice)}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Xác nhận đơn đặt hàng chính thức</h2>
      <p>Xin chào <strong>${escapeHtml(po.supplierName)}</strong>,</p>
      <p>Stally xác nhận đặt hàng chính thức theo thông tin dưới đây. Vui lòng phản hồi email này để xác nhận lịch giao hàng và các điều kiện thực hiện đơn hàng.</p>
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:16px 0;">
        <p style="margin:0;"><strong>Mã PO:</strong> ${escapeHtml(po.id.toUpperCase())}</p>
        <p style="margin:6px 0 0;"><strong>Hồ sơ mua hàng:</strong> ${escapeHtml(caseObj.title)}</p>
        <p style="margin:6px 0 0;"><strong>Tổng giá trị:</strong> ${formatVndForEmail(po.totalAmount)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Mặt hàng</th>
            <th style="padding:10px;text-align:right;">Số lượng</th>
            <th style="padding:10px;text-align:right;">Đơn giá</th>
            <th style="padding:10px;text-align:right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;">Trân trọng,<br/>Stally Procurement</p>
    </div>
  `.trim();
}

apiV1Router.post("/purchase-orders/:poId/send", async (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { poId } = req.params;
  
  const po = dbState.purchase_orders.find(p => p.id === poId && p.organizationId === orgId);
  if (!po) return res.status(404).json({ error: "Không tìm thấy PO" });
  if (po.status !== "issued") {
    return res.status(409).json({
      error: {
        code: "PO_ALREADY_SENT_OR_CLOSED",
        message: "PO này đã được gửi, nhập kho hoặc hủy trước đó.",
      }
    });
  }
  
  const caseObj = dbState.procurement_cases.find(c => c.id === po.caseId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });

  const supplier = dbState.suppliers.find(s => s.id === po.supplierId && s.organizationId === orgId);
  const rfqSupplierEmail = caseObj.currentRfqId
    ? dbState.rfq_cases
      .find(rfq => rfq.id === caseObj.currentRfqId && rfq.organizationId === orgId)
      ?.suppliers.find(item => item.supplierId === po.supplierId)?.email
    : "";
  const supplierEmail = supplier?.email || rfqSupplierEmail;
  if (!supplierEmail) {
    return res.status(400).json({
      error: {
        code: "SUPPLIER_EMAIL_MISSING",
        message: "NCC chưa có email hợp lệ để gửi PO chính thức.",
      }
    });
  }

  const poEmailSubject = `[STALLY PO-${po.id.toUpperCase()}] Xác nhận đơn đặt hàng chính thức`;
  const poEmailHtml = buildPurchaseOrderEmailHtml(po, caseObj);
  const poEmailText = [
    `Stally xác nhận đơn đặt hàng chính thức ${po.id.toUpperCase()}.`,
    `Hồ sơ: ${caseObj.title}`,
    `Nhà cung cấp: ${po.supplierName}`,
    `Tổng giá trị: ${formatVndForEmail(po.totalAmount)}`,
    "",
    "Chi tiết hàng đặt:",
    ...po.items.map(item => `- ${item.name}: ${item.quantity} ${item.unit} x ${formatVndForEmail(item.unitPrice)} = ${formatVndForEmail(item.totalPrice)}`),
    "",
    "Vui lòng phản hồi email này để xác nhận lịch giao hàng và các điều kiện thực hiện đơn hàng.",
  ].join("\n");

  const sendResult = await sendRealEmail({
    to: supplierEmail,
    subject: poEmailSubject,
    html: poEmailHtml,
    text: poEmailText,
  });
  if (!sendResult.success) {
    logFlow("error", "po.email.send_failed", {
      traceId: req.traceId || createTraceId("po-send"),
      poId,
      caseId: po.caseId,
      orgId,
      supplierId: po.supplierId,
      supplierEmail: maskEmail(supplierEmail),
      err: safeError(sendResult.error),
    });
    return res.status(502).json({
      error: {
        code: "PO_EMAIL_SEND_FAILED",
        message: "Không gửi được email PO chính thức đến NCC. Trạng thái PO chưa được cập nhật.",
        details: sendResult.error,
      }
    });
  }
  
  po.status = "confirmed";
  
  // INVENTORY quantityOnOrder IMPACT
  const touchedInventoryItems: InventoryItem[] = [];
  po.items.forEach(poItem => {
    const invItem = getOrCreateInventoryItemForPoItem(orgId, poItem);
    invItem.quantityOnOrder += poItem.quantity;
    invItem.lastPurchasePrice = poItem.unitPrice;
    invItem.updatedAt = new Date().toISOString();
    touchedInventoryItems.push(invItem);
  });

  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("purchase_orders", po, client);
      for (const item of touchedInventoryItems) {
        await persistRecord("inventory_items", item, client);
      }
      const outboundEmail: EmailMessage = {
        id: `email-out-po-${Date.now()}-${po.id}`,
        organizationId: orgId,
        gmailAccountId: "gmail-api-1",
        gmailMessageId: sendResult.messageId || `gmail-api-po-${Date.now()}-${po.id}`,
        gmailThreadId: `thread-po-${Date.now()}`,
        internetMessageId: `<po-${Date.now()}@stally.com>`,
        direction: "outbound",
        from: process.env.GMAIL_API_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "procurement@stally.com",
        to: [supplierEmail],
        subject: poEmailSubject,
        bodyText: poEmailText,
        bodyHtml: poEmailHtml,
        sentAt: new Date().toISOString(),
        linkedCaseId: po.caseId,
        linkedSupplierId: po.supplierId,
        classification: "po",
        attachments: [],
        createdAt: new Date().toISOString()
      };
      dbState.email_messages.push(outboundEmail);
      await persistRecord("email_messages", outboundEmail, client);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logFlow("error", "po.send.persist_failed", {
      traceId: req.traceId || createTraceId("po-send"),
      poId,
      caseId: po.caseId,
      orgId,
      inventoryItemIds: touchedInventoryItems.map(item => item.id),
      err: safeError(err),
    });
    return res.status(500).json({
      error: {
        code: "PO_SEND_PERSIST_FAILED",
        message: "Không lưu được trạng thái gửi PO hoặc tồn kho đang về.",
      }
    });
  }
  
  // Transition Case Status to po_sent
  transitionCaseStatus({
    caseId: po.caseId,
    toStatus: "po_sent",
    actorId: "u-1",
    actorRole: "procurement",
    reason: `Gửi Đơn mua sắm PO chính thức đến hòm thư NCC và tăng lượng tồn kho đang về (On Order)`,
    orgId
  });
  
  setTimeout(() => {
    transitionCaseStatus({
      caseId: po.caseId,
      toStatus: "receiving",
      actorId: "system",
      actorRole: "warehouse",
      reason: "Hàng hóa chuyển sang trạng thái đang vận chuyển (Receiving Phase)",
      orgId
    });
  }, 400);
  
  res.json({ message: "PO confirmed and sent.", data: po, email: { messageId: sendResult.messageId, to: supplierEmail } });
});

apiV1Router.get("/purchase-orders", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const pos = dbState.purchase_orders.filter(p => p.organizationId === orgId);
  res.json({ data: pos });
});

apiV1Router.get("/purchase-orders/:poId", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const po = dbState.purchase_orders.find(p => p.id === req.params.poId && p.organizationId === orgId);
  if (!po) return res.status(404).json({ error: "Không tìm thấy" });
  res.json({ data: po });
});

// ----------------------------------------------------
// INVENTORY & WAREHOUSE LOGISTICS APIs
// ----------------------------------------------------
function normalizeInventoryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getInventoryNameTokens(name: string) {
  const stopWords = new Set([
    "cao",
    "cap",
    "loai",
    "hang",
    "premium",
    "organic",
    "tuoi",
    "moi",
    "nhap",
    "khau"
  ]);
  return normalizeInventoryName(name)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !stopWords.has(token));
}

function scoreInventoryPoItemMatch(item: InventoryItem, poItem: PurchaseOrderItem) {
  const itemName = normalizeInventoryName(item.name);
  const poName = normalizeInventoryName(poItem.name);
  if (!itemName || !poName) return 0;

  let score = 0;
  if (itemName === poName) score += 100;
  if (itemName.includes(poName) || poName.includes(itemName)) score += 70;

  const itemTokens = new Set(getInventoryNameTokens(item.name));
  const poTokens = getInventoryNameTokens(poItem.name);
  if (poTokens.length === 0) return score;

  const matchedTokens = poTokens.filter(token => itemTokens.has(token));
  const coverage = matchedTokens.length / poTokens.length;
  score += coverage * 60;

  if (item.unit.trim().toLowerCase() === poItem.unit.trim().toLowerCase()) {
    score += 15;
  }

  return score;
}

function buildInventorySku(orgId: string, name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 24) || "ITEM";
  return `PO-${orgId}-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function findInventoryItemByPoItem(orgId: string, poItem: PurchaseOrderItem) {
  const candidates = dbState.inventory_items
    .filter(it => it.organizationId === orgId)
    .map(item => ({ item, score: scoreInventoryPoItemMatch(item, poItem) }))
    .filter(result => result.score >= 75)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.item;
}

function getOrCreateInventoryItemForPoItem(orgId: string, poItem: PurchaseOrderItem) {
  const existingItem = findInventoryItemByPoItem(orgId, poItem);
  if (existingItem) return existingItem;

  const newItem: InventoryItem = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: orgId,
    sku: buildInventorySku(orgId, poItem.name),
    name: poItem.name,
    category: "PO Received",
    unit: poItem.unit,
    minStockLevel: 0,
    quantityAvailable: 0,
    quantityOnOrder: 0,
    lastPurchasePrice: poItem.unitPrice,
    updatedAt: new Date().toISOString()
  };

  dbState.inventory_items.push(newItem);
  return newItem;
}

apiV1Router.get("/inventory/items", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const items = dbState.inventory_items.filter(i => i.organizationId === orgId);
  res.json({ data: items });
});

apiV1Router.get("/inventory/low-stock", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const lowItems = dbState.inventory_items.filter(i => i.quantityAvailable < i.minStockLevel && i.organizationId === orgId);
  res.json({ data: lowItems });
});

apiV1Router.get("/inventory/movements", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const movements = dbState.stock_movements.filter(m => m.organizationId === orgId);
  res.json({ data: movements });
});

// WAREHOUSE GOODS RECEIVING LOG (Support partial receipts)
apiV1Router.post("/purchase-orders/:poId/receive", async (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { poId } = req.params;
  const { items, receivedAt } = req.body;
  
  const po = dbState.purchase_orders.find(p => p.id === poId && p.organizationId === orgId);
  if (!po) return res.status(404).json({ error: "Không tìm thấy PO" });
  if (po.status === "received") {
    return res.status(409).json({ error: { code: "PO_ALREADY_RECEIVED", message: "PO này đã được nhập kho trước đó." } });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: { code: "RECEIVE_ITEMS_REQUIRED", message: "Thiếu danh sách hàng hóa thực nhận." } });
  }
  
  const caseObj = dbState.procurement_cases.find(c => c.id === po.caseId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
  let fullyReceived = true;
  const inventoryUpdates: Array<{
    itemId: string;
    name: string;
    quantityReceived: number;
    quantityAvailableBefore: number;
    quantityAvailableAfter: number;
    quantityOnOrderBefore: number;
    quantityOnOrderAfter: number;
  }> = [];
  const touchedInventoryItems: InventoryItem[] = [];
  const createdMovements: StockMovement[] = [];
  
  items.forEach((recItem: any) => {
    const receivedName = String(recItem.name || "");
    const poItem = po.items
      .map(pi => ({
        item: pi,
        score: scoreInventoryPoItemMatch({
          id: "received-item",
          organizationId: orgId,
          sku: "",
          name: receivedName,
          category: "",
          unit: pi.unit,
          minStockLevel: 0,
          quantityAvailable: 0,
          quantityOnOrder: 0,
          lastPurchasePrice: 0,
          updatedAt: ""
        }, pi)
      }))
      .filter(match => match.score >= 75)
      .sort((a, b) => b.score - a.score)[0]?.item;
    if (!poItem) return;
    
    const qtyRec = Number(recItem.quantityReceived);
    if (!Number.isFinite(qtyRec) || qtyRec < 0) {
      fullyReceived = false;
      return;
    }
    
    // Decrement from quantityOnOrder, increment quantityAvailable
    const invItem = getOrCreateInventoryItemForPoItem(orgId, poItem);
    
    const quantityAvailableBefore = invItem.quantityAvailable;
    const quantityOnOrderBefore = invItem.quantityOnOrder;
    const orderImpact = Math.min(invItem.quantityOnOrder, qtyRec);
    invItem.quantityOnOrder = Math.max(0, invItem.quantityOnOrder - orderImpact);
    invItem.quantityAvailable += qtyRec;
    invItem.lastPurchasePrice = poItem.unitPrice;
    invItem.updatedAt = receivedAt || new Date().toISOString();
    touchedInventoryItems.push(invItem);

    inventoryUpdates.push({
      itemId: invItem.id,
      name: invItem.name,
      quantityReceived: qtyRec,
      quantityAvailableBefore,
      quantityAvailableAfter: invItem.quantityAvailable,
      quantityOnOrderBefore,
      quantityOnOrderAfter: invItem.quantityOnOrder
    });
    
    // Stock movement log
    if (qtyRec > 0) {
      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        organizationId: orgId,
        itemId: invItem.id,
        movementType: "in",
        quantity: qtyRec,
        referenceType: "purchase_order",
        referenceId: poId,
        createdBy: "Lý Văn Khoa (Thủ Kho)",
        createdAt: receivedAt || new Date().toISOString()
      };
      dbState.stock_movements.push(mov);
      createdMovements.push(mov);
    }
    
    if (qtyRec < poItem.quantity) {
      fullyReceived = false;
    }
  });

  if (inventoryUpdates.length === 0) {
    return res.status(400).json({ error: { code: "NO_RECEIVABLE_ITEMS_MATCHED", message: "Không có dòng hàng nhận kho nào khớp với PO." } });
  }
  
  if (fullyReceived) {
    po.status = "received";
    // Transition to closed
    transitionCaseStatus({
      caseId: po.caseId,
      toStatus: "closed",
      actorId: "u-4",
      actorRole: "warehouse",
      reason: "Hàng hóa nhập kho đầy đủ khớp PO. Khóa hồ sơ Case.",
      orgId
    });
  } else {
    // Partial receipt
    transitionCaseStatus({
      caseId: po.caseId,
      toStatus: "exception",
      actorId: "u-4",
      actorRole: "warehouse",
      reason: "Thiếu thâm hụt nguyên liệu so với PO chào bán ban đầu. Đưa vào diện ngoại lệ.",
      orgId
    });
  }

  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await persistRecord("purchase_orders", po, client);
      await persistRecord("procurement_cases", caseObj, client);
      for (const item of touchedInventoryItems) {
        await persistRecord("inventory_items", item, client);
      }
      for (const movement of createdMovements) {
        await persistRecord("stock_movements", movement, client);
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logFlow("error", "inventory.receive.persist_failed", {
      traceId: req.traceId || createTraceId("inventory-receive"),
      poId,
      caseId: po.caseId,
      orgId,
      inventoryItemIds: touchedInventoryItems.map(item => item.id),
      movementIds: createdMovements.map(movement => movement.id),
      err: safeError(err),
    });
    return res.status(500).json({
      error: {
        code: "INVENTORY_RECEIVE_PERSIST_FAILED",
        message: "Không lưu được dữ liệu nhập kho xuống database.",
      }
    });
  }
  
  res.json({ message: "Nhập kho thành công", po, inventoryUpdates });
});

apiV1Router.post("/inventory/adjustments", (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { itemId, quantity, type, reason } = req.body;
  
  const invItem = dbState.inventory_items.find(i => i.id === itemId && i.organizationId === orgId);
  if (!invItem) return res.status(404).json({ error: "Không tìm thấy mặt hàng trong kho" });
  
  const qty = Number(quantity);
  if (type === "out") {
    invItem.quantityAvailable = Math.max(0, invItem.quantityAvailable - qty);
  } else {
    invItem.quantityAvailable += qty;
  }
  invItem.updatedAt = new Date().toISOString();
  
  const mov: StockMovement = {
    id: `mov-${Date.now()}`,
    organizationId: orgId,
    itemId,
    movementType: type as "in" | "out" | "adjustment",
    quantity: qty,
    referenceType: "manual",
    referenceId: reason || "Điều chỉnh tồn kho thủ công",
    createdBy: "Lý Văn Khoa (Thủ Kho)",
    createdAt: new Date().toISOString()
  };
  
  dbState.stock_movements.push(mov);
  res.json({ data: invItem, movement: mov });
});

// ----------------------------------------------------
// AI ORCHESTRATOR BOT CHAT (DRAFT-AND-CONFIRM)
// ----------------------------------------------------
apiV1Router.post("/ai/chat", async (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { messages } = req.body;
  
  if (!messages || messages.length === 0) return res.status(400).json({ error: "Trống tin nhắn" });
  const userQuery = messages[messages.length - 1].content;
  const queryLower = userQuery.toLowerCase();
  
  const belowMinItems = dbState.inventory_items.filter(it => it.quantityAvailable < it.minStockLevel && it.organizationId === orgId);
  const activeCases = dbState.procurement_cases.filter(c => c.status !== "closed" && c.organizationId === orgId);
  const suppliersText = dbState.suppliers.filter(s => s.organizationId === orgId).map(s => `${s.name} (chuyên ${s.tags.join(", ")})`).join("; ");
  
  const systemPrompt = `Bạn là "Stally AI Agent Orchestrator" - Trợ lý số hóa vận hành doanh nghiệp.
Bạn chạy ở chế độ "Draft-and-Confirm" (Dự thảo và Xác nhận) tuyệt đối an toàn.
DỮ LIỆU THỜI GIAN THỰC ĐANG CÓ TRONG KHO:
- Nguyên liệu thâm hụt (Tồn < Ngưỡng):
${JSON.stringify(belowMinItems.map(i => ({ name: i.name, sku: i.sku, available: i.quantityAvailable, min: i.minStockLevel })))}
- Phiếu mua sắm đang mở:
${JSON.stringify(activeCases.map(p => ({ id: p.id, title: p.title, status: p.status, items: p.items })))}
- Danh sách NCC: ${suppliersText}

Nếu người dùng muốn đặt mua hàng, hãy phản hồi súc tích bằng tiếng Việt lịch sự, thông báo bạn đã lập đề xuất nháp, và trả về mã JSON đặc biệt nằm trong cặp thẻ hành động:
<DRAFT_ACTION>
{
  "title": "mô tả tiêu đề PR nháp",
  "priority": "low" hoặc "medium" hoặc "high",
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "unit": "đơn vị", "notes": "lý do" }
  ]
}
</DRAFT_ACTION>`;

  let replyText = "";
  
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: userQuery }] }],
        config: { systemInstruction: systemPrompt, temperature: 0.5 }
      });
      replyText = response.text || "";
    } catch (e) {
      replyText = getLocalFallbackChatReply(queryLower, belowMinItems);
    }
  } else {
    replyText = getLocalFallbackChatReply(queryLower, belowMinItems);
  }
  
  res.json({ message: replyText });
});

function getLocalFallbackChatReply(queryLower: string, belowMinItems: any[]) {
  if (queryLower.includes("hết") || queryLower.includes("kho") || queryLower.includes("cảnh báo") || queryLower.includes("thiếu")) {
    return `Chào bạn! Tôi phát hiện **${belowMinItems.length} mặt hàng** đang thâm hụt dưới ngưỡng tối thiểu:
${belowMinItems.map(it => `- ⚠️ **${it.name}**: Còn tồn kho khả dụng là **${it.quantityAvailable} ${it.unit}** (Ngưỡng an toàn tối thiểu là ${it.minStockLevel} ${it.unit}).`).join("\n")}
Bạn có muốn tôi tự động tạo phiếu PR nháp bổ sung khẩn cấp không?`;
  } else if (queryLower.includes("mua") || queryLower.includes("đặt") || queryLower.includes("tạo pr") || queryLower.includes("order")) {
    let itemName = "Gạo ST25 Cao Cấp";
    let qty = 50;
    let unit = "kg";
    
    if (queryLower.includes("gạo")) { itemName = "Gạo ST25 Cao Cấp"; unit = "kg"; }
    else if (queryLower.includes("dầu ăn")) { itemName = "Dầu Ăn Tường An 5L"; unit = "chai"; }
    else if (queryLower.includes("xà lách") || queryLower.includes("rau")) { itemName = "Xà Lách Mỹ Organic"; unit = "kg"; }
    
    const qtyMatch = queryLower.match(/\d+/);
    if (qtyMatch) qty = parseInt(qtyMatch[0], 10);
    
    return `Tôi đã lập dự thảo phiếu Purchase Request (PR) nháp cho bạn. 
Vui lòng bấm nút **[Gửi yêu cầu mua sắm]** bên dưới thẻ hành động để chuyển tiếp cho ban Thu mua.

<DRAFT_ACTION>
{
  "title": "Đề xuất mua sắm khẩn cấp ${itemName}",
  "priority": "high",
  "items": [
    { "name": "${itemName}", "quantity": ${qty}, "unit": "${unit}", "notes": "Tự động đề xuất bởi Trợ lý Stally AI" }
  ]
}
</DRAFT_ACTION>`;
  }
  
  return `Tôi là Trợ lý số hóa Stally AI Agent. 🌾
Bạn có thể hỏi tôi kiểm tra hàng hóa cạn kiệt hoặc nhờ tôi soạn phiếu đề xuất nháp bổ sung kho khẩn cấp bất kì lúc nào!`;
}

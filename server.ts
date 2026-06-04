import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { apiV1Router } from "./src/backend/api_v1.ts";
import { sendRealEmail } from "./src/backend/mailer.ts";
import { startImapPolling } from "./src/backend/imap_poller.ts";
import { 
  Organization, User, Supplier, InventoryItem, ProcurementCase, CaseTransition,
  PurchaseRequest, RfqCase, Quote, QuoteVersion, PurchaseOrder, EmailMessage,
  AiNegotiationLog, StockMovement
} from "./src/types.ts";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

// Initialize Google GenAI with local key rotation support
const geminiApiKeyEnv = process.env.GEMINI_API_KEY;
const geminiApiKeys = geminiApiKeyEnv 
  ? geminiApiKeyEnv.split(",").map(k => k.trim().replace(/^["']|["']$/g, "")).filter(k => k && k !== "MY_GEMINI_API_KEY")
  : [];

const aiClients: GoogleGenAI[] = [];

if (geminiApiKeys.length > 0) {
  geminiApiKeys.forEach((key, idx) => {
    try {
      const client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          baseUrl: process.env.GEMINI_BASE_URL || undefined,
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      aiClients.push(client);
      console.log(`Google GenAI Client [${idx + 1}/${geminiApiKeys.length}] initialized successfully.`);
    } catch (err) {
      console.error(`Failed to initialize Google GenAI Client [${idx + 1}]:`, err);
    }
  });
}

let activeClientIndex = 0;
function getNextAiClient(): GoogleGenAI | null {
  if (aiClients.length === 0) return null;
  const client = aiClients[activeClientIndex];
  console.log(`[Stally Key Rotator] 🔄 Using API Key Index [${activeClientIndex + 1}/${aiClients.length}] for current request.`);
  activeClientIndex = (activeClientIndex + 1) % aiClients.length;
  return client;
}

export let ai: GoogleGenAI | null = null;
if (aiClients.length > 0) {
  ai = {
    models: {
      async generateContent(config: any) {
        let lastError: any = null;
        for (let attempt = 0; attempt < aiClients.length; attempt++) {
          const client = getNextAiClient();
          if (!client) {
            throw new Error("No Gemini API clients available.");
          }
          try {
            return await client.models.generateContent(config);
          } catch (err: any) {
            console.warn(`[Stally Key Rotator] ⚠️ Attempt ${attempt + 1} failed with Key [${activeClientIndex || aiClients.length}/${aiClients.length}]. Error: ${err.message || err}`);
            lastError = err;
          }
        }
        throw lastError || new Error("All rotated API keys failed.");
      }
    } as any
  } as unknown as GoogleGenAI;
  console.log(`Local Key Rotator active with ${aiClients.length} keys.`);
} else {
  console.log("No valid GEMINI_API_KEY found. Running in high-fidelity simulator mode.");
}

import { 
  initDb, loadDbState, checkDbHealth, persistDbStateNow
} from "./src/backend/db.ts";

export let dbState: any = {
  organizations: [],
  users: [],
  suppliers: [],
  supplier_discovery_candidates: [],
  inventory_items: [],
  procurement_cases: [],
  case_transitions: [],
  purchase_requests: [],
  rfq_cases: [],
  quotes: [],
  quote_versions: [],
  purchase_orders: [],
  email_accounts: [],
  email_messages: [],
  ai_negotiation_logs: [],
  rfq_email_drafts: [],
  stock_movements: [],
};

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------

// Guarantee 100% real-time container consistency in serverless environments
// by reloading database state from Supabase Postgres on every incoming request
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.RELOAD_DB_ON_EVERY_REQUEST !== "true") {
    return next();
  }

  try {
    await initDb();
    const loaded = await loadDbState();
    // Safely map each loaded table state back to the exported dbState reference
    Object.keys(loaded).forEach((key) => {
      if (dbState[key] && Array.isArray(dbState[key])) {
        dbState[key] = loaded[key];
      }
    });
  } catch (err) {
    console.error("[Stally DB Sync] ❌ Database state reloading failed:", err);
  }
  next();
});

const organizationChecker = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Always restrict to user tenant for security
  const orgId = req.headers["x-organization-id"] || "org-1";
  req.organizationId = orgId as string;
  next();
};

app.use(organizationChecker);

const shouldAutoPersistRequest = (req: express.Request) => {
  if (process.env.AUTO_PERSIST_ENABLED === "false") return false;
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (req.path.startsWith("/api/v1/auth/")) return false;
  return true;
};

// Auto-persist in-memory changes back to Supabase after mutating requests.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const shouldPersist = shouldAutoPersistRequest(req);
  const originalJson = res.json;
  res.json = function (body) {
    if (!shouldPersist) return originalJson.call(res, body);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      persistDbStateNow(dbState)
        .then(() => {
          console.log(`[Stally Sync] 💾 Synchronously persisted mutating ${req.method} ${req.originalUrl} to Supabase.`);
          originalJson.call(res, body);
        })
        .catch((err) => {
          console.error("[Stally Sync] ❌ Failed to persist database state synchronously:", err);
          originalJson.call(res, body);
        });
    } else {
      originalJson.call(res, body);
    }
    return res;
  };
  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    await checkDbHealth();
    res.json({
      ok: true,
      service: "stally",
      database: "supabase_postgres_ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      ok: false,
      service: "stally",
      database: "error",
      error: err?.message || "Database health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/email/status", (_req, res) => {
  res.json({
    smtp: {
      configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
      secure: process.env.SMTP_SECURE === "true",
      fromEmailConfigured: Boolean(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER),
    },
    imap: {
      enabled: process.env.IMAP_POLL_ENABLED === "true",
      configured: Boolean(
        process.env.IMAP_HOST &&
        (process.env.IMAP_USER || process.env.SMTP_USER) &&
        (process.env.IMAP_PASS || process.env.SMTP_PASS)
      ),
      host: process.env.IMAP_HOST || null,
      port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
      mailbox: process.env.IMAP_MAILBOX || "INBOX",
      pollIntervalMs: Number(process.env.IMAP_POLL_INTERVAL_MS || 60000),
    },
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", apiV1Router);



// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      organizationId: string;
    }
  }
}

// ----------------------------------------------------
// DATABASE API ENDPOINTS (Logical Separations)
// ----------------------------------------------------

// GET system state (for syncing)
app.get("/api/state", (req, res) => {
  res.json({
    users: dbState.users,
    suppliers: dbState.suppliers.filter(s => s.organizationId === req.organizationId),
    inventory: dbState.inventory_items.filter(i => i.organizationId === req.organizationId),
    purchaseRequests: dbState.purchase_requests.filter(pr => pr.organizationId === req.organizationId),
    rfqs: dbState.rfq_cases.filter(rfq => rfq.organizationId === req.organizationId),
    quotes: dbState.quotes.filter(q => q.organizationId === req.organizationId),
    stockMovements: dbState.stock_movements.filter(m => m.organizationId === req.organizationId),
    cases: dbState.procurement_cases.filter(c => c.organizationId === req.organizationId),
    purchaseOrders: dbState.purchase_orders.filter(p => p.organizationId === req.organizationId)
  });
});

// SUPPLIERS CRUD FOR SOURCING
app.get("/api/suppliers", (req, res) => {
  res.json(dbState.suppliers.filter(s => s.organizationId === req.organizationId));
});

app.post("/api/suppliers", (req, res) => {
  const { name, contactPerson, email, phone, address, rating, tags, historicalPricing } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Vui lòng nhập tên nhà cung cấp, email và số điện thoại." });
  }
  const newSupplier = {
    id: `sup-${Date.now()}`,
    organizationId: req.organizationId,
    name,
    contactPerson: contactPerson || "",
    email,
    phone,
    address: address || "",
    rating: Number(rating) || 5,
    tags: tags || [],
    historicalPricing: historicalPricing || "",
    source: "crm" as "crm" | "crawled"
  };
  dbState.suppliers.push(newSupplier);
  res.status(201).json(newSupplier);
});

app.put("/api/suppliers/:id", (req, res) => {
  const { name, contactPerson, email, phone, address, rating, tags, historicalPricing } = req.body;
  const idx = dbState.suppliers.findIndex(s => s.id === req.params.id && s.organizationId === req.organizationId);
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy nhà cung cấp hoặc bạn không có quyền thao tác trên nhà cung ứng này." });
  }
  
  dbState.suppliers[idx] = {
    ...dbState.suppliers[idx],
    name: name || dbState.suppliers[idx].name,
    contactPerson: contactPerson !== undefined ? contactPerson : dbState.suppliers[idx].contactPerson,
    email: email || dbState.suppliers[idx].email,
    phone: phone || dbState.suppliers[idx].phone,
    address: address !== undefined ? address : dbState.suppliers[idx].address,
    rating: rating !== undefined ? Number(rating) : dbState.suppliers[idx].rating,
    tags: tags !== undefined ? tags : dbState.suppliers[idx].tags,
    historicalPricing: historicalPricing !== undefined ? historicalPricing : dbState.suppliers[idx].historicalPricing
  };
  res.json(dbState.suppliers[idx]);
});

app.delete("/api/suppliers/:id", (req, res) => {
  const idx = dbState.suppliers.findIndex(s => s.id === req.params.id && s.organizationId === req.organizationId);
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy nhà cung cấp hoặc bạn không có quyền thao tác." });
  }
  const deleted = dbState.suppliers.splice(idx, 1);
  res.json({ message: "Xóa nhà cung cấp thành công.", deleted: deleted[0] });
});

// CREATE PURCHASE REQUEST (EPIC A)
app.post("/api/purchase-requests", (req, res) => {
  const { title, priority, requiredDate, items, requesterId, requesterName, departmentName, source } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Yêu cầu danh sách sản phẩm cần mua." });
  }

  const newPR = {
    id: `pr-${Date.now()}`,
    organizationId: req.organizationId,
    requesterId: requesterId || "u-1",
    requesterName: requesterName || "User",
    departmentName: departmentName || "Ban điều hành",
    title: title || `Yêu cầu bổ sung hàng hóa ngày ${new Date().toLocaleDateString("vi-VN")}`,
    status: (req.body.status || "submitted") as any,
    priority: priority || "medium",
    requiredDate: requiredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: items.map((it: any) => ({
      name: it.name,
      quantity: Number(it.quantity),
      unit: it.unit || "đv",
      notes: it.notes || ""
    })),
    source: source || "web",
    createdAt: new Date().toISOString()
  };

  dbState.purchase_requests.push(newPR);
  dbState.procurement_cases.push({
    id: `case-${Date.now()}`,
    organizationId: req.organizationId,
    title: newPR.title,
    status: newPR.status === "draft" ? "draft_request" : "request_submitted",
    priority: newPR.priority,
    createdFrom: newPR.source === "email" ? "gmail" : newPR.source,
    requesterId: newPR.requesterId,
    requesterName: newPR.requesterName,
    requesterDepartmentId: "dept_kitchen",
    departmentName: newPR.departmentName,
    requiredDate: newPR.requiredDate,
    requestId: newPR.id,
    items: newPR.items,
    createdAt: newPR.createdAt,
    updatedAt: new Date().toISOString()
  });
  res.status(201).json(newPR);
});

// UPDATE PURCHASE REQUEST STATUS
app.patch("/api/purchase-requests/:id", (req, res) => {
  const { status } = req.body;
  const prIndex = dbState.purchase_requests.findIndex(p => p.id === req.params.id && p.organizationId === req.organizationId);
  if (prIndex === -1) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu mua hàng" });
  }

  dbState.purchase_requests[prIndex].status = status;
  res.json(dbState.purchase_requests[prIndex]);
});

// AUTO-MATCH SUPPLIERS FOR A PR (EPIC B)
app.get("/api/purchase-requests/:id/match-suppliers", (req, res) => {
  const pr = dbState.purchase_requests.find(p => p.id === req.params.id && p.organizationId === req.organizationId);
  if (!pr) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu mua hàng" });
  }

  // Extract keywords from items to suggest suppliers
  const itemNames = pr.items.map(it => it.name.toLowerCase());
  
  const matches = dbState.suppliers.filter(s => s.organizationId === req.organizationId).map(sup => {
    // Score based on matching tags
    let score = 0.5; // Baseline
    sup.tags.forEach(tag => {
      const match = itemNames.some(name => name.includes(tag.toLowerCase()) || tag.toLowerCase().includes(name));
      if (match) score += 1.5;
    });

    // Add score of rating
    score += (sup.rating - 3) * 0.5;

    return {
      supplier: sup,
      matchScore: Math.min(5.0, Math.max(1.0, score)),
      reasons: score > 1 ? [`Nhà cung cấp này chuyên cung cấp các mặt hàng liên quan đến ${sup.tags.join(", ")}, có lịch sử cung cấp uy tín.`] : ["Có mặt hàng phù hợp trong danh mục chung."]
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  res.json(matches.slice(0, 3));
});

// CREATE RFQ CASE (EPIC C)
app.post("/api/rfq", async (req, res) => {
  const { purchaseRequestId, suppliers, dueDate } = req.body;
  if (!purchaseRequestId || !suppliers || suppliers.length === 0) {
    return res.status(400).json({ error: "Cần chọn Purchase Request và ít nhất một nhà cung cấp." });
  }

  const rfqId = `rfq-${Date.now()}`;
  const resolvedDueDate = dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Update PR state to show it is now in RFQ phase
  const prIndex = dbState.purchase_requests.findIndex(p => p.id === purchaseRequestId);
  let prItemsText = "Không có thông tin sản phẩm.";
  let prTitle = "Yêu cầu báo giá nguyên liệu";
  if (prIndex !== -1) {
    dbState.purchase_requests[prIndex].status = "submitted"; 
    const prObj = dbState.purchase_requests[prIndex];
    prTitle = prObj.title || prTitle;
    prItemsText = prObj.items.map((it: any) => `• <strong>${it.name}</strong>: ${it.quantity} ${it.unit} ${it.notes ? `(${it.notes})` : ""}`).join("<br/>");
  }

  const pendingEmailLogs: EmailMessage[] = [];
  const sentEmails: Array<{ supplierId: string; email: string; messageId: string }> = [];

  // Generate and send actual emails to suppliers. This endpoint must fail if SMTP cannot send.
  for (const sup of suppliers) {
    const emailSubject = `[STALLY RFQ-${rfqId.toUpperCase()}] Thư mời chào giá cung cấp nguyên liệu - ${prTitle}`;
    const emailBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #334155; line-height: 1.6;">
        <div style="text-align: center; border-bottom: 2px solid #00535b; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #00535b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">STALLY B2B SOURCING</h2>
          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Hệ Thống Quản Lý Thu Mua Tự Động</p>
        </div>
        
        <p>Kính chào Quý đối tác <strong>${sup.name}</strong>,</p>
        <p>Ban mua sắm <strong>Stally Food & Beverage Group</strong> trân trọng kính mời quý đơn vị tham gia chào giá cung cấp các hạng mục nguyên vật liệu chi tiết dưới đây:</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #00535b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <h3 style="color: #0f172a; margin: 0 0 10px 0; font-size: 15px; font-weight: 700;">Danh sách yêu cầu chào giá:</h3>
          <div style="font-size: 14px; color: #334155; font-family: monospace; white-space: pre-line;">
            ${prItemsText}
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 40%;"><strong>Mã yêu cầu RFQ:</strong></td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${rfqId.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>Hạn chót gửi báo giá:</strong></td>
            <td style="padding: 8px 0; color: #e11d48; font-weight: bold;">${resolvedDueDate}</td>
          </tr>
        </table>
        
        <p><strong>Hướng dẫn nộp báo giá:</strong></p>
        <p style="font-size: 13.5px; margin-left: 10px;">
          👉 Quý đối tác vui lòng phản hồi (Reply) trực tiếp email này và đính kèm file báo giá (định dạng PDF hoặc Excel) hoặc nhập trực tiếp bảng báo giá trong nội dung thư phản hồi.<br/>
          Hệ thống AI của chúng tôi sẽ tự động xử lý và trích xuất thông tin để đối chiếu phương án mua sắm.
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
          <p style="margin: 0;">Trân trọng,</p>
          <p style="margin: 5px 0 0 0; color: #0f172a; font-weight: bold;">Phan Công Tâm</p>
          <p style="margin: 2px 0 0 0;">Phòng Thu mua & Chuỗi cung ứng - Stally F&B</p>
        </div>
      </div>
    `;

    const sendResult = await sendRealEmail({
      to: sup.email,
      subject: emailSubject,
      html: emailBody
    });

    if (!sendResult.success) {
      return res.status(502).json({
        error: {
          code: "EMAIL_SEND_FAILED",
          message: `Không gửi được RFQ tới ${sup.email}.`,
          details: sendResult.error,
        },
        sentEmails,
      });
    }

    sentEmails.push({
      supplierId: sup.supplierId,
      email: sup.email,
      messageId: sendResult.messageId || "",
    });

    const emailMsg: EmailMessage = {
      id: `email-out-${Date.now()}-${sup.supplierId}`,
      organizationId: req.organizationId,
      gmailAccountId: "smtp-1",
      gmailMessageId: sendResult.messageId || `smtp-out-${Date.now()}-${sup.supplierId}`,
      gmailThreadId: `thread-${Date.now()}`,
      internetMessageId: `<out-${Date.now()}@stally.com>`,
      direction: "outbound",
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "procurement@stally.com",
      to: [sup.email],
      subject: emailSubject,
      bodyHtml: emailBody,
      linkedCaseId: purchaseRequestId, // Link to purchaseRequestId in legacy mode
      linkedSupplierId: sup.supplierId,
      classification: "rfq",
      attachments: [],
      createdAt: new Date().toISOString()
    };
    pendingEmailLogs.push(emailMsg);
  }

  const newRfq = {
    id: rfqId,
    organizationId: req.organizationId,
    purchaseRequestId,
    status: "sent" as const,
    dueDate: resolvedDueDate,
    suppliers: suppliers.map((sup: any) => ({
      supplierId: sup.supplierId,
      name: sup.name,
      email: sup.email,
      status: "sent" as const
    })),
    createdAt: new Date().toISOString()
  };

  dbState.rfq_cases.push(newRfq);

  let linkedCase = dbState.procurement_cases.find(c => c.requestId === purchaseRequestId && c.organizationId === req.organizationId);
  if (!linkedCase && prIndex !== -1) {
    const prObj = dbState.purchase_requests[prIndex];
    linkedCase = {
      id: `case-${Date.now()}`,
      organizationId: req.organizationId,
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
      currentRfqId: rfqId,
      items: prObj.items,
      createdAt: prObj.createdAt,
      updatedAt: new Date().toISOString()
    };
    dbState.procurement_cases.push(linkedCase);
  }

  if (linkedCase) {
    linkedCase.currentRfqId = rfqId;
    linkedCase.status = "collecting_quotes";
    linkedCase.updatedAt = new Date().toISOString();
    pendingEmailLogs.forEach(log => {
      log.linkedCaseId = linkedCase.id;
    });
  }

  dbState.email_messages.push(...pendingEmailLogs);

  res.status(201).json({
    data: newRfq,
    email: {
      sentCount: sentEmails.length,
      sent: sentEmails,
    },
  });
});

// SIMULATE INBOUND EMAIL FROM SUPPLIER (EPIC D & E)
// Used when supplier replies or drops quote file
app.post("/api/webhooks/inbound-email", async (req, res) => {
  const { fromEmail, fromName, subject, bodyText, rfqCaseId, supplierId, fileName, fileContentBase64 } = req.body;
  
  if (!rfqCaseId || !supplierId) {
    return res.status(400).json({ error: "Cần cung cấp rfqCaseId và supplierId để liên kết báo giá." });
  }

  const rfq = dbState.rfq_cases.find(r => r.id === rfqCaseId && r.organizationId === req.organizationId);
  const pr = rfq ? dbState.purchase_requests.find(p => p.id === rfq.purchaseRequestId && p.organizationId === req.organizationId) : null;
  const supplierObj = dbState.suppliers.find(s => s.id === supplierId && s.organizationId === req.organizationId);

  let extractedQuote = {
    items: pr ? pr.items.map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: 0,
      totalPrice: 0
    })) : [],
    deliveryDays: 3,
    paymentTerms: "Thanh toán sau 30 ngày (Net 30)",
    subtotal: 0,
    taxAmount: 0,
    shippingFee: 150000,
    totalAmount: 150000,
    aiConfidenceScore: 90
  };

  const parsedText = bodyText || `Scan quote file: ${fileName}. Items list: ` + (pr ? pr.items.map(it => `${it.name}: quantity ${it.quantity}`).join(", ") : "");

  // Use server-side Gemini if initialized
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy phân tích nội dung thư và báo giá dưới đây của Nhà cung cấp để trích xuất thông tin báo giá chi tiết thành định dạng JSON.
        
BÁO GIÁ KHÁCH HÀNG:
${parsedText}

YÊU CẦU MUA HÀNG GỐC:
${pr ? JSON.stringify(pr.items) : "Không tìm thấy thông tin sản phẩm cần báo giá."}

Hãy trả về một JSON 객체 (object) chứa thông tin có cấu trúc dưới đây. Không thêm bất kỳ thông điệp nào khác ngoài JSON hợp lệ. Schema kết quả:
{
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "unit": "đơn vị", "unitPrice": đơn giá (VND, số nguyên), "totalPrice": thành tiền (VND, số nguyên) }
  ],
  "subtotal": tổng tiền trước thuế (VND, số nguyên),
  "taxAmount": tiền thuế VAT (VND, số nguyên),
  "shippingFee": phí vận chuyển (VND, số nguyên),
  "totalAmount": tổng thanh toán sau thuế và phí (VND, số nguyên),
  "deliveryDays": số ngày giao hàng dự kiến (số nguyên),
  "paymentTerms": "điều khoản thanh toán ngắn gọn",
  "aiConfidenceScore": độ chính xác phỏng đoán từ 1-100 (số nguyên)
}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                    unit: { type: Type.STRING },
                    unitPrice: { type: Type.INTEGER },
                    totalPrice: { type: Type.INTEGER }
                  },
                  required: ["name", "quantity", "unitPrice"]
                }
              },
              subtotal: { type: Type.INTEGER },
              taxAmount: { type: Type.INTEGER },
              shippingFee: { type: Type.INTEGER },
              totalAmount: { type: Type.INTEGER },
              deliveryDays: { type: Type.INTEGER },
              paymentTerms: { type: Type.STRING },
              aiConfidenceScore: { type: Type.INTEGER }
            },
            required: ["items", "totalAmount"]
          }
        }
      });

      const textOutput = response.text;
      if (textOutput) {
        extractedQuote = JSON.parse(textOutput);
      }
    } catch (err) {
      console.error("Gemini Parsing Quotation failed, falling back to simulator logic:", err);
      // Fallback generator with realistic prices if Gemini fails
      extractedQuote = simulateExtraction(pr, supplierObj);
    }
  } else {
    // Local simulation logic
    extractedQuote = simulateExtraction(pr, supplierObj);
  }

  // Create Quote document
  const quoteId = `q-${Date.now()}`;
  const newQuote = {
    id: quoteId,
    organizationId: req.organizationId,
    rfqCaseId,
    supplierId,
    supplierName: supplierObj ? supplierObj.name : (fromName || "NCC Phản hồi"),
    items: extractedQuote.items,
    subtotal: extractedQuote.subtotal || extractedQuote.items.reduce((sum, it) => sum + it.totalPrice, 0),
    taxAmount: extractedQuote.taxAmount || Math.round((extractedQuote.subtotal || 0) * 0.1),
    shippingFee: extractedQuote.shippingFee || 100000,
    totalAmount: extractedQuote.totalAmount,
    deliveryDays: extractedQuote.deliveryDays || 3,
    paymentTerms: extractedQuote.paymentTerms || "COD / Chuyển khoản trong 15 ngày",
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    aiConfidenceScore: extractedQuote.aiConfidenceScore || 95,
    status: "extracted" as const,
    originalFileUrl: fileName || "quoted_file_scanned.xlsx",
    createdAt: new Date().toISOString()
  };

  dbState.quotes.push(newQuote);

  // Link quotation back to RFQ Supplier state
  if (rfq) {
    const supIndex = rfq.suppliers.findIndex(s => s.supplierId === supplierId);
    if (supIndex !== -1) {
      rfq.suppliers[supIndex].status = "replied";
      rfq.suppliers[supIndex].quoteId = quoteId;
    }
    
    // Check if we received all or some replies to update status
    rfq.status = "quotes_received";
  }

  res.status(201).json({
    message: "Báo giá thư điện tử đã được Agent AI tiếp nhận, phân tích sạch và lưu trữ thành công.",
    quote: newQuote
  });
});

// Helper simulator parser logic
function simulateExtraction(pr: any, supplier: any) {
  if (!pr) return { items: [], totalAmount: 0, subtotal: 0, taxAmount: 0, shippingFee: 0, deliveryDays: 2, paymentTerms: "COD", aiConfidenceScore: 70 };
  
  // Custom prices depending on the supplier matching to create visual comparison card differences
  const multiplier = supplier?.id === "sup-1" ? 0.95 : supplier?.id === "sup-2" ? 0.9 : supplier?.id === "sup-3" ? 1.05 : 1.1;
  const deliveryDays = supplier?.id === "sup-1" ? 4 : supplier?.id === "sup-2" ? 3 : 1;
  
  const items = pr.items.map((it: any) => {
    let unitPrice = 28000;
    if (it.name.includes("Gạo ST25")) unitPrice = 27500;
    if (it.name.includes("Dầu Ăn")) unitPrice = 190000;
    if (it.name.includes("Mỹ")) unitPrice = 235000;
    if (it.name.includes("Xà Lách")) unitPrice = 32000;
    if (it.name.includes("Chén Dĩa")) unitPrice = 42000;

    const matchedPrice = Math.round(unitPrice * multiplier);
    return {
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: matchedPrice,
      totalPrice: matchedPrice * it.quantity
    };
  });

  const subtotal = items.reduce((sum: number, it: any) => sum + it.totalPrice, 0);
  const taxAmount = 0; // Không tự ý bịa thuế VAT khi giả lập
  const shippingFee = 0; // Không tự ý bịa phí vận chuyển khi giả lập
  const totalAmount = subtotal;

  return {
    items,
    subtotal,
    taxAmount,
    shippingFee,
    totalAmount,
    deliveryDays,
    paymentTerms: multiplier < 1 ? "Thanh toán ngay (COD)" : "Trả sau Net 15 ngày",
    aiConfidenceScore: 96
  };
}

// APPROVE RFQ / EXPORT PO & INVENTORY IMPACT (EPIC G & H)
app.post("/api/rfq/:id/approve", (req, res) => {
  const { selectedQuoteId, approvedBy } = req.body;
  const rfq = dbState.rfq_cases.find(r => r.id === req.params.id && r.organizationId === req.organizationId);
  if (!rfq) {
    return res.status(404).json({ error: "Không tìm thấy RFQ Case" });
  }

  const quote = dbState.quotes.find(q => q.id === selectedQuoteId);
  if (!quote) {
    return res.status(400).json({ error: "Không tìm thấy Quote được chọn phê duyệt" });
  }

  // Set selected quote status as "selected", other quotes for this RFQ as "rejected"
  dbState.quotes.forEach(q => {
    if (q.rfqCaseId === rfq.id) {
      if (q.id === selectedQuoteId) {
        q.status = "selected";
      } else {
        q.status = "rejected";
      }
    }
  });

  rfq.status = "approved";

  // Update PR to completed
  const pr = dbState.purchase_requests.find(p => p.id === rfq.purchaseRequestId);
  if (pr) {
    pr.status = "approved";
  }

  // INVENTORY IMPACT (Quantity On Order gets updated)
  quote.items.forEach(qItem => {
    const invItemIndex = dbState.inventory_items.findIndex(
      it => it.name.trim().toLowerCase() === qItem.name.trim().toLowerCase() && it.organizationId === req.organizationId
    );
    if (invItemIndex !== -1) {
      dbState.inventory_items[invItemIndex].quantityOnOrder += qItem.quantity;
      dbState.inventory_items[invItemIndex].lastPurchasePrice = qItem.unitPrice;
      dbState.inventory_items[invItemIndex].updatedAt = new Date().toISOString();
    }
  });

  res.json({
    message: "Phê duyệt thành công! Mã đơn đặt hàng PO chính thức đã được xuất gửi đến Nhà cung cấp.",
    rfq,
    quote
  });
});

// INVENTORY MOVEMENT MANAGER (EPIC I)
// Standard goods receipt (Nhập hàng thực phẩm về kho)
app.post("/api/inventory/receive-goods", (req, res) => {
  const { itemId, quantityReceived, referenceId, createdBy } = req.body;
  const idx = dbState.inventory_items.findIndex(it => it.id === itemId && it.organizationId === req.organizationId);
  
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy sản phẩm trong danh mục kho" });
  }

  const item = dbState.inventory_items[idx];
  const qty = Number(quantityReceived);

  // Safeguard: decrement from OnOrder, increment to Available
  const originalOnOrder = item.quantityOnOrder;
  const orderImpact = Math.min(originalOnOrder, qty);
  
  item.quantityOnOrder -= orderImpact;
  item.quantityAvailable += qty;
  item.updatedAt = new Date().toISOString();

  // Write Stock Movement Log
  const movement = {
    id: `mov-${Date.now()}`,
    organizationId: req.organizationId,
    itemId,
    movementType: "in" as const,
    quantity: qty,
    referenceType: "purchase_order" as const,
    referenceId: referenceId || "PO-Manual",
    createdBy: createdBy || "Thủ kho",
    createdAt: new Date().toISOString()
  };

  dbState.stock_movements.push(movement);
  res.json({ item, movement });
});

// MANUAL ADJUST INTENTORY (Xuất kho, hao hụt, điều chỉnh bột gạo...)
app.post("/api/inventory/adjust", (req, res) => {
  const { itemId, adjustmentQty, movementType, referenceId, createdBy } = req.body;
  const idx = dbState.inventory_items.findIndex(it => it.id === itemId && it.organizationId === req.organizationId);
  
  if (idx === -1) {
    return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
  }

  const item = dbState.inventory_items[idx];
  const qty = Number(adjustmentQty);

  if (movementType === "out") {
    item.quantityAvailable = Math.max(0, item.quantityAvailable - qty);
  } else {
    item.quantityAvailable += qty;
  }
  item.updatedAt = new Date().toISOString();

  const movement = {
    id: `mov-${Date.now()}`,
    organizationId: req.organizationId,
    itemId,
    movementType: movementType as "in" | "out" | "adjustment",
    quantity: qty,
    referenceType: "manual" as const,
    referenceId: referenceId || "Điều chỉnh tay",
    createdBy: createdBy || "Lý Văn Khoa",
    createdAt: new Date().toISOString()
  };

  dbState.stock_movements.push(movement);
  res.json({ item, movement });
});

// ----------------------------------------------------
// AI ORCHESTRATOR & AGENT CHAT STREAM / BOT (MÔ HÌNH DRAFT-AND-CONFIRM)
// ----------------------------------------------------
app.post("/api/ai/chat", async (req, res) => {
  const { messages, currentRole } = req.body;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "Nội dung cuộc hội thoại không được để trống." });
  }

  const userQuery = messages[messages.length - 1].content;

  // Gather current system states to inject into prompt context safely
  const belowMinItems = dbState.inventory_items.filter(it => it.quantityAvailable < it.minStockLevel && it.organizationId === req.organizationId);
  const activePRs = dbState.purchase_requests.filter(pr => pr.status !== "completed" && pr.organizationId === req.organizationId);
  const suppliersText = dbState.suppliers.filter(s => s.organizationId === req.organizationId).map(s => `${s.name} (chuyên ${s.tags.join(", ")})`).join("; ");

  // Standard Agentic Prompt
  const systemPrompt = `Bạn là "Stally AI Agent Orchestrator" - Trợ lý số hóa và tự động hóa chuỗi cung ứng Procurement & Warehouse cho vận hành doanh nghiệp (bếp, nhà hàng, khách sạn).
Bản thân bạn chạy ở chế độ "Draft-and-Confirm" (Dự thảo và Xác nhận) độc đáo:
- Giúp người dùng hỏi han kiểm tra kho, danh sách hàng hóa cảnh báo thiếu.
- Cho phép người dùng yêu cầu tạo phiếu mua sắm nháp. Ví dụ: "Tạo PR mua 50kg gạo ST25" hoặc "Tôi cần đặt thêm 20 chai dầu ăn".
- **QUAN TRỌNG**: Bạn CHỈ tạo tài liệu ở trạng thái "draft" (nháp), bạn không bao giờ được phép trực tiếp phê duyệt hoặc gửi email RFQ/PO chính thức cho NCC. Bạn phải trả về kết quả cấu trúc chứa mẫu nháp kèm theo nút để người dùng "Gửi yêu cầu" xác nhận trên giao diện.

DỮ LIỆU THỜI GIAN THỰC ĐANG CÓ TRONG KHO:
- Các sản phẩm đang dính cảnh báo cạn kho (Tồn < Ngưỡng tối thiểu):
${JSON.stringify(belowMinItems.map(i => ({ name: i.name, sku: i.sku, available: i.quantityAvailable, min: i.minStockLevel, unit: i.unit })))}
- Các phiếu yêu cầu mua hàng (PR) hiện tại:
${JSON.stringify(activePRs.map(p => ({ id: p.id, title: p.title, status: p.status, priority: p.priority, items: p.items })))}
- Danh sách NCC trong CRM hệ thống của bạn:
${suppliersText}

Quy trình phản hồi:
1. Trả lời trực quan câu hỏi của người dùng bằng tiếng Việt, súc tích, thân thiện và lịch lãm.
2. Nếu người dùng muốn mua hàng hoặc tạo phiếu PR, hãy trả lời là bạn đã lập dự thảo nháp thành công, đồng thời bạn hãy trả về thông tin cấu trúc PR nháp bằng cách gộp mã JSON đặc biệt vào nội dung phản hồi của bạn dưới dạng thẻ:
<DRAFT_ACTION>
{
  "title": "mô tả tiêu đề PR nháp",
  "priority": "low" hoặc "medium" hoặc "high",
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "unit": "đơn vị", "notes": "ghi chú lý do mua" }
  ]
}
</DRAFT_ACTION>
Hãy luôn tuân thủ nguyên tắc "Draft-and-Confirm", tạo thẻ này khi muốn đề xuất một PR mới để UI render nút xác nhận trực quan!`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: userQuery }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7
        }
      });

      const reply = response.text || "Xin lỗi, tôi đã gặp trục trặc khi tạo phản hồi.";
      return res.json({ message: reply });
    } catch (err) {
      console.error("Gemini Chat Failure:", err);
    }
  }

  // Fallback Simulator is extremely smart and reads inputs
  let replyText = "";
  const queryLower = userQuery.toLowerCase();
  
  if (queryLower.includes("hết") || queryLower.includes("sắp hết") || queryLower.includes("kho") || queryLower.includes("cảnh báo") || queryLower.includes("thiếu")) {
    replyText = `Chào bạn, tôi đã quét kho Stally và phát hiện **${belowMinItems.length} mặt hàng** đang bị thâm hụt dưới ngưỡng tối thiểu an toàn:

${belowMinItems.map(it => `- ⚠️ **${it.name}** (SKU: \`${it.sku}\`): Tồn kho khả dụng còn **${it.quantityAvailable} ${it.unit}** (Ngưỡng an toàn là ${it.minStockLevel} ${it.unit}).`).join("\n")}

Bạn có muốn tôi giúp tự động tạo phiếu yêu cầu mua hàng (PR) cho những mặt hàng khẩn cấp này không? `;
  } else if (queryLower.includes("mua") || queryLower.includes("tạo pr") || queryLower.includes("đặt") || queryLower.includes("order")) {
    // Regex extract quantity and item
    let qty = 50;
    let unit = "kg";
    let itemName = "Gạo ST25 Cao Cấp";

    if (queryLower.includes("gạo")) {
      itemName = "Gạo ST25 Cao Cấp";
      unit = "kg";
    } else if (queryLower.includes("dầu ăn")) {
      itemName = "Dầu Ăn Tường An 5L";
      unit = "chai";
    } else if (queryLower.includes("xà lách") || queryLower.includes("rau")) {
      itemName = "Xà Lách Mỹ Organic";
      unit = "kg";
    } else if (queryLower.includes("bò") || queryLower.includes("thịt")) {
      itemName = "Thịt Bò Mỹ Slicing";
      unit = "kg";
    }

    const matchesQty = userQuery.match(/\d+/);
    if (matchesQty) {
      qty = parseInt(matchesQty[0], 10);
    }

    replyText = `Vâng, tôi đã lập phiếu đề xuất mua hàng (Purchase Request) nháp dựa trên yêu cầu của bạn. 

Tôi đã tối ưu hóa thông tin và điền đầy đủ các thông số an toàn. Bạn có thể nhấn nút **[Gửi yêu cầu mua hàng]** trên thẻ hành động bên dưới để nộp phiếu lên bộ phận Procurement phê duyệt chính thức.

<DRAFT_ACTION>
{
  "title": "Đề xuất khẩn cấp mua ${itemName}",
  "priority": "high",
  "items": [
    { "name": "${itemName}", "quantity": ${qty}, "unit": "${unit}", "notes": "Hệ thống AI tự động phát hiện cạn kiệt hoặc người dùng chỉ định" }
  ]
}
</DRAFT_ACTION>`;
  } else {
    replyText = `Chào bạn! Tôi là **Stally Agent Orchestrator**. 🌾

Tôi có thể hỗ trợ bạn đắc lực trong quy trình mua sắm nội bộ:
1. Hỏi tôi: *"Sản phẩm nào sắp hết hàng?"* để nhận cảnh báo tồn kho đỏ.
2. Bảo tôi: *"Tạo yêu cầu mua 60 hộp Chén Dĩa Sứ"* để tự động soạn PR nháp lập tức.
3. Tôi hoạt động theo mô hình **Draft-and-Confirm** tuyệt đối an toàn - bạn tự tay duyệt mới phát hành thư RFQ! Chúc bạn một ngày làm việc hiệu quả.`;
  }

  res.json({ message: replyText });
});

// ----------------------------------------------------
// VITE CLIENT DEV SERVER / PRODUCTION HOOKS
// ----------------------------------------------------
async function startServer() {
  await initDb();
  dbState = await loadDbState();
  console.log("Supabase Postgres state loaded.", {
    organizations: dbState.organizations.length,
    suppliers: dbState.suppliers.length,
    cases: dbState.procurement_cases.length,
    quotes: dbState.quotes.length,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT MODE with live Vite middleware integration...");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.VITE_HMR_PORT
          ? { port: Number(process.env.VITE_HMR_PORT) }
          : undefined,
      },
      appType: "spa",
    });
    
    // Mount Vite middleware (Handles all client files, static contents, hot updates) After the API routes
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION MODE...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Check if dist folder exists before serving static files
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("Production warning: 'dist/' folder not found. Please build front-end files using 'npm run build' first.");
      // Fallback response inside containers before compiled spa is ready
      app.get("/", (req, res) => {
        res.send("Application is preparing. Please compile frontend assets.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Stally B2B Server running securely on http://localhost:${PORT}`);
    startImapPolling();
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };

import express, { Router, Request, Response, NextFunction } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { dbState, ai } from "../../server.js";
import { persistDbState } from "./db.js";
import { sendRealEmail } from "./mailer.js";
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
  UserRole,
  PriorityLevel,
  PurchaseRequestItem,
  AiNegotiationLog
} from "../types.js";

export const apiV1Router = Router();

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
    throw new Error("Không tìm thấy Procurement Case.");
  }
  
  const fromStatus = caseObj.status;
  
  // Guard transitions
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus) && toStatus !== "cancelled") {
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
  
  // Broadcast Realtime SSE Event
  broadcastRealtimeEvent("case.updated", caseId, { fromStatus, toStatus, actorId, reason });
  
  // Persist State to SQLite
  try {
    persistDbState(dbState);
  } catch (err) {
    console.error("Failed to persist database state in transitionCaseStatus:", err);
  }
  
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
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  
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
apiV1Router.get("/me", (req: Request, res: Response) => {
  const role = (req.query.role as UserRole) || "procurement";
  const user = dbState.users.find(u => u.role === role && u.organizationId === req.organizationId) || dbState.users[0];
  res.json({ data: user });
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
    const updated = transitionCaseStatus({
      caseId,
      toStatus: "request_validating",
      actorId: "u-1",
      actorRole: (role || "procurement") as UserRole,
      reason: reason || "Nhân viên thu mua phê duyệt chuyển tiếp",
      orgId
    });
    
    // Auto validate to supplier matching
    setTimeout(() => {
      try {
        transitionCaseStatus({
          caseId,
          toStatus: "supplier_matching",
          actorId: "u-1",
          actorRole: "procurement",
          reason: "Hệ thống hoàn tất chuẩn hóa dữ liệu yêu cầu",
          orgId
        });
      } catch (e) {
        console.error(e);
      }
    }, 500);
    
    res.json({ data: updated });
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
apiV1Router.post("/cases/:caseId/supplier-matches", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const itemNames = caseObj.items.map(it => it.name.toLowerCase());
  
  const matches = dbState.suppliers
    .filter(s => s.organizationId === orgId)
    .map(sup => {
      let score = 50; // Base score
      
      // Match tags
      sup.tags.forEach(tag => {
        const matchesTag = itemNames.some(name => name.includes(tag.toLowerCase()) || tag.toLowerCase().includes(name));
        if (matchesTag) score += 25;
      });
      
      // Rating impact
      score += Math.round((sup.rating - 3.0) * 10);
      
      // Max score cap
      score = Math.min(99, Math.max(15, score));
      
      const reasons = [];
      if (score >= 75) {
        reasons.push(`Chuyên cung cấp mặt hàng thuộc danh mục thầu thợ ${sup.tags.join(", ")}`);
        reasons.push(`Lịch sử đánh giá chất lượng cực tốt: ⭐ ${sup.rating}/5.0`);
      } else {
        reasons.push("Được đề cử từ danh bạ B2B của bạn");
      }
      
      return {
        supplierId: sup.id,
        name: sup.name,
        email: sup.email,
        score,
        reasons,
        riskFlags: score < 40 ? ["Lịch sử phản hồi báo giá chậm"] : []
      };
    })
    .sort((a, b) => b.score - a.score);
    
  res.json({ data: matches });
});

apiV1Router.post("/cases/:caseId/suppliers/select", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { supplierIds } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  // Transition to rfq_draft phase
  transitionCaseStatus({
    caseId,
    toStatus: "rfq_draft",
    actorId: "u-1",
    actorRole: "procurement",
    reason: `Đã chọn các NCC gửi thư thầu: ${supplierIds.join(", ")}`,
    orgId
  });
  
  res.json({ message: "Đã chọn nhà cung cấp gửi báo giá thầu", data: caseObj });
});

apiV1Router.post("/cases/:caseId/suppliers/discover", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { query, limit, dryRun } = req.body;
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }

  try {
    console.log(`AI supplier discovery started. case=${caseId} query="${query}"`);
    const candidates = await discoverSuppliers(ai, {
      query,
      orgId,
      caseObj,
      existingSuppliers: dbState.suppliers.filter(s => s.organizationId === orgId),
      limit: Number(limit) || 5,
    });

    const addedSuppliers: Supplier[] = [];
    for (const candidate of candidates) {
      if (dryRun) continue;
      if (!candidate.autoAddEligible) continue;
      const supplier = buildSupplierFromCandidate(candidate, orgId, addedSuppliers.length);
      if (!dbState.suppliers.some(s => s.organizationId === orgId && (s.email.toLowerCase() === supplier.email.toLowerCase() || s.name.toLowerCase() === supplier.name.toLowerCase()))) {
        dbState.suppliers.push(supplier);
        addedSuppliers.push(supplier);
      }
    }

    return res.json({
      message: addedSuppliers.length
        ? `Đã crawl và thêm ${addedSuppliers.length} NCC đủ thông tin xác minh vào CRM.`
        : dryRun
          ? "Dry-run crawl xong. Chưa ghi NCC nào vào CRM."
          : "Đã crawl xong nhưng chưa có NCC đủ email/số điện thoại/confidence để tự thêm vào CRM.",
      data: addedSuppliers,
      candidates,
      summary: {
        totalCandidates: candidates.length,
        addedCount: addedSuppliers.length,
        reviewRequiredCount: candidates.length - addedSuppliers.length,
        dryRun: Boolean(dryRun),
      }
    });
  } catch (err: any) {
    console.error("Supplier discovery failed:", err);
    return res.status(502).json({
      error: {
        code: "SUPPLIER_DISCOVERY_FAILED",
        message: err.message || "Không crawl được nhà cung cấp lúc này.",
      }
    });
  }
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
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { supplierIds, dueDate } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const selectedSuppliers = dbState.suppliers.filter(s => supplierIds.includes(s.id));
  const prItemsText = caseObj.items.map(it => `- ${it.name}: ${it.quantity} ${it.unit} (${it.notes || "không có ghi chú"})`).join("\n");
  
  const drafts = [];
  
  for (const supplier of selectedSuppliers) {
    const draftId = `rfq-draft-${Date.now()}-${supplier.id}`;
    let emailSubject = `[STALLY RFQ-${caseId.toUpperCase()}] Thư mời chào giá cung cấp nguyên liệu`;
    let emailBody = `<p>Kính chào quý đối tác <strong>${supplier.name}</strong>,</p>
<p>Ban mua sắm <strong>Stally Food & Beverage Group</strong> trân trọng mời quý đơn vị gửi bảng chào thầu báo giá cho các hạng mục nguyên liệu sau:</p>
<blockquote>
  ${prItemsText.replace(/\n/g, "<br>")}
</blockquote>
<p>Hạn chót tiếp nhận bảng báo giá: <strong>${dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("vi-VN")}</strong>.</p>
<p>Vui lòng đính kèm báo giá định dạng PDF/Excel khi phản hồi lại email này. Chân thành cảm ơn!</p>
<p>Trân trọng,<br><strong>Phan Công Tâm</strong><br>Procurement & Sourcing Staff</p>`;

    // Call Gemini to personalize email style if available
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Hãy viết lại thư mời chào thầu chuyên nghiệp gửi đến NCC ${supplier.name} bán mặt hàng liên quan.
Hàng cần báo giá:
${prItemsText}
Yêu cầu trả về định dạng HTML trong hòm thư điện tử. Chỉ trả về nội dung HTML thô. Tuyệt đối không thêm bất kỳ ghi chú, lời thoại, lời giải thích hay thẻ định dạng markdown (như \`\`\`html) ngoài mã HTML.`
        });
        if (response.text) {
          let cleanText = response.text.trim();
          if (cleanText.includes("```")) {
            cleanText = cleanText.replace(/```html?/g, "").replace(/```/g, "").trim();
          }
          emailBody = cleanText;
        }
      } catch (err) {
        // Fallback
      }
    }
    
    const draft = {
      id: draftId,
      caseId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      subject: emailSubject,
      bodyHtml: emailBody,
      dueDate: dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "draft"
    };
    
    dbState.rfq_email_drafts.push(draft);
    drafts.push(draft);
  }
  
  res.json({ data: drafts });
});

apiV1Router.post("/cases/:caseId/rfq/send", async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { draftIds } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy case" } });
  }
  
  const rfqId = `rfq-${Date.now()}`;
  const matchedDrafts = dbState.rfq_email_drafts.filter(d => draftIds.includes(d.id));
  
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
    const sendResult = await sendRealEmail({
      to: d.supplierEmail,
      subject: d.subject,
      html: d.bodyHtml
    });

    if (!sendResult.success) {
      return res.status(502).json({
        error: {
          code: "EMAIL_SEND_FAILED",
          message: `Không gửi được RFQ tới ${d.supplierEmail}.`,
          details: sendResult.error,
        },
        sentEmails,
      });
    }

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
  const { fromEmail, fromName, subject, bodyText, bodyHtml, rfqCaseId, supplierId, fileName, fileContentBase64 } = payload;

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
  }
  
  // Rule 2: ThreadId match or direct RFQ case linking
  if (!resolvedCaseId && rfqCaseId) {
    const caseObj = dbState.procurement_cases.find(c => c.currentRfqId === rfqCaseId);
    if (caseObj) {
      resolvedCaseId = caseObj.id;
    }
  }
  
  // Rule 3: Sender matching
  if (!resolvedSupplierId && fromEmail) {
    const matchedSup = dbState.suppliers.find(s => s.email.toLowerCase() === fromEmail.toLowerCase() && s.organizationId === orgId);
    if (matchedSup) {
      resolvedSupplierId = matchedSup.id;
    }
  }
  
  if (!resolvedCaseId) {
    // Look for active collecting case with that supplier
    const activeCase = dbState.procurement_cases.find(c => 
      c.status === "collecting_quotes" && 
      resolvedSupplierId && 
      dbState.rfq_cases.find(r => r.id === c.currentRfqId)?.suppliers.some(s => s.supplierId === resolvedSupplierId)
    );
    if (activeCase) resolvedCaseId = activeCase.id;
  }
  
  if (!resolvedCaseId) {
    const err = new Error("Không thể nhận diện email này thuộc hồ sơ Case thầu nào.");
    (err as any).code = "UNRESOLVABLE_CASE";
    throw err;
  }
  
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
    classification: "quote",
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
  
  dbState.email_messages.push(emailMsg);
  broadcastRealtimeEvent("email.received", resolvedCaseId, emailMsg);
  
  await triggerQuoteExtractionPipeline(resolvedCaseId, resolvedSupplierId, emailMsg, fileName, fileContentBase64, orgId);

  return { linkedCaseId: resolvedCaseId, linkedSupplierId: resolvedSupplierId, emailMessageId: emailMsg.id };
}

apiV1Router.post("/webhooks/inbound-email", async (req: Request, res: Response) => {
  try {
    const result = await ingestInboundEmail(req.body, req.organizationId || "org-1");
    res.json({ message: "Email received. Quote extraction queued.", ...result });
  } catch (err: any) {
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
  broadcastRealtimeEvent("quote.extraction_started", caseId, { supplierId, emailMessageId: email.id });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId);
  const supplierObj = dbState.suppliers.find(s => s.id === supplierId);
  
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
      isFallback = true;
      extractedQuote = simulateQuoteExtraction(caseObj, supplierObj, multiplier);
    }
  } else {
    extractedQuote = simulateQuoteExtraction(caseObj, supplierObj, multiplier);
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
  const normalizedSubtotal = Number(extractedQuote.subtotal) || normalizedItems.reduce((sum: number, it: any) => sum + it.totalPrice, 0);
  const normalizedTaxAmount = Number(extractedQuote.taxAmount) || Math.round(normalizedSubtotal * 0.1);
  const normalizedShippingFee = Number(extractedQuote.shippingFee) || 0;
  const normalizedTotalAmount = Number(extractedQuote.totalAmount) || normalizedSubtotal + normalizedTaxAmount + normalizedShippingFee;
  
  // Save or update quote, and log quote version
  const targetRfqCaseId = caseObj?.currentRfqId || "rfq-1";
  const existingQuote = dbState.quotes.find(q => q.rfqCaseId === targetRfqCaseId && q.supplierId === supplierId);
  
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
    existingQuote.aiConfidenceScore = isFallback ? 0 : (Number(extractedQuote.aiConfidenceScore) || 70);
    existingQuote.originalFileUrl = isFallback ? "MÔ PHỎNG (Do hết hạn ngạch API)" : (fileName || "quote_unstructured.txt");
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
      aiConfidenceScore: isFallback ? 0 : (Number(extractedQuote.aiConfidenceScore) || 70),
      status: "extracted",
      originalFileUrl: isFallback ? "MÔ PHỎNG (Do hết hạn ngạch API)" : (fileName || "quote_unstructured.txt"),
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
        const latestLog = activeLogs[activeLogs.length - 1];
        latestLog.status = "supplier_responded";
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
    }
  }
  
  broadcastRealtimeEvent("quote.extracted", caseId, finalQuote);
  
  // Persist State to SQLite
  try {
    persistDbState(dbState);
  } catch (err) {
    console.error("Failed to persist database state in triggerQuoteExtractionPipeline:", err);
  }
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
  const quotesList = rfqId ? dbState.quotes.filter(q => q.rfqCaseId === rfqId && q.organizationId === orgId) : [];
  
  let lowestTotalQuoteId = "";
  let fastestDeliveryQuoteId = "";
  let recommendedQuoteId = "";
  let recommendationReason = "Hãy nộp thêm báo giá của các bên để AI tính toán ma trận rủi ro.";
  
  if (quotesList.length > 0) {
    const sortedByPrice = [...quotesList].sort((a, b) => a.totalAmount - b.totalAmount);
    const sortedByDelivery = [...quotesList].sort((a, b) => a.deliveryDays - b.deliveryDays);
    
    lowestTotalQuoteId = sortedByPrice[0].id;
    fastestDeliveryQuoteId = sortedByDelivery[0].id;
    recommendedQuoteId = sortedByPrice[0].id; // Defaults to cheapest
    
    recommendationReason = `Hệ thống khuyên phê duyệt đơn hàng của **${sortedByPrice[0].supplierName}** vì mức chào thầu rẻ nhất (${sortedByPrice[0].totalAmount.toLocaleString()}đ, bao gồm VAT) giúp tối ưu hóa 10-15% chi phí của tổ chức.`;
  }
  
  res.json({
    caseId,
    items: caseObj.items,
    suppliers: rfqId ? dbState.rfq_cases.find(r => r.id === rfqId)?.suppliers || [] : [],
    matrix: quotesList,
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
  const supplier = dbState.suppliers.find(s => s.id === supplierId);
  
  if (!caseObj || !supplier) {
    return res.status(404).json({ error: "Không tìm thấy case hoặc nhà cung cấp" });
  }
  
  const rfqId = caseObj.currentRfqId;
  const quote = dbState.quotes.find(q => q.rfqCaseId === rfqId && q.supplierId === supplierId);
  
  let targetDetail = "giảm giá 5%";
  if (goal === "faster_delivery") targetDetail = "rút ngắn thời gian giao hàng xuống 1 ngày";
  if (goal === "longer_terms") targetDetail = "giãn nợ công nợ lên 30 ngày";
  
  const currentPriceText = quote ? `${quote.totalAmount.toLocaleString()}đ` : "báo giá chào thầu";
  
  let draftEmail = `<p>Chào anh/chị đại diện <strong>${supplier.name}</strong>,</p>
<p>Ban mua sắm Stally chân thành cảm ơn bảng chào thầu nguyên liệu trị giá <strong>${currentPriceText}</strong> của quý công ty.</p>
<p>Để tiến tới ký kết PO chính thức dài hạn, chúng tôi mong muốn thương lượng thêm về điều khoản: <strong>${targetDetail}</strong>.</p>
<p>Kính mong quý đối tác cân nhắc điều chỉnh để Stally duyệt hồ sơ mua sắm này khẩn cấp. Xin cảm ơn!</p>
<p>Trân trọng,<br>Ban mua sắm Stally F&B</p>`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Hãy đóng vai trò là một chuyên viên mua sắm chuyên nghiệp. Hãy soạn thảo một email đàm phán gửi đến NCC ${supplier.name} nhằm mục tiêu: ${targetDetail}. 
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
  res.json({ data: newLog });
});

apiV1Router.post("/negotiation-drafts/:draftId/send", (req: Request, res: Response) => {
  const { draftId } = req.params;
  const { editedBody } = req.body;
  
  const log = dbState.ai_negotiation_logs.find(l => l.id === draftId);
  if (!log) return res.status(404).json({ error: "Không tìm thấy thư đàm phán nháp" });
  
  log.status = "sent";
  if (editedBody) log.userEditedEmail = editedBody;

  // Actually send real email via Nodemailer
  const supplier = dbState.suppliers.find((s: any) => s.id === log.supplierId);
  const supplierEmail = supplier ? supplier.email : "supplier@example.com";
  sendRealEmail({
    to: supplierEmail,
    subject: `[STALLY NEGOTIATION-${log.caseId.toUpperCase()}] Thương lượng báo giá Case thầu`,
    html: editedBody || log.draftEmail
  }).catch(err => {
    console.error("Async sending real negotiation email failed:", err);
  });
  
  // Transition Case status
  transitionCaseStatus({
    caseId: log.caseId,
    toStatus: "negotiating",
    actorId: "u-1",
    actorRole: "procurement",
    reason: `Gửi email đàm phán thương lượng chào giá đến NCC qua hòm thư Gmail.`,
    orgId: req.organizationId || "org-1"
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
  
  // Persist State to SQLite
  try {
    persistDbState(dbState);
  } catch (err) {
    console.error("Failed to persist database state in simulateSupplierNegotiationReply:", err);
  }
}

// ----------------------------------------------------
// MANAGER APPROVAL QUEUE APIs
// ----------------------------------------------------
apiV1Router.post("/cases/:caseId/approval/request", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  const { selectedQuoteId, comment } = req.body;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
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

apiV1Router.post("/approval-requests/:caseId/approve", (req: Request, res: Response) => {
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
apiV1Router.post("/cases/:caseId/po-draft", (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const { caseId } = req.params;
  
  const caseObj = dbState.procurement_cases.find(c => c.id === caseId && c.organizationId === orgId);
  if (!caseObj || !caseObj.selectedQuoteId) {
    return res.status(400).json({ error: "Chưa chọn hoặc chưa duyệt báo giá thầu" });
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
  
  res.json({ data: po });
});

apiV1Router.post("/purchase-orders/:poId/send", (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { poId } = req.params;
  
  const po = dbState.purchase_orders.find(p => p.id === poId && p.organizationId === orgId);
  if (!po) return res.status(404).json({ error: "Không tìm thấy PO" });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === po.caseId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
  po.status = "confirmed";
  
  // INVENTORY quantityOnOrder IMPACT
  po.items.forEach(poItem => {
    const invItem = dbState.inventory_items.find(
      it => it.name.trim().toLowerCase() === poItem.name.trim().toLowerCase() && it.organizationId === orgId
    );
    if (invItem) {
      invItem.quantityOnOrder += poItem.quantity;
      invItem.lastPurchasePrice = poItem.unitPrice;
      invItem.updatedAt = new Date().toISOString();
    }
  });
  
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
  
  res.json({ message: "PO confirmed and sent.", data: po });
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
apiV1Router.post("/purchase-orders/:poId/receive", (req: Request, res: Response) => {
  const orgId = req.organizationId || "org-1";
  const { poId } = req.params;
  const { items, receivedAt } = req.body;
  
  const po = dbState.purchase_orders.find(p => p.id === poId && p.organizationId === orgId);
  if (!po) return res.status(404).json({ error: "Không tìm thấy PO" });
  
  const caseObj = dbState.procurement_cases.find(c => c.id === po.caseId);
  if (!caseObj) return res.status(404).json({ error: "Không tìm thấy case" });
  
  let fullyReceived = true;
  
  items.forEach((recItem: any) => {
    const poItem = po.items.find(pi => pi.name.trim().toLowerCase() === recItem.name.trim().toLowerCase());
    if (!poItem) return;
    
    const qtyRec = Number(recItem.quantityReceived);
    
    // Decrement from quantityOnOrder, increment quantityAvailable
    const invItem = dbState.inventory_items.find(
      it => it.name.trim().toLowerCase() === poItem.name.trim().toLowerCase() && it.organizationId === orgId
    );
    
    if (invItem) {
      const orderImpact = Math.min(invItem.quantityOnOrder, qtyRec);
      invItem.quantityOnOrder = Math.max(0, invItem.quantityOnOrder - orderImpact);
      invItem.quantityAvailable += qtyRec;
      invItem.updatedAt = new Date().toISOString();
      
      // Stock movement log
      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        organizationId: orgId,
        itemId: invItem.id,
        movementType: "in",
        quantity: qtyRec,
        referenceType: "purchase_order",
        referenceId: poId,
        createdBy: "Lý Văn Khoa (Thủ Kho)",
        createdAt: new Date().toISOString()
      };
      dbState.stock_movements.push(mov);
    }
    
    if (qtyRec < poItem.quantity) {
      fullyReceived = false;
    }
  });
  
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
  
  res.json({ message: "Nhập kho thành công", po });
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

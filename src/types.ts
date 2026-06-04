export interface Organization {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

export type UserRole = "requester" | "procurement" | "manager" | "warehouse" | "admin";

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  status: "active" | "inactive";
}

export interface PurchaseRequestItem {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export type PurchaseRequestStatus = "draft" | "submitted" | "approved" | "completed" | "cancelled";
export type PriorityLevel = "low" | "medium" | "high";

export interface PurchaseRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  requesterName: string;
  departmentName: string;
  title: string;
  status: PurchaseRequestStatus;
  priority: PriorityLevel;
  requiredDate: string;
  items: PurchaseRequestItem[];
  source: "web" | "email" | "gmail" | "chatbot" | "inventory_alert";
  createdAt: string;
}

export type RfqStatus = "draft" | "sent" | "quotes_received" | "compared" | "approved" | "ordered";

export interface RfqSupplier {
  supplierId: string;
  name: string;
  email: string;
  status: "pending" | "sent" | "replied" | "declined";
  quoteId?: string;
}

export interface RfqCase {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  status: RfqStatus;
  dueDate: string;
  suppliers: RfqSupplier[];
  createdAt: string;
}

export interface QuoteItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Quote {
  id: string;
  organizationId: string;
  rfqCaseId: string;
  supplierId: string;
  supplierName: string;
  items: QuoteItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  totalAmount: number;
  deliveryDays: number;
  paymentTerms: string;
  validUntil: string;
  aiConfidenceScore: number;
  status: "draft" | "extracted" | "selected" | "rejected";
  originalFileUrl?: string;
  negotiationStatus?: "none" | "sent" | "supplier_responded";
  negotiationRound?: number;
  lastNegotiatedAt?: string;
  supplierReplyRaw?: string;
  versionCount?: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  minStockLevel: number;
  quantityAvailable: number;
  quantityOnOrder: number;
  lastPurchasePrice: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  itemId: string;
  movementType: "in" | "out" | "adjustment";
  quantity: number;
  referenceType: "purchase_order" | "manual";
  referenceId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  rating: number; // 1-5
  tags: string[]; // Offered products or labels
  historicalPricing?: string; // Rich historical pricing text or record
  source?: "crm" | "discovered" | "manual" | "crawled";
}

export interface SupplierDiscoveryCandidate {
  id: string;
  organizationId: string;
  caseId: string;
  query: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tags: string[];
  sourceUrls: string[];
  evidence: string;
  confidence: number;
  riskFlags: string[];
  autoAddEligible: boolean;
  duplicateOfSupplierId?: string;
  status: "review" | "promoted" | "rejected";
  promotedSupplierId?: string;
  createdAt: string;
}

export type CaseStatus =
  | "draft_request"
  | "request_submitted"
  | "request_validating"
  | "supplier_matching"
  | "rfq_draft"
  | "rfq_sent"
  | "collecting_quotes"
  | "quote_review"
  | "comparison_ready"
  | "negotiating"
  | "pending_approval"
  | "approved"
  | "po_draft"
  | "po_sent"
  | "receiving"
  | "closed"
  | "cancelled"
  | "exception";

export interface ProcurementCase {
  id: string;
  organizationId: string;
  title: string;
  status: CaseStatus;
  isScanning?: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  createdFrom: "web" | "gmail" | "chatbot" | "inventory_alert";
  requesterId?: string;
  requesterName?: string;
  requesterDepartmentId?: string;
  departmentName?: string;
  assignedBuyerId?: string;
  requiredDate?: string;
  requestId?: string; // Links to PurchaseRequest
  currentRfqId?: string;
  selectedQuoteId?: string;
  selectedQuoteVersionId?: string;
  purchaseOrderId?: string;
  items: PurchaseRequestItem[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CaseTransition {
  id: string;
  caseId: string;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  actorId: string;
  actorRole: string;
  reason?: string;
  createdAt: string;
}

export interface EmailAttachment {
  id: string;
  emailMessageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  documentId?: string;
}

export interface EmailMessage {
  id: string;
  organizationId: string;
  gmailAccountId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references?: string[];
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet?: string;
  receivedAt?: string;
  sentAt?: string;
  linkedCaseId?: string;
  linkedSupplierId?: string;
  classification?:
    | "purchase_request"
    | "rfq"
    | "quote"
    | "negotiation"
    | "po"
    | "other";
  attachments: EmailAttachment[];
  createdAt: string;
}

export interface QuoteVersion {
  id: string;
  quoteId: string;
  round: number;
  items: QuoteItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  totalAmount: number;
  deliveryDays: number;
  paymentTerms: string;
  validUntil: string;
  aiConfidenceScore: number;
  originalFileUrl?: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  caseId: string;
  supplierId: string;
  supplierName: string;
  quoteId: string;
  quoteVersionId?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: "issued" | "confirmed" | "shipping" | "received" | "cancelled";
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
}

export interface AiNegotiationLog {
  id: string;
  caseId: string;
  supplierId: string;
  round: number;
  promptGoal: string;
  draftEmail: string;
  userEditedEmail?: string;
  supplierReplyRaw?: string;
  status: "draft" | "sent" | "supplier_responded" | "closed";
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
}

export type UserRole = "requester" | "procurement" | "manager" | "warehouse";

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
  source: "web" | "email";
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
}

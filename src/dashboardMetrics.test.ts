import { describe, expect, it } from "vitest";
import { buildDashboardMetrics } from "./dashboardMetrics";
import { ProcurementCase, Quote, RfqCase, PurchaseRequest, InventoryItem, Supplier } from "./types";

const emptyState = {
  purchaseRequests: [] as PurchaseRequest[],
  rfqs: [] as RfqCase[],
  quotes: [] as Quote[],
  inventory: [] as InventoryItem[],
  suppliers: [] as Supplier[],
  cases: [] as ProcurementCase[],
};

describe("buildDashboardMetrics", () => {
  it("counts only selected positive quotes as approved spend", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      quotes: [
        quote({ id: "q1", status: "selected", totalAmount: 1200000 }),
        quote({ id: "q2", status: "selected", totalAmount: 0 }),
        quote({ id: "q3", status: "extracted", totalAmount: 999000 }),
      ],
    });

    expect(metrics.executive.approvedSpend).toBe(1200000);
  });

  it("flags risky quotes in the priority queue", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      quotes: [
        quote({ id: "risk-low-confidence", aiConfidenceScore: 40, totalAmount: 500000 }),
      ],
    });

    expect(metrics.operator.quoteReviewCount).toBe(1);
    expect(metrics.operator.priorityQueue[0].kind).toBe("quote_risk");
  });

  it("links risky quotes back to their procurement case when possible", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      rfqs: [rfq({ id: "rfq-quote", purchaseRequestId: "pr-quote" })],
      cases: [procurementCase({ id: "case-quote", currentRfqId: "rfq-quote", requestId: "pr-quote" })],
      quotes: [
        quote({ id: "risk-linked", rfqCaseId: "rfq-quote", aiConfidenceScore: 40, totalAmount: 500000 }),
      ],
    });

    expect(metrics.operator.priorityQueue[0].targetTab).toBe("cases");
    expect(metrics.operator.priorityQueue[0].targetCaseId).toBe("case-quote");
    expect(metrics.operator.priorityQueue[0].targetRfqId).toBe("rfq-quote");
  });

  it("orders queue by risk before deadline before value", () => {
    const metrics = buildDashboardMetrics({
      ...emptyState,
      cases: [
        procurementCase({ id: "case-overdue", status: "collecting_quotes", requiredDate: "2020-01-01", priority: "medium" }),
        procurementCase({ id: "case-high-value", status: "pending_approval", requiredDate: "2099-01-01", priority: "urgent" }),
      ],
      quotes: [
        quote({ id: "q-risk", aiConfidenceScore: 20, totalAmount: 1000 }),
      ],
    });

    expect(metrics.operator.priorityQueue[0].kind).toBe("quote_risk");
    expect(metrics.operator.priorityQueue[1].kind).toBe("case_overdue");
  });
});

function quote(overrides: Partial<Quote>): Quote {
  return {
    id: "q",
    organizationId: "org-1",
    rfqCaseId: "rfq-1",
    supplierId: "sup-1",
    supplierName: "Supplier",
    items: [{ name: "Item", quantity: 1, unit: "unit", unitPrice: 1, totalPrice: 1 }],
    subtotal: 1,
    taxAmount: 0,
    shippingFee: 0,
    totalAmount: 1,
    deliveryDays: 3,
    paymentTerms: "Net 30",
    validUntil: "2099-01-01",
    aiConfidenceScore: 100,
    status: "extracted",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function procurementCase(overrides: Partial<ProcurementCase>): ProcurementCase {
  return {
    id: "case-1",
    organizationId: "org-1",
    title: "Case",
    status: "supplier_matching",
    priority: "medium",
    createdFrom: "web",
    requesterName: "Requester",
    departmentName: "Department",
    requiredDate: "2099-01-01",
    items: [{ name: "Item", quantity: 1, unit: "unit" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function rfq(overrides: Partial<RfqCase>): RfqCase {
  return {
    id: "rfq-1",
    organizationId: "org-1",
    purchaseRequestId: "pr-1",
    status: "sent",
    dueDate: "2099-01-01",
    suppliers: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

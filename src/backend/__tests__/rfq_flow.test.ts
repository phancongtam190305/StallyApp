import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock DB layer - no real Postgres needed
vi.mock("../db.ts", () => {
  return {
    db: {
      connect: vi.fn(() => Promise.resolve({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      })),
      query: vi.fn().mockResolvedValue({ rows: [] })
    },
    initDb: vi.fn().mockResolvedValue(undefined),
    loadDbState: vi.fn().mockResolvedValue({}),
    loadDbStateQueue: vi.fn().mockResolvedValue({}),
    persistDbState: vi.fn().mockResolvedValue(undefined),
    persistDbStateNow: vi.fn().mockResolvedValue(undefined),
    checkDbHealth: vi.fn().mockResolvedValue(undefined),
    parseSupplier: (r: any) => r,
    parseSupplierDiscoveryCandidate: (r: any) => r,
    parseProcurementCase: (r: any) => r,
    parsePurchaseRequest: (r: any) => r,
    parseRfqCase: (r: any) => r,
    parseQuote: (r: any) => r,
    parseQuoteVersion: (r: any) => r,
    parsePurchaseOrder: (r: any) => r,
    parseEmailMessage: (r: any) => r
  };
});

import { app, dbState } from "../../../server.ts";

describe("RFQ Flow - API & Transition Tests", () => {
  beforeEach(() => {
    // Setup mock data
    dbState.organizations = [
      { id: "org-1", name: "Nhà Hàng Test", industry: "F&B", createdAt: new Date().toISOString() }
    ];
    dbState.users = [
      { id: "u-1", organizationId: "org-1", email: "test@stally.com", name: "Tester", role: "procurement", status: "active" }
    ];
    dbState.suppliers = [
      { id: "sup-1", organizationId: "org-1", name: "NCC Rau Sạch", contactPerson: "A", email: "rau@test.com", phone: "123", address: "A", rating: 5, tags: ["rau"] },
      { id: "sup-2", organizationId: "org-1", name: "NCC Thịt Tươi", contactPerson: "B", email: "thit@test.com", phone: "456", address: "B", rating: 4, tags: ["thit"] }
    ];
    dbState.procurement_cases = [
      {
        id: "case-rfq-1",
        organizationId: "org-1",
        title: "Test RFQ Flow",
        status: "supplier_matching",
        priority: "medium",
        createdFrom: "web",
        items: [{ name: "Rau cải", quantity: 50, unit: "kg" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    dbState.case_transitions = [];
    dbState.rfq_email_drafts = [];
  });

  it("GET /api/v1/cases/:caseId/rfq-drafts phải trả về mảng rỗng nếu chưa có nháp", async () => {
    const res = await request(app)
      .get("/api/v1/cases/case-rfq-1/rfq-drafts")
      .set("x-organization-id", "org-1");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("POST /suppliers/select lần đầu tiên phải chuyển trạng thái sang rfq_draft", async () => {
    const res = await request(app)
      .post("/api/v1/cases/case-rfq-1/suppliers/select")
      .set("x-organization-id", "org-1")
      .send({ supplierIds: ["sup-1"] });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rfq_draft");

    // Case status phải được cập nhật ở database
    const caseObj = dbState.procurement_cases.find(c => c.id === "case-rfq-1");
    expect(caseObj?.status).toBe("rfq_draft");
  });

  it("POST /suppliers/select khi case đã ở rfq_draft không được ném lỗi chuyển trạng thái trùng", async () => {
    // Đặt sẵn trạng thái rfq_draft
    dbState.procurement_cases[0].status = "rfq_draft";

    const res = await request(app)
      .post("/api/v1/cases/case-rfq-1/suppliers/select")
      .set("x-organization-id", "org-1")
      .send({ supplierIds: ["sup-1", "sup-2"] });

    // Không bị ném lỗi 400 hoặc 500
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rfq_draft");
  });

  it("GET /api/v1/cases/:caseId/rfq-drafts phải trả về đúng danh sách nháp sau khi POST /rfq-draft", async () => {
    // 1. Tạo bản nháp RFQ
    const selectRes = await request(app)
      .post("/api/v1/cases/case-rfq-1/rfq-draft")
      .set("x-organization-id", "org-1")
      .send({ supplierIds: ["sup-1"], dueDate: "2026-06-12" });

    expect(selectRes.status).toBe(200);
    expect(selectRes.body.data).toHaveLength(1);
    expect(selectRes.body.data[0].supplierId).toBe("sup-1");

    // 2. Gọi GET rfq-drafts để kiểm tra tính đồng bộ
    const getRes = await request(app)
      .get("/api/v1/cases/case-rfq-1/rfq-drafts")
      .set("x-organization-id", "org-1");

    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toHaveLength(1);
    expect(getRes.body.data[0].supplierId).toBe("sup-1");
  });
});

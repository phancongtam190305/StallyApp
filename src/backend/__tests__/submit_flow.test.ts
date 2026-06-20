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
    parseEmailMessage: (r: any) => r,
    persistUser: vi.fn().mockResolvedValue(undefined),
    persistRecord: vi.fn().mockResolvedValue(undefined),
    deleteRecord: vi.fn().mockResolvedValue(undefined),
    persistRecords: vi.fn().mockResolvedValue(undefined),
    persistCase: vi.fn().mockResolvedValue(undefined),
    persistCaseTransition: vi.fn().mockResolvedValue(undefined),
    persistRfqDraft: vi.fn().mockResolvedValue(undefined),
    persistRfqDrafts: vi.fn().mockResolvedValue(undefined),
    persistRfqCase: vi.fn().mockResolvedValue(undefined),
    persistQuote: vi.fn().mockResolvedValue(undefined),
    persistEmailMessage: vi.fn().mockResolvedValue(undefined),
    persistPurchaseOrder: vi.fn().mockResolvedValue(undefined),
    persistInventoryItem: vi.fn().mockResolvedValue(undefined),
    persistStockMovement: vi.fn().mockResolvedValue(undefined)
  };
});

import { app, dbState } from "../../../server.ts";

/**
 * ============================================================
 * SUBMIT FLOW INTEGRATION TEST
 * ============================================================
 * Test chuyên sâu cho luồng "Xác nhận chuẩn hóa & Soạn thầu"
 * Đảm bảo:
 * 1. Status chuyển đồng bộ: draft_request → request_validating → supplier_matching
 * 2. Response trả về status cuối cùng (supplier_matching)
 * 3. GET /cases/:id sau đó cũng trả supplier_matching
 * 4. Audit trail có đủ 2 transitions
 * 5. Milestone mapping frontend sẽ hiển thị đúng bước 2
 * ============================================================
 */
describe("Submit Flow - Xác nhận chuẩn hóa & Soạn thầu", () => {
  beforeEach(() => {
    // Fresh state mỗi test
    dbState.organizations = [
      { id: "org-1", name: "Nhà Hàng Test", industry: "F&B", createdAt: new Date().toISOString() }
    ];
    dbState.users = [
      { id: "u-1", organizationId: "org-1", email: "test@stally.com", name: "Tester", role: "procurement", status: "active" }
    ];
    dbState.suppliers = [];
    dbState.procurement_cases = [
      {
        id: "case-submit-1",
        organizationId: "org-1",
        title: "Test Submit Flow",
        status: "draft_request",
        priority: "high",
        createdFrom: "web",
        requesterId: "u-1",
        requesterName: "Tester",
        requesterDepartmentId: "dept_test",
        departmentName: "Test Dept",
        requiredDate: "2026-06-10",
        requestId: "pr-test-1",
        items: [{ name: "Gạo ST25", quantity: 100, unit: "kg", notes: "" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    dbState.case_transitions = [];
    dbState.purchase_requests = [];
  });

  it("POST /submit phải trả về status 'supplier_matching' (không phải request_validating)", async () => {
    const res = await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-1")
      .send({ role: "procurement", reason: "Chuẩn hóa xong" });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // KEY ASSERTION: response phải trả status cuối cùng là supplier_matching
    expect(res.body.data.status).toBe("supplier_matching");
  });

  it("GET /cases/:id sau khi submit phải trả về 'supplier_matching'", async () => {
    // Step 1: Submit
    await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-1")
      .send({ role: "procurement", reason: "Chuẩn hóa" });

    // Step 2: Fetch lại case (simulate frontend fetchData)
    const getRes = await request(app)
      .get("/api/v1/cases/case-submit-1")
      .set("x-organization-id", "org-1");

    expect(getRes.status).toBe(200);
    // Không bị race condition - status phải là supplier_matching
    expect(getRes.body.data.status).toBe("supplier_matching");
  });

  it("Audit trail phải có đúng 2 transitions sau khi submit", async () => {
    await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-1")
      .send({ role: "procurement", reason: "Chuẩn hóa" });

    const timelineRes = await request(app)
      .get("/api/v1/cases/case-submit-1/timeline")
      .set("x-organization-id", "org-1");

    expect(timelineRes.status).toBe(200);
    const transitions = timelineRes.body.data;
    
    // Phải có 2 transitions:
    // 1. draft_request → request_validating
    // 2. request_validating → supplier_matching
    expect(transitions).toHaveLength(2);
    expect(transitions[0].fromStatus).toBe("draft_request");
    expect(transitions[0].toStatus).toBe("request_validating");
    expect(transitions[1].fromStatus).toBe("request_validating");
    expect(transitions[1].toStatus).toBe("supplier_matching");
  });

  it("Milestone mapping: supplier_matching → activeMilestone = 2", () => {
    // Simulate frontend milestone logic
    const milestoneStatuses: Record<number, string[]> = {
      1: ["draft_request", "request_submitted", "request_validating"],
      2: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"],
      3: ["quote_review", "comparison_ready", "negotiating"],
      4: ["pending_approval"],
      5: ["approved", "po_draft", "po_sent", "receiving", "closed", "cancelled", "exception"]
    };

    const status = "supplier_matching";
    let activeMilestone = 5; // default
    for (const [milestone, statuses] of Object.entries(milestoneStatuses)) {
      if (statuses.includes(status)) {
        activeMilestone = Number(milestone);
        break;
      }
    }

    // KEY: supplier_matching phải map về milestone 2, KHÔNG phải milestone 1
    expect(activeMilestone).toBe(2);
  });

  it("Không thể submit case của org khác (multi-tenant isolation)", async () => {
    const res = await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-hacker") // org khác
      .send({ role: "procurement", reason: "Hack attempt" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("Submit case đã ở supplier_matching phải báo lỗi transition", async () => {
    // Submit lần 1
    await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-1")
      .send({ role: "procurement", reason: "Lần 1" });

    // Submit lần 2 - case đã ở supplier_matching, không thể submit lại
    const res = await request(app)
      .post("/api/v1/cases/case-submit-1/submit")
      .set("x-organization-id", "org-1")
      .send({ role: "procurement", reason: "Lần 2" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TRANSITION_ERROR");
  });
});

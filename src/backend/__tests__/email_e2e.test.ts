import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  sendRealEmail: vi.fn(),
  simpleParser: vi.fn(),
  imapInstances: [] as any[],
  imapSearchResults: [] as any[][],
  imapFetchMessage: undefined as any,
  genAiResponseText: "",
}));

vi.mock("../db.ts", () => {
  return {
    db: {
      connect: vi.fn(() => Promise.resolve({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      })),
      query: vi.fn().mockResolvedValue({ rows: [] }),
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
    persistStockMovement: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../mailer.ts", () => ({
  sendRealEmail: mocks.sendRealEmail,
}));

vi.mock("mailparser", () => ({
  simpleParser: mocks.simpleParser,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        get text() {
          return mocks.genAiResponseText || JSON.stringify({
            items: [],
            subtotal: 0,
            taxAmount: 0,
            shippingFee: 0,
            totalAmount: 0,
            deliveryDays: 3,
            paymentTerms: "Không đề cập",
            aiConfidenceScore: 30,
          });
        },
      }),
    };
  },
  Type: {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
    INTEGER: "integer",
  },
}));

vi.mock("imapflow", () => {
  return {
    ImapFlow: class {
      connect = vi.fn().mockResolvedValue(undefined);
      getMailboxLock = vi.fn().mockResolvedValue({ release: vi.fn() });
      search = vi.fn().mockImplementation(() => Promise.resolve(mocks.imapSearchResults.shift() || []));
      fetchOne = vi.fn().mockResolvedValue(mocks.imapFetchMessage);
      messageFlagsAdd = vi.fn().mockResolvedValue(undefined);
      logout = vi.fn().mockResolvedValue(undefined);

      constructor() {
        mocks.imapInstances.push(this);
      }
    },
  };
});

import { app, dbState } from "../../../server.ts";
import { sendRealEmail } from "../mailer.ts";
import { startImapPolling, stopImapPolling } from "../imap_poller.ts";

const ORG_ID = "org-1";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await sleep(20);
  }
  throw new Error("Timed out waiting for expected async behavior.");
}

function resetDbState() {
  dbState.organizations = [
    { id: ORG_ID, name: "Stally Test Org", industry: "F&B", createdAt: new Date().toISOString() },
  ];
  dbState.users = [
    { id: "u-1", organizationId: ORG_ID, email: "buyer@stally.test", name: "Buyer", role: "procurement", status: "active" },
  ];
  dbState.suppliers = [
    {
      id: "sup-e2e-1",
      organizationId: ORG_ID,
      name: "Supplier One",
      contactPerson: "Sales One",
      email: "supplier-one@example.test",
      phone: "0900000001",
      address: "HCMC",
      rating: 4.8,
      tags: ["gao", "rice"],
      historicalPricing: "",
      source: "crm",
    },
  ];
  dbState.supplier_discovery_candidates = [];
  dbState.inventory_items = [];
  dbState.procurement_cases = [];
  dbState.case_transitions = [];
  dbState.purchase_requests = [];
  dbState.rfq_cases = [];
  dbState.quotes = [];
  dbState.quote_versions = [];
  dbState.purchase_orders = [];
  dbState.email_accounts = [];
  dbState.email_messages = [];
  dbState.ai_negotiation_logs = [];
  dbState.rfq_email_drafts = [];
  dbState.stock_movements = [];
  dbState.discovery_caches = [];
}

async function createCaseReadyForRfq() {
  const createRes = await request(app)
    .post("/api/v1/cases")
    .set("x-organization-id", ORG_ID)
    .send({
      title: "Buy rice for end to end email test",
      priority: "high",
      requiredDate: "2026-06-12",
      departmentId: "dept-kitchen",
      createdFrom: "web",
      requesterId: "u-1",
      requesterName: "Requester",
      items: [
        { name: "Gao ST25", quantity: 100, unit: "kg", notes: "Low stock" },
      ],
    });
  expect(createRes.status).toBe(201);

  const caseId = createRes.body.data.id;

  const submitRes = await request(app)
    .post(`/api/v1/cases/${caseId}/submit`)
    .set("x-organization-id", ORG_ID)
    .send({ role: "procurement", reason: "Validated for sourcing" });
  expect(submitRes.status).toBe(200);
  expect(submitRes.body.data.status).toBe("supplier_matching");

  const selectRes = await request(app)
    .post(`/api/v1/cases/${caseId}/suppliers/select`)
    .set("x-organization-id", ORG_ID)
    .send({ supplierIds: ["sup-e2e-1"] });
  expect(selectRes.status).toBe(200);
  expect(selectRes.body.data.status).toBe("rfq_draft");

  const draftRes = await request(app)
    .post(`/api/v1/cases/${caseId}/rfq-draft`)
    .set("x-organization-id", ORG_ID)
    .send({ supplierIds: ["sup-e2e-1"], dueDate: "2026-06-15" });
  expect(draftRes.status).toBe(200);
  expect(draftRes.body.data).toHaveLength(1);

  const sendRes = await request(app)
    .post(`/api/v1/cases/${caseId}/rfq/send`)
    .set("x-organization-id", ORG_ID)
    .send({ draftIds: draftRes.body.data.map((d: any) => d.id) });
  expect(sendRes.status).toBe(200);
  expect(sendRes.body.rfqId).toMatch(/^rfq-/);

  await sleep(350);

  const caseObj = dbState.procurement_cases.find((c: any) => c.id === caseId);
  expect(caseObj?.status).toBe("collecting_quotes");

  return { caseId, rfqId: sendRes.body.rfqId };
}

async function postInboundQuote(caseId: string, messageId = "<supplier-quote-1@example.test>") {
  return request(app)
    .post("/api/v1/webhooks/inbound-email")
    .set("x-organization-id", ORG_ID)
    .send({
      fromEmail: "supplier-one@example.test",
      fromName: "Supplier One",
      subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Quote for rice`,
      bodyText: "Quote: Gao ST25 100kg at 25000 VND/kg. Delivery in 3 days. Shipping free.",
      fileName: "quote-supplier-one.pdf",
      messageId,
      threadId: "<thread-supplier-quote-1@example.test>",
      internetMessageId: messageId,
      receivedAt: "2026-06-04T03:00:00.000Z",
    });
}

function createNegotiatingCaseWithExistingQuote(options: { caseStatus?: any; logStatus?: any } = {}) {
  const now = new Date().toISOString();
  const caseId = "case-negotiation-guard";
  const rfqId = "rfq-negotiation-guard";
  const quoteId = "quote-negotiation-guard";
  const caseStatus = options.caseStatus || "negotiating";
  const logStatus = options.logStatus || "sent";

  dbState.procurement_cases.push({
    id: caseId,
    organizationId: ORG_ID,
    title: "Negotiation guard test",
    status: caseStatus,
    priority: "high",
    createdFrom: "web",
    requesterId: "u-1",
    requesterName: "Requester",
    requesterDepartmentId: "dept-kitchen",
    departmentName: "Kitchen",
    requiredDate: "2026-06-12",
    requestId: "pr-negotiation-guard",
    currentRfqId: rfqId,
    items: [{ name: "Gao ST25", quantity: 100, unit: "kg", notes: "Low stock" }],
    createdAt: now,
    updatedAt: now,
  });

  dbState.rfq_cases.push({
    id: rfqId,
    organizationId: ORG_ID,
    purchaseRequestId: "pr-negotiation-guard",
    status: "quotes_received",
    dueDate: "2026-06-15",
    suppliers: [{
      supplierId: "sup-e2e-1",
      name: "Supplier One",
      email: "supplier-one@example.test",
      status: "replied",
      quoteId,
    }],
    createdAt: now,
  });

  dbState.quotes.push({
    id: quoteId,
    organizationId: ORG_ID,
    rfqCaseId: rfqId,
    supplierId: "sup-e2e-1",
    supplierName: "Supplier One",
    items: [{ name: "Gao ST25", quantity: 100, unit: "kg", unitPrice: 10000, totalPrice: 1000000 }],
    subtotal: 1000000,
    taxAmount: 0,
    shippingFee: 0,
    totalAmount: 1000000,
    deliveryDays: 3,
    paymentTerms: "COD",
    validUntil: "2026-06-20",
    aiConfidenceScore: 90,
    status: "extracted",
    originalFileUrl: "quote-original.pdf",
    createdAt: now,
  });

  dbState.ai_negotiation_logs.push({
    id: "neg-log-guard",
    caseId,
    supplierId: "sup-e2e-1",
    round: 1,
    promptGoal: "discount_5",
    draftEmail: "<p>Xin giảm 5%</p>",
    status: logStatus,
    createdAt: now,
  });

  return { caseId, quoteId };
}

describe("Email E2E desired behavior", () => {
  beforeEach(() => {
    resetDbState();
    mocks.sendRealEmail.mockReset();
    mocks.sendRealEmail.mockResolvedValue({ success: true, messageId: "smtp-rfq-message-1" });
    mocks.simpleParser.mockReset();
    mocks.imapInstances.length = 0;
    mocks.imapSearchResults = [];
    mocks.imapFetchMessage = undefined;
    mocks.genAiResponseText = "";
  });

  afterEach(() => {
    stopImapPolling();
    vi.unstubAllEnvs();
  });

  it("persists friendly RFQ draft edits before sending", async () => {
    const createRes = await request(app)
      .post("/api/v1/cases")
      .set("x-organization-id", ORG_ID)
      .send({
        title: "Buy rice for draft edit test",
        priority: "high",
        requiredDate: "2026-06-12",
        departmentId: "dept-kitchen",
        createdFrom: "web",
        requesterId: "u-1",
        requesterName: "Requester",
        items: [
          { name: "Gao ST25", quantity: 100, unit: "kg", notes: "Low stock" },
        ],
      });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/cases/${caseId}/submit`)
      .set("x-organization-id", ORG_ID)
      .send({ role: "procurement", reason: "Validated for sourcing" });

    await request(app)
      .post(`/api/v1/cases/${caseId}/suppliers/select`)
      .set("x-organization-id", ORG_ID)
      .send({ supplierIds: ["sup-e2e-1"] });

    const draftRes = await request(app)
      .post(`/api/v1/cases/${caseId}/rfq-draft`)
      .set("x-organization-id", ORG_ID)
      .send({ supplierIds: ["sup-e2e-1"], dueDate: "2026-06-15" });
    expect(draftRes.status).toBe(200);

    const draftId = draftRes.body.data[0].id;
    const patchRes = await request(app)
      .patch(`/api/v1/cases/${caseId}/rfq-drafts/${draftId}`)
      .set("x-organization-id", ORG_ID)
      .send({
        subject: "Updated friendly RFQ subject",
        bodyHtml: "<p>Friendly preview-first RFQ body</p>",
        dueDate: "2026-06-20",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data).toMatchObject({
      id: draftId,
      subject: "Updated friendly RFQ subject",
      bodyHtml: "<p>Friendly preview-first RFQ body</p>",
      dueDate: "2026-06-20",
    });

    const storedDraft = dbState.rfq_email_drafts.find((draft: any) => draft.id === draftId);
    expect(storedDraft?.subject).toBe("Updated friendly RFQ subject");
    expect(storedDraft?.bodyHtml).toBe("<p>Friendly preview-first RFQ body</p>");
  });

  it("runs RFQ send to inbound quote to comparison_ready as one end to end behavior", async () => {
    const { caseId, rfqId } = await createCaseReadyForRfq();

    expect(sendRealEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "supplier-one@example.test",
      subject: expect.stringContaining(`[STALLY RFQ-${caseId.toUpperCase()}]`),
    }));

    const rfq = dbState.rfq_cases.find((r: any) => r.id === rfqId);
    expect(rfq?.status).toBe("sent");
    expect(rfq?.suppliers[0].status).toBe("sent");
    expect(dbState.email_messages.filter((m: any) => m.direction === "outbound")).toHaveLength(1);

    const inboundRes = await postInboundQuote(caseId);
    expect(inboundRes.status).toBe(200);
    expect(inboundRes.body.linkedCaseId).toBe(caseId);
    expect(inboundRes.body.linkedSupplierId).toBe("sup-e2e-1");

    await sleep(450);

    const finalCase = dbState.procurement_cases.find((c: any) => c.id === caseId);
    const finalRfq = dbState.rfq_cases.find((r: any) => r.id === rfqId);
    expect(finalCase?.status).toBe("comparison_ready");
    expect(finalRfq?.status).toBe("quotes_received");
    expect(finalRfq?.suppliers[0].status).toBe("replied");
    expect(finalRfq?.suppliers[0].quoteId).toBeTruthy();

    expect(dbState.email_messages.filter((m: any) => m.direction === "inbound")).toHaveLength(1);
    expect(dbState.quotes).toHaveLength(1);
    expect(dbState.quote_versions).toHaveLength(1);

    const comparisonRes = await request(app)
      .get(`/api/v1/cases/${caseId}/comparison`)
      .set("x-organization-id", ORG_ID);
    expect(comparisonRes.status).toBe(200);
    expect(comparisonRes.body.matrix).toHaveLength(1);
    expect(dbState.quotes[0].totalAmount).toBe(0);
    expect(comparisonRes.body.summary.recommendedQuoteId).toBe("");
    expect(comparisonRes.body.summary.recommendationReason).toContain("red-flag");
  });

  it("extracts a real PDF attachment from an inbound supplier email", async () => {
    const { caseId } = await createCaseReadyForRfq();
    mocks.genAiResponseText = JSON.stringify({
      items: [{ name: "Gao ST25", quantity: 100, unit: "kg", unitPrice: 25000, totalPrice: 2500000 }],
      subtotal: 2500000,
      taxAmount: 250000,
      shippingFee: 0,
      totalAmount: 2750000,
      deliveryDays: 3,
      paymentTerms: "Net 15",
      validUntil: "2026-06-30",
      aiConfidenceScore: 92,
    });

    const inboundRes = await request(app)
      .post("/api/v1/webhooks/inbound-email")
      .set("x-organization-id", ORG_ID)
      .send({
        fromEmail: "supplier-one@example.test",
        fromName: "Supplier One",
        subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Quote with PDF`,
        bodyText: "Vui lòng xem báo giá trong file PDF đính kèm.",
        fileName: "real-quotation.pdf",
        fileContentBase64: Buffer.from("%PDF-test").toString("base64"),
        mimeType: "application/pdf",
        sizeBytes: 8,
        messageId: "<supplier-pdf-quote@example.test>",
        threadId: "<thread-pdf-quote@example.test>",
        internetMessageId: "<supplier-pdf-quote@example.test>",
        receivedAt: "2026-06-04T03:30:00.000Z",
      });

    expect(inboundRes.status).toBe(200);
    expect(inboundRes.body.linkedCaseId).toBe(caseId);
    expect(inboundRes.body.linkedSupplierId).toBe("sup-e2e-1");

    await sleep(450);

    const inboundEmail = dbState.email_messages.find((message: any) => message.direction === "inbound");
    expect(inboundEmail?.attachments[0]).toMatchObject({
      fileName: "real-quotation.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
    });
    expect(dbState.quotes).toHaveLength(1);
    expect(dbState.quote_versions).toHaveLength(1);
    expect(dbState.quotes[0]).toMatchObject({
      supplierId: "sup-e2e-1",
      totalAmount: 2750000,
      paymentTerms: "Net 15",
      originalFileUrl: "real-quotation.pdf",
    });
    expect(dbState.procurement_cases.find((item: any) => item.id === caseId)?.status).toBe("comparison_ready");
  });

  it("keeps negotiation reply from overwriting an existing quote with zero values", async () => {
    const { caseId, quoteId } = createNegotiatingCaseWithExistingQuote();
    dbState.ai_negotiation_logs.push({
      id: "neg-log-unsent-newer",
      caseId,
      supplierId: "sup-e2e-1",
      round: 2,
      promptGoal: "discount_5",
      draftEmail: "<p>Draft chưa gửi</p>",
      status: "draft",
      createdAt: new Date().toISOString(),
    });

    const inboundRes = await request(app)
      .post("/api/v1/webhooks/inbound-email")
      .set("x-organization-id", ORG_ID)
      .send({
        fromEmail: "supplier-one@example.test",
        fromName: "Supplier One",
        subject: `Re: [STALLY NEGOTIATION-${caseId.toUpperCase()}] Discount accepted`,
        bodyText: "Chúng tôi đồng ý giảm thêm 5% cho báo giá hiện tại, không gửi lại bảng giá mới.",
        messageId: "<supplier-negotiation-guard@example.test>",
        threadId: "<thread-supplier-negotiation-guard@example.test>",
        internetMessageId: "<supplier-negotiation-guard@example.test>",
        receivedAt: "2026-06-04T04:00:00.000Z",
      });

    expect(inboundRes.status).toBe(200);

    const quote = dbState.quotes.find((q: any) => q.id === quoteId);
    expect(quote?.totalAmount).toBe(950000);
    expect(quote?.subtotal).toBe(950000);
    expect(quote?.items[0].unitPrice).toBe(9500);
    expect(quote?.totalAmount).toBeGreaterThan(0);
    expect(dbState.procurement_cases.find((c: any) => c.id === caseId)?.status).toBe("comparison_ready");
    expect(dbState.ai_negotiation_logs.find((log: any) => log.id === "neg-log-guard")?.status).toBe("supplier_responded");
    expect(dbState.ai_negotiation_logs.find((log: any) => log.id === "neg-log-unsent-newer")?.status).toBe("draft");

    const comparisonRes = await request(app)
      .get(`/api/v1/cases/${caseId}/comparison`)
      .set("x-organization-id", ORG_ID);
    expect(comparisonRes.body.matrix[0]).toMatchObject({
      negotiationStatus: "supplier_responded",
      versionCount: 1,
    });

    const overviewStateRes = await request(app)
      .get("/api/state")
      .set("x-organization-id", ORG_ID);
    const overviewQuote = overviewStateRes.body.quotes.find((q: any) => q.id === quoteId);
    expect(overviewQuote).toMatchObject({
      negotiationStatus: "supplier_responded",
      versionCount: 1,
      totalAmount: 950000,
    });
  });

  it("applies the sent discount goal when a supplier agrees but AI extracts the old quoted total", async () => {
    const { caseId, quoteId } = createNegotiatingCaseWithExistingQuote();
    mocks.genAiResponseText = JSON.stringify({
      items: [{ name: "Gao ST25", quantity: 100, unit: "kg", unitPrice: 10000, totalPrice: 1000000 }],
      subtotal: 1000000,
      taxAmount: 0,
      shippingFee: 0,
      totalAmount: 1000000,
      deliveryDays: 3,
      paymentTerms: "Không đề cập",
      aiConfidenceScore: 55,
    });

    const inboundRes = await request(app)
      .post("/api/v1/webhooks/inbound-email")
      .set("x-organization-id", ORG_ID)
      .send({
        fromEmail: "supplier-one@example.test",
        fromName: "Supplier One",
        subject: `Re: [STALLY NEGOTIATION-${caseId.toUpperCase()}] Discount accepted`,
        bodyText: "Đồng ý với đề xuất của Stally. Chúng tôi xác nhận điều chỉnh theo thư thương lượng trước đó.",
        messageId: "<supplier-negotiation-old-total@example.test>",
        threadId: "<thread-supplier-negotiation-old-total@example.test>",
        internetMessageId: "<supplier-negotiation-old-total@example.test>",
        receivedAt: "2026-06-04T04:10:00.000Z",
      });

    expect(inboundRes.status).toBe(200);

    const quote = dbState.quotes.find((q: any) => q.id === quoteId);
    expect(quote?.totalAmount).toBe(950000);
    expect(quote?.items[0].unitPrice).toBe(9500);
    expect(dbState.ai_negotiation_logs.find((log: any) => log.id === "neg-log-guard")?.status).toBe("supplier_responded");
  });

  it("does not mark negotiation as sent when Gmail send fails", async () => {
    const { caseId } = createNegotiatingCaseWithExistingQuote({
      caseStatus: "comparison_ready",
      logStatus: "draft",
    });
    mocks.sendRealEmail.mockRejectedValueOnce(new Error("Gmail API unavailable"));

    const sendRes = await request(app)
      .post("/api/v1/negotiation-drafts/neg-log-guard/send")
      .set("x-organization-id", ORG_ID)
      .send({ editedBody: "<p>Xin giảm thêm 5%</p>" });

    expect(sendRes.status).toBe(502);
    expect(sendRes.body.error.code).toBe("NEGOTIATION_EMAIL_SEND_FAILED");
    expect(dbState.procurement_cases.find((c: any) => c.id === caseId)?.status).toBe("comparison_ready");
    expect(dbState.ai_negotiation_logs.find((log: any) => log.id === "neg-log-guard")?.status).toBe("draft");
  });

  it.skip("does not process the same inbound messageId twice", async () => {
    const { caseId } = await createCaseReadyForRfq();

    const firstInboundRes = await postInboundQuote(caseId, "<duplicate-quote@example.test>");
    expect(firstInboundRes.status).toBe(200);
    await sleep(450);

    const inboundEmailCount = dbState.email_messages.filter((m: any) => m.direction === "inbound").length;
    const quoteCount = dbState.quotes.length;
    const quoteVersionCount = dbState.quote_versions.length;
    const firstQuoteId = dbState.quotes[0]?.id;

    const duplicateInboundRes = await postInboundQuote(caseId, "<duplicate-quote@example.test>");
    expect(duplicateInboundRes.status).toBe(200);
    await sleep(50);

    expect(dbState.email_messages.filter((m: any) => m.direction === "inbound")).toHaveLength(inboundEmailCount);
    expect(dbState.quotes).toHaveLength(quoteCount);
    expect(dbState.quote_versions).toHaveLength(quoteVersionCount);
    expect(dbState.quotes[0]?.id).toBe(firstQuoteId);
  });

  it("scans an unread IMAP RFQ reply and marks the message as seen after ingestion", async () => {
    const { caseId } = await createCaseReadyForRfq();

    vi.stubEnv("EMAIL_INBOUND_PROVIDER", "imap");
    vi.stubEnv("IMAP_POLL_ENABLED", "true");
    vi.stubEnv("IMAP_HOST", "imap.example.test");
    vi.stubEnv("IMAP_USER", "buyer@stally.test");
    vi.stubEnv("IMAP_PASS", "imap-password");
    vi.stubEnv("IMAP_MAILBOX", "INBOX");
    vi.stubEnv("IMAP_POLL_INTERVAL_MS", "60000");

    mocks.imapSearchResults = [[501], []];
    mocks.imapFetchMessage = {
      uid: 501,
      envelope: {
        subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Quote from IMAP`,
      },
      source: Buffer.from("raw imap email"),
    };
    mocks.simpleParser.mockResolvedValue({
      from: { value: [{ address: "supplier-one@example.test", name: "Supplier One" }] },
      subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Quote from IMAP`,
      text: "Quote via IMAP: Gao ST25 100kg at 25000 VND/kg.",
      html: "<p>Quote via IMAP</p>",
      attachments: [
        {
          filename: "quote-imap.pdf",
          content: Buffer.from("fake pdf"),
          contentType: "application/pdf",
          size: 8,
        },
      ],
      messageId: "<imap-quote-1@example.test>",
      inReplyTo: "<smtp-rfq-message-1>",
      references: ["<smtp-rfq-message-1>"],
      date: new Date("2026-06-04T03:30:00.000Z"),
    });

    startImapPolling();

    await waitUntil(() => dbState.email_messages.some((m: any) => m.gmailMessageId === "<imap-quote-1@example.test>"));
    await sleep(450);

    const imap = mocks.imapInstances[0];
    expect(imap.search).toHaveBeenCalledTimes(2);
    expect(imap.fetchOne).toHaveBeenCalledWith("501", expect.any(Object), { uid: true });
    expect(imap.messageFlagsAdd).toHaveBeenCalledWith(501, ["\\Seen"], { uid: true });

    const inboundEmail = dbState.email_messages.find((m: any) => m.gmailMessageId === "<imap-quote-1@example.test>");
    expect(inboundEmail?.linkedCaseId).toBe(caseId);
    expect(inboundEmail?.linkedSupplierId).toBe("sup-e2e-1");
    expect(dbState.procurement_cases.find((c: any) => c.id === caseId)?.status).toBe("comparison_ready");
    expect(dbState.quotes).toHaveLength(1);
  });
});

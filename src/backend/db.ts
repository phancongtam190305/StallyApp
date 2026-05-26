import pg from "pg";
import dotenv from "dotenv";
import {
  Supplier,
  ProcurementCase,
  PurchaseRequest,
  RfqCase,
  Quote,
  QuoteVersion,
  PurchaseOrder,
  EmailMessage,
  SupplierDiscoveryCandidate,
} from "../types.js";

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Set it to your Supabase Postgres connection string.");
}

if (databaseUrl.includes("[YOUR-PASSWORD]")) {
  throw new Error("DATABASE_URL still contains [YOUR-PASSWORD]. Replace it with your real Supabase database password.");
}

const parsedDatabaseUrl = new URL(databaseUrl);

const poolConfig = {
  host: parsedDatabaseUrl.hostname,
  port: parsedDatabaseUrl.port ? Number(parsedDatabaseUrl.port) : 5432,
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: decodeURIComponent(parsedDatabaseUrl.password),
  database: parsedDatabaseUrl.pathname.replace(/^\//, "") || "postgres",
  ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DATABASE_POOL_MAX || 5),
};

export const db = new Pool(poolConfig as pg.PoolConfig);

const tableNames = [
  "organizations",
  "users",
  "suppliers",
  "supplier_discovery_candidates",
  "inventory_items",
  "procurement_cases",
  "case_transitions",
  "purchase_requests",
  "rfq_cases",
  "quotes",
  "quote_versions",
  "purchase_orders",
  "email_accounts",
  "email_messages",
  "ai_negotiation_logs",
  "rfq_email_drafts",
  "stock_movements",
];

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function prepareJsonFields(table: string, entity: any) {
  const data = { ...entity };

  if (table === "suppliers" && Array.isArray(data.tags)) {
    data.tags = JSON.stringify(data.tags);
  } else if (table === "supplier_discovery_candidates") {
    data.tags = JSON.stringify(data.tags || []);
    data.sourceUrls = JSON.stringify(data.sourceUrls || []);
    data.riskFlags = JSON.stringify(data.riskFlags || []);
  } else if (table === "procurement_cases" && Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items);
  } else if (table === "purchase_requests" && Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items);
  } else if (table === "rfq_cases" && Array.isArray(data.suppliers)) {
    data.suppliers = JSON.stringify(data.suppliers);
  } else if (table === "quotes" && Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items);
  } else if (table === "quote_versions" && Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items);
  } else if (table === "purchase_orders" && Array.isArray(data.items)) {
    data.items = JSON.stringify(data.items);
  } else if (table === "email_messages") {
    data.referencesList = JSON.stringify(data.references || []);
    data.fromAddress = data.from ?? data.fromAddress ?? "";
    data.toAddress = JSON.stringify(data.to || []);
    data.ccAddress = JSON.stringify(data.cc || []);
    data.attachments = JSON.stringify(data.attachments || []);

    delete data.references;
    delete data.from;
    delete data.to;
    delete data.cc;
  }

  return data;
}

async function upsert(table: string, entity: any, client: Pick<pg.Pool | pg.PoolClient, "query"> = db) {
  const data = prepareJsonFields(table, entity);
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  if (keys.length === 0) return;

  const columns = keys.map(quoteIdent).join(", ");
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
  const updates = keys
    .filter((key) => key !== "id")
    .map((key) => `${quoteIdent(key)} = EXCLUDED.${quoteIdent(key)}`)
    .join(", ");
  const values = keys.map((key) => data[key]);

  const sql = `
    INSERT INTO ${quoteIdent(table)} (${columns})
    VALUES (${placeholders})
    ON CONFLICT ("id") DO UPDATE SET ${updates || `"id" = EXCLUDED."id"`}
  `;

  await client.query(sql, values);
}

export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "industry" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "status" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "suppliers" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "contactPerson" TEXT,
      "email" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "address" TEXT,
      "rating" DOUBLE PRECISION,
      "tags" TEXT,
      "historicalPricing" TEXT,
      "source" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "supplier_discovery_candidates" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "caseId" TEXT NOT NULL,
      "query" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "contactPerson" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "address" TEXT,
      "website" TEXT,
      "tags" TEXT NOT NULL,
      "sourceUrls" TEXT NOT NULL,
      "evidence" TEXT,
      "confidence" INTEGER NOT NULL,
      "riskFlags" TEXT NOT NULL,
      "autoAddEligible" BOOLEAN NOT NULL,
      "duplicateOfSupplierId" TEXT,
      "status" TEXT NOT NULL,
      "promotedSupplierId" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "inventory_items" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "sku" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "unit" TEXT NOT NULL,
      "minStockLevel" DOUBLE PRECISION NOT NULL,
      "quantityAvailable" DOUBLE PRECISION NOT NULL,
      "quantityOnOrder" DOUBLE PRECISION NOT NULL,
      "lastPurchasePrice" DOUBLE PRECISION NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "procurement_cases" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "priority" TEXT NOT NULL,
      "createdFrom" TEXT NOT NULL,
      "requesterId" TEXT,
      "requesterName" TEXT,
      "requesterDepartmentId" TEXT,
      "departmentName" TEXT,
      "assignedBuyerId" TEXT,
      "requiredDate" TEXT,
      "requestId" TEXT,
      "currentRfqId" TEXT,
      "selectedQuoteId" TEXT,
      "selectedQuoteVersionId" TEXT,
      "purchaseOrderId" TEXT,
      "items" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "closedAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS "case_transitions" (
      "id" TEXT PRIMARY KEY,
      "caseId" TEXT NOT NULL,
      "fromStatus" TEXT NOT NULL,
      "toStatus" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "actorRole" TEXT NOT NULL,
      "reason" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "purchase_requests" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "requesterId" TEXT NOT NULL,
      "requesterName" TEXT NOT NULL,
      "departmentName" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "priority" TEXT NOT NULL,
      "requiredDate" TEXT NOT NULL,
      "items" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "rfq_cases" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "purchaseRequestId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "dueDate" TEXT NOT NULL,
      "suppliers" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "quotes" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "rfqCaseId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "supplierName" TEXT NOT NULL,
      "items" TEXT NOT NULL,
      "subtotal" DOUBLE PRECISION NOT NULL,
      "taxAmount" DOUBLE PRECISION NOT NULL,
      "shippingFee" DOUBLE PRECISION NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "deliveryDays" INTEGER NOT NULL,
      "paymentTerms" TEXT NOT NULL,
      "validUntil" TEXT NOT NULL,
      "aiConfidenceScore" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "originalFileUrl" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "quote_versions" (
      "id" TEXT PRIMARY KEY,
      "quoteId" TEXT NOT NULL,
      "round" INTEGER NOT NULL,
      "items" TEXT NOT NULL,
      "subtotal" DOUBLE PRECISION NOT NULL,
      "taxAmount" DOUBLE PRECISION NOT NULL,
      "shippingFee" DOUBLE PRECISION NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "deliveryDays" INTEGER NOT NULL,
      "paymentTerms" TEXT NOT NULL,
      "validUntil" TEXT NOT NULL,
      "aiConfidenceScore" INTEGER NOT NULL,
      "originalFileUrl" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "purchase_orders" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "caseId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "supplierName" TEXT NOT NULL,
      "quoteId" TEXT NOT NULL,
      "quoteVersionId" TEXT,
      "items" TEXT NOT NULL,
      "subtotal" DOUBLE PRECISION NOT NULL,
      "taxAmount" DOUBLE PRECISION NOT NULL,
      "shippingFee" DOUBLE PRECISION NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "status" TEXT NOT NULL,
      "approvedBy" TEXT NOT NULL,
      "approvedAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "email_accounts" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "email_messages" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "gmailAccountId" TEXT NOT NULL,
      "gmailMessageId" TEXT NOT NULL,
      "gmailThreadId" TEXT NOT NULL,
      "internetMessageId" TEXT,
      "inReplyTo" TEXT,
      "referencesList" TEXT,
      "direction" TEXT NOT NULL,
      "fromAddress" TEXT NOT NULL,
      "toAddress" TEXT NOT NULL,
      "ccAddress" TEXT,
      "subject" TEXT NOT NULL,
      "bodyText" TEXT,
      "bodyHtml" TEXT,
      "snippet" TEXT,
      "receivedAt" TEXT,
      "sentAt" TEXT,
      "linkedCaseId" TEXT,
      "linkedSupplierId" TEXT,
      "classification" TEXT,
      "attachments" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ai_negotiation_logs" (
      "id" TEXT PRIMARY KEY,
      "caseId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "round" INTEGER NOT NULL,
      "promptGoal" TEXT NOT NULL,
      "draftEmail" TEXT NOT NULL,
      "userEditedEmail" TEXT,
      "supplierReplyRaw" TEXT,
      "status" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "rfq_email_drafts" (
      "id" TEXT PRIMARY KEY,
      "caseId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL,
      "supplierName" TEXT NOT NULL,
      "supplierEmail" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "bodyHtml" TEXT NOT NULL,
      "dueDate" TEXT NOT NULL,
      "status" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "stock_movements" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "itemId" TEXT NOT NULL,
      "movementType" TEXT NOT NULL,
      "quantity" DOUBLE PRECISION NOT NULL,
      "referenceType" TEXT NOT NULL,
      "referenceId" TEXT,
      "createdBy" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );
  `);

  await seedIfEmpty();
}

async function seedIfEmpty() {
  const countResult = await db.query('SELECT COUNT(*)::int AS count FROM "organizations"');
  if (countResult.rows[0]?.count > 0) return;

  console.log("Supabase database is empty. Seeding pilot data...");
  const now = new Date().toISOString();

  await upsert("organizations", {
    id: "org-1",
    name: "Stally Food & Beverage Group",
    industry: "Nhà hàng & Thực phẩm",
    createdAt: now,
  });

  const users = [
    { id: "u-1", organizationId: "org-1", email: "phancongtam190305@gmail.com", name: "Phan Công Tâm", role: "procurement", status: "active" },
    { id: "u-2", organizationId: "org-1", email: "bep_truong@stally.com", name: "Trần Văn Bình", role: "requester", status: "active" },
    { id: "u-3", organizationId: "org-1", email: "manager@stally.com", name: "Nguyễn Thị Mai", role: "manager", status: "active" },
    { id: "u-4", organizationId: "org-1", email: "kho@stally.com", name: "Lý Văn Khoa", role: "warehouse", status: "active" },
  ];
  for (const user of users) await upsert("users", user);

  const suppliers = [
    {
      id: "sup-1",
      organizationId: "org-1",
      name: "NCC Thực Phẩm Sạch Cầu Đất",
      contactPerson: "Lâm Đình Huy",
      email: "caudat.fresh@gmail.com",
      phone: "0901234567",
      address: "Đà Lạt",
      rating: 4.8,
      tags: ["Rau củ", "Trái cây", "Thực phẩm tươi"],
      historicalPricing: "Rau củ Mỹ/Organic: 32.000đ - 35.000đ/kg.",
      source: "crm",
    },
    {
      id: "sup-2",
      organizationId: "org-1",
      name: "NCC Gạo Vàng Việt Nam",
      contactPerson: "Nguyễn Văn Hùng",
      email: "gaovangvietnam@gmail.com",
      phone: "0987654321",
      address: "Đồng Tháp",
      rating: 4.6,
      tags: ["Thực phẩm khô", "Gạo", "Gia vị"],
      historicalPricing: "Gạo ST25 Cao Cấp: 27.500đ - 29.000đ/kg.",
      source: "crm",
    },
    {
      id: "sup-3",
      organizationId: "org-1",
      name: "NCC Hải Sản & Thịt Biển Đông",
      contactPerson: "Phạm Hải Đăng",
      email: "biendongseafood@gmail.com",
      phone: "0909998887",
      address: "Đà Nẵng",
      rating: 4.7,
      tags: ["Hải sản", "Thịt tươi", "Thực phẩm tươi"],
      historicalPricing: "Thịt Bò Mỹ Slicing: 235.000đ - 240.000đ/kg.",
      source: "crm",
    },
  ];
  for (const supplier of suppliers) await upsert("suppliers", supplier);

  const inventory = [
    { id: "inv-1", organizationId: "org-1", sku: "SKU-ST25", name: "Gạo ST25 Cao Cấp", category: "Thực phẩm khô", unit: "kg", minStockLevel: 100, quantityAvailable: 45, quantityOnOrder: 0, lastPurchasePrice: 28000, updatedAt: now },
    { id: "inv-2", organizationId: "org-1", sku: "SKU-XL01", name: "Xà Lách Mỹ Organic", category: "Thực phẩm tươi", unit: "kg", minStockLevel: 15, quantityAvailable: 12, quantityOnOrder: 0, lastPurchasePrice: 35000, updatedAt: now },
    { id: "inv-3", organizationId: "org-1", sku: "SKU-DA03", name: "Dầu Ăn Tường An 5L", category: "Gia vị", unit: "chai", minStockLevel: 20, quantityAvailable: 8, quantityOnOrder: 0, lastPurchasePrice: 195000, updatedAt: now },
  ];
  for (const item of inventory) await upsert("inventory_items", item);

  await upsert("email_accounts", {
    id: "acc-1",
    organizationId: "org-1",
    email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "procurement@stally.com",
    status: "connected",
    createdAt: now,
  });
}

export async function loadDbState() {
  const rows = async (table: string) => (await db.query(`SELECT * FROM ${quoteIdent(table)}`)).rows;

  return {
    organizations: await rows("organizations"),
    users: await rows("users"),
    suppliers: (await rows("suppliers")).map(parseSupplier),
    supplier_discovery_candidates: (await rows("supplier_discovery_candidates")).map(parseSupplierDiscoveryCandidate),
    inventory_items: await rows("inventory_items"),
    procurement_cases: (await rows("procurement_cases")).map(parseProcurementCase),
    case_transitions: await rows("case_transitions"),
    purchase_requests: (await rows("purchase_requests")).map(parsePurchaseRequest),
    rfq_cases: (await rows("rfq_cases")).map(parseRfqCase),
    quotes: (await rows("quotes")).map(parseQuote),
    quote_versions: (await rows("quote_versions")).map(parseQuoteVersion),
    purchase_orders: (await rows("purchase_orders")).map(parsePurchaseOrder),
    email_accounts: await rows("email_accounts"),
    email_messages: (await rows("email_messages")).map(parseEmailMessage),
    ai_negotiation_logs: await rows("ai_negotiation_logs"),
    rfq_email_drafts: await rows("rfq_email_drafts"),
    stock_movements: await rows("stock_movements"),
  };
}

export async function checkDbHealth() {
  await db.query("SELECT 1");
}

export function parseSupplier(row: any): Supplier {
  if (!row) return row;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

export function parseSupplierDiscoveryCandidate(row: any): SupplierDiscoveryCandidate {
  if (!row) return row;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    sourceUrls: row.sourceUrls ? JSON.parse(row.sourceUrls) : [],
    riskFlags: row.riskFlags ? JSON.parse(row.riskFlags) : [],
    autoAddEligible: Boolean(row.autoAddEligible),
  };
}

export function parseProcurementCase(row: any): ProcurementCase {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  };
}

export function parsePurchaseRequest(row: any): PurchaseRequest {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  };
}

export function parseRfqCase(row: any): RfqCase {
  if (!row) return row;
  return {
    ...row,
    suppliers: row.suppliers ? JSON.parse(row.suppliers) : [],
  };
}

export function parseQuote(row: any): Quote {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  };
}

export function parseQuoteVersion(row: any): QuoteVersion {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  };
}

export function parsePurchaseOrder(row: any): PurchaseOrder {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  };
}

export function parseEmailMessage(row: any): EmailMessage {
  if (!row) return row;
  return {
    ...row,
    to: row.toAddress ? JSON.parse(row.toAddress) : [],
    cc: row.ccAddress ? JSON.parse(row.ccAddress) : [],
    references: row.referencesList ? JSON.parse(row.referencesList) : [],
    from: row.fromAddress,
    attachments: row.attachments ? JSON.parse(row.attachments) : [],
  };
}

let persistChain = Promise.resolve();

export function persistDbState(dbState: any) {
  if (!dbState) return;

  persistChain = persistChain
    .then(() => persistDbStateNow(dbState))
    .catch((err) => {
      console.error("Failed to persist database state to Supabase:", err);
    });
}

export async function persistDbStateNow(dbState: any) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const table of [...tableNames].reverse()) {
      await client.query(`DELETE FROM ${quoteIdent(table)}`);
    }

    const saveAll = async (table: string, entities: any[] = []) => {
      for (const entity of entities) {
        await upsert(table, entity, client);
      }
    };

    await saveAll("organizations", dbState.organizations);
    await saveAll("users", dbState.users);
    await saveAll("suppliers", dbState.suppliers);
    await saveAll("supplier_discovery_candidates", dbState.supplier_discovery_candidates);
    await saveAll("inventory_items", dbState.inventory_items);
    await saveAll("procurement_cases", dbState.procurement_cases);
    await saveAll("case_transitions", dbState.case_transitions);
    await saveAll("purchase_requests", dbState.purchase_requests);
    await saveAll("rfq_cases", dbState.rfq_cases);
    await saveAll("quotes", dbState.quotes);
    await saveAll("quote_versions", dbState.quote_versions);
    await saveAll("purchase_orders", dbState.purchase_orders);
    await saveAll("email_accounts", dbState.email_accounts);
    await saveAll("email_messages", dbState.email_messages);
    await saveAll("ai_negotiation_logs", dbState.ai_negotiation_logs);
    await saveAll("rfq_email_drafts", dbState.rfq_email_drafts);
    await saveAll("stock_movements", dbState.stock_movements);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

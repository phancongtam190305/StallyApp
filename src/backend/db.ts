import Database from "better-sqlite3";
import path from "path";
import { 
  Organization, User, Supplier, InventoryItem, ProcurementCase, CaseTransition,
  PurchaseRequest, RfqCase, Quote, QuoteVersion, PurchaseOrder, EmailMessage,
  AiNegotiationLog, StockMovement
} from "../types.js";

const dbPath = path.resolve(process.cwd(), "stally.db");
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

export function initDb() {
  // Create tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactPerson TEXT,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      rating REAL,
      tags TEXT, -- JSON Array
      historicalPricing TEXT,
      source TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      minStockLevel REAL NOT NULL,
      quantityAvailable REAL NOT NULL,
      quantityOnOrder REAL NOT NULL,
      lastPurchasePrice REAL NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS procurement_cases (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      createdFrom TEXT NOT NULL,
      requesterId TEXT,
      requesterName TEXT,
      requesterDepartmentId TEXT,
      departmentName TEXT,
      assignedBuyerId TEXT,
      requiredDate TEXT,
      requestId TEXT,
      currentRfqId TEXT,
      selectedQuoteId TEXT,
      selectedQuoteVersionId TEXT,
      purchaseOrderId TEXT,
      items TEXT NOT NULL, -- JSON Array
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      closedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS case_transitions (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      fromStatus TEXT NOT NULL,
      toStatus TEXT NOT NULL,
      actorId TEXT NOT NULL,
      actorRole TEXT NOT NULL,
      reason TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(caseId) REFERENCES procurement_cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      requesterId TEXT NOT NULL,
      requesterName TEXT NOT NULL,
      departmentName TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      requiredDate TEXT NOT NULL,
      items TEXT NOT NULL, -- JSON Array
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS rfq_cases (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      purchaseRequestId TEXT NOT NULL,
      status TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      suppliers TEXT NOT NULL, -- JSON Array
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      rfqCaseId TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      items TEXT NOT NULL, -- JSON Array
      subtotal REAL NOT NULL,
      taxAmount REAL NOT NULL,
      shippingFee REAL NOT NULL,
      totalAmount REAL NOT NULL,
      deliveryDays INTEGER NOT NULL,
      paymentTerms TEXT NOT NULL,
      validUntil TEXT NOT NULL,
      aiConfidenceScore INTEGER NOT NULL,
      status TEXT NOT NULL,
      originalFileUrl TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id),
      FOREIGN KEY(rfqCaseId) REFERENCES rfq_cases(id)
    );

    CREATE TABLE IF NOT EXISTS quote_versions (
      id TEXT PRIMARY KEY,
      quoteId TEXT NOT NULL,
      round INTEGER NOT NULL,
      items TEXT NOT NULL, -- JSON Array
      subtotal REAL NOT NULL,
      taxAmount REAL NOT NULL,
      shippingFee REAL NOT NULL,
      totalAmount REAL NOT NULL,
      deliveryDays INTEGER NOT NULL,
      paymentTerms TEXT NOT NULL,
      validUntil TEXT NOT NULL,
      aiConfidenceScore INTEGER NOT NULL,
      originalFileUrl TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(quoteId) REFERENCES quotes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      caseId TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      quoteId TEXT NOT NULL,
      quoteVersionId TEXT,
      items TEXT NOT NULL, -- JSON Array
      subtotal REAL NOT NULL,
      taxAmount REAL NOT NULL,
      shippingFee REAL NOT NULL,
      totalAmount REAL NOT NULL,
      status TEXT NOT NULL,
      approvedBy TEXT NOT NULL,
      approvedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id),
      FOREIGN KEY(caseId) REFERENCES procurement_cases(id)
    );

    CREATE TABLE IF NOT EXISTS email_accounts (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS email_messages (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      gmailAccountId TEXT NOT NULL,
      gmailMessageId TEXT NOT NULL,
      gmailThreadId TEXT NOT NULL,
      internetMessageId TEXT,
      inReplyTo TEXT,
      referencesList TEXT, -- JSON Array
      direction TEXT NOT NULL,
      fromAddress TEXT NOT NULL,
      toAddress TEXT NOT NULL, -- JSON Array
      ccAddress TEXT, -- JSON Array
      subject TEXT NOT NULL,
      bodyText TEXT,
      bodyHtml TEXT,
      snippet TEXT,
      receivedAt TEXT,
      sentAt TEXT,
      linkedCaseId TEXT,
      linkedSupplierId TEXT,
      classification TEXT,
      attachments TEXT NOT NULL, -- JSON Array
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS ai_negotiation_logs (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      round INTEGER NOT NULL,
      promptGoal TEXT NOT NULL,
      draftEmail TEXT NOT NULL,
      userEditedEmail TEXT,
      supplierReplyRaw TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(caseId) REFERENCES procurement_cases(id)
    );

    CREATE TABLE IF NOT EXISTS rfq_email_drafts (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      supplierEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      bodyHtml TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY(caseId) REFERENCES procurement_cases(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      movementType TEXT NOT NULL,
      quantity REAL NOT NULL,
      referenceType TEXT NOT NULL,
      referenceId TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id),
      FOREIGN KEY(itemId) REFERENCES inventory_items(id)
    );
  `);

  // Seed data if organizations table is empty
  const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
  if (orgCount.count === 0) {
    console.log("Database is empty. Seeding mock data...");

    // Seed Organization
    db.prepare(`
      INSERT INTO organizations (id, name, industry, createdAt)
      VALUES ('org-1', 'Stally Food & Beverage Group', 'Nhà hàng & Thực phẩm', ?)
    `).run(new Date().toISOString());

    // Seed Users
    const users = [
      { id: "u-1", organizationId: "org-1", email: "phancongtam190305@gmail.com", name: "Phan Công Tâm", role: "procurement", status: "active" },
      { id: "u-2", organizationId: "org-1", email: "bep_truong@stally.com", name: "Trần Văn Bình", role: "requester", status: "active" },
      { id: "u-3", organizationId: "org-1", email: "manager@stally.com", name: "Nguyễn Thị Mai", role: "manager", status: "active" },
      { id: "u-4", organizationId: "org-1", email: "kho@stally.com", name: "Lý Văn Khoa", role: "warehouse", status: "active" }
    ];
    const insertUser = db.prepare(`
      INSERT INTO users (id, organizationId, email, name, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
      insertUser.run(u.id, u.organizationId, u.email, u.name, u.role, u.status);
    }

    // Seed Suppliers
    const suppliers = [
      { 
        id: "sup-1", 
        organizationId: "org-1",
        name: "NCC Thực Phẩm Sạch Cầu Đất", 
        contactPerson: "Lâm Đình Huy",
        email: "caudat.fresh@gmail.com", 
        phone: "0901234567", 
        address: "12 Lạc Long Quân, Trạm Hành, Đà Lạt",
        rating: 4.8, 
        tags: JSON.stringify(["Rau củ", "Trái cây", "Thực phẩm tươi"]),
        historicalPricing: "Rau củ Mỹ/Organic: 32.000đ - 35.000đ/kg; Xà lách: 30.000đ/kg. Giá cập nhật ngày 15/05/2026.",
        source: "crm"
      },
      { 
        id: "sup-2", 
        organizationId: "org-1",
        name: "NCC Gạo Vàng Việt Nam", 
        contactPerson: "Nguyễn Văn Hùng",
        email: "gaovangvietnam@gmail.com", 
        phone: "0987654321", 
        address: "Vinh Đông, Sa Đéc, Đồng Tháp",
        rating: 4.6, 
        tags: JSON.stringify(["Thực phẩm khô", "Gạo", "Gia vị"]),
        historicalPricing: "Gạo ST25 Cao Cấp: 27.500đ - 29.000đ/kg. Ổn định quanh năm.",
        source: "crm"
      },
      { 
        id: "sup-3", 
        organizationId: "org-1",
        name: "NCC Hải Sản & Thịt Biển Đông", 
        contactPerson: "Phạm Hải Đăng",
        email: "biendongseafood@gmail.com", 
        phone: "0909998887", 
        address: "Cảng cá Thọ Quang, Sơn Trà, Đà Nẵng",
        rating: 4.7, 
        tags: JSON.stringify(["Hải sản", "Thịt tươi", "Thực phẩm tươi"]),
        historicalPricing: "Thịt Bò Mỹ Slicing: 235.000đ - 240.000đ/kg. Cơm/Thịt gà: 85.000đ/kg.",
        source: "crm"
      },
      { 
        id: "sup-4", 
        organizationId: "org-1",
        name: "Nhà Cung Cấp Thiết Bị Tổng Hợp An Phát", 
        contactPerson: "Trần Thị Lan",
        email: "anphat.general@gmail.com", 
        phone: "0912348765", 
        address: "32 Tô Hiến Thành, Quận 10, TP. Hồ Chí Minh",
        rating: 4.2, 
        tags: JSON.stringify(["Dụng cụ bếp", "Tẩy rửa", "Kitchenware"]),
        historicalPricing: "Chén Dĩa Sứ Minh Long: 42.000đ - 45.000đ/cái. Chiết khấu 5% cho đơn > 100 cái.",
        source: "crm"
      }
    ];
    const insertSupplier = db.prepare(`
      INSERT INTO suppliers (id, organizationId, name, contactPerson, email, phone, address, rating, tags, historicalPricing, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of suppliers) {
      insertSupplier.run(s.id, s.organizationId, s.name, s.contactPerson, s.email, s.phone, s.address, s.rating, s.tags, s.historicalPricing, s.source);
    }

    // Seed Inventory Items
    const inventory = [
      { id: "inv-1", organizationId: "org-1", sku: "SKU-ST25", name: "Gạo ST25 Cao Cấp", category: "Thực phẩm khô", unit: "kg", minStockLevel: 100, quantityAvailable: 45, quantityOnOrder: 0, lastPurchasePrice: 28000, updatedAt: new Date().toISOString() },
      { id: "inv-2", organizationId: "org-1", sku: "SKU-XL01", name: "Xà Lách Mỹ Organic", category: "Thực phẩm tươi", unit: "kg", minStockLevel: 15, quantityAvailable: 12, quantityOnOrder: 0, lastPurchasePrice: 35000, updatedAt: new Date().toISOString() },
      { id: "inv-3", organizationId: "org-1", sku: "SKU-TB02", name: "Thịt Bò Mỹ Slicing", category: "Thực phẩm tươi", unit: "kg", minStockLevel: 30, quantityAvailable: 40, quantityOnOrder: 0, lastPurchasePrice: 240000, updatedAt: new Date().toISOString() },
      { id: "inv-4", organizationId: "org-1", sku: "SKU-DA03", name: "Dầu Ăn Tường An 5L", category: "Gia vị", unit: "chai", minStockLevel: 20, quantityAvailable: 8, quantityOnOrder: 0, lastPurchasePrice: 195000, updatedAt: new Date().toISOString() },
      { id: "inv-5", organizationId: "org-1", sku: "SKU-ML04", name: "Chén Dĩa Sứ Minh Long", category: "Dụng cụ bếp", unit: "cái", minStockLevel: 100, quantityAvailable: 120, quantityOnOrder: 0, lastPurchasePrice: 45000, updatedAt: new Date().toISOString() }
    ];
    const insertInventory = db.prepare(`
      INSERT INTO inventory_items (id, organizationId, sku, name, category, unit, minStockLevel, quantityAvailable, quantityOnOrder, lastPurchasePrice, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const inv of inventory) {
      insertInventory.run(inv.id, inv.organizationId, inv.sku, inv.name, inv.category, inv.unit, inv.minStockLevel, inv.quantityAvailable, inv.quantityOnOrder, inv.lastPurchasePrice, inv.updatedAt);
    }

    // Seed Purchase Requests
    const pr1Items = [
      { name: "Gạo ST25 Cao Cấp", quantity: 150, unit: "kg", notes: "Kho đã cạn dưới mức tối thiểu" },
      { name: "Dầu Ăn Tường An 5L", quantity: 30, unit: "chai", notes: "Dùng cho tiệc cuối tháng" }
    ];
    const pr2Items = [
      { name: "Xà Lách Mỹ Organic", quantity: 10, unit: "kg", notes: "Tự động phát hiện vơi thâm hụt" }
    ];

    const prs = [
      {
        id: "pr-1",
        organizationId: "org-1",
        requesterId: "u-2",
        requesterName: "Trần Văn Bình (Bếp Trưởng)",
        departmentName: "Bộ phận Bếp",
        title: "Yêu cầu mua gạo ST25 và dầu ăn khẩn cấp dọn kho",
        status: "submitted",
        priority: "high",
        requiredDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: JSON.stringify(pr1Items),
        source: "web",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "pr-2",
        organizationId: "org-1",
        requesterId: "u-1",
        requesterName: "Phan Công Tâm",
        departmentName: "Ban quản trị",
        title: "Bổ sung tồn kho khẩn cấp: Xà Lách Mỹ Organic",
        status: "approved",
        priority: "medium",
        requiredDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: JSON.stringify(pr2Items),
        source: "inventory_alert",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertPR = db.prepare(`
      INSERT INTO purchase_requests (id, organizationId, requesterId, requesterName, departmentName, title, status, priority, requiredDate, items, source, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pr of prs) {
      insertPR.run(pr.id, pr.organizationId, pr.requesterId, pr.requesterName, pr.departmentName, pr.title, pr.status, pr.priority, pr.requiredDate, pr.items, pr.source, pr.createdAt);
    }

    // Seed Procurement Cases
    const cases = [
      {
        id: "case-1",
        organizationId: "org-1",
        title: "Yêu cầu mua gạo ST25 và dầu ăn khẩn cấp dọn kho",
        status: "collecting_quotes",
        priority: "high",
        createdFrom: "web",
        requesterId: "u-2",
        requesterName: "Trần Văn Bình (Bếp Trưởng)",
        requesterDepartmentId: "dept_kitchen",
        departmentName: "Bộ phận Bếp",
        assignedBuyerId: null,
        requiredDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        requestId: "pr-1",
        currentRfqId: "rfq-1",
        selectedQuoteId: null,
        selectedQuoteVersionId: null,
        purchaseOrderId: null,
        items: JSON.stringify(pr1Items),
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "case-2",
        organizationId: "org-1",
        title: "Bổ sung tồn kho khẩn cấp: Xà Lách Mỹ Organic",
        status: "po_sent",
        priority: "medium",
        createdFrom: "inventory_alert",
        requesterId: "u-1",
        requesterName: "Phan Công Tâm",
        requesterDepartmentId: "dept_admin",
        departmentName: "Ban quản trị",
        assignedBuyerId: null,
        requiredDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        requestId: "pr-2",
        currentRfqId: "rfq-2",
        selectedQuoteId: "q-2",
        selectedQuoteVersionId: "qv-2-1",
        purchaseOrderId: "po-2",
        items: JSON.stringify(pr2Items),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    const insertCase = db.prepare(`
      INSERT INTO procurement_cases (id, organizationId, title, status, priority, createdFrom, requesterId, requesterName, requesterDepartmentId, departmentName, assignedBuyerId, requiredDate, requestId, currentRfqId, selectedQuoteId, selectedQuoteVersionId, purchaseOrderId, items, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of cases) {
      insertCase.run(
        c.id, c.organizationId, c.title, c.status, c.priority, c.createdFrom,
        c.requesterId, c.requesterName, c.requesterDepartmentId, c.departmentName, c.assignedBuyerId,
        c.requiredDate, c.requestId, c.currentRfqId, c.selectedQuoteId, c.selectedQuoteVersionId,
        c.purchaseOrderId, c.items, c.createdAt, c.updatedAt
      );
    }

    // Seed Case Transitions
    const transitions = [
      { id: "trans-1", caseId: "case-1", fromStatus: "draft_request", toStatus: "request_submitted", actorId: "u-2", actorRole: "requester", reason: "Nộp yêu cầu từ bộ phận bếp", createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "trans-2", caseId: "case-1", fromStatus: "request_submitted", toStatus: "supplier_matching", actorId: "u-1", actorRole: "procurement", reason: "Tiếp nhận yêu cầu thu mua", createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { id: "trans-3", caseId: "case-1", fromStatus: "supplier_matching", toStatus: "rfq_sent", actorId: "u-1", actorRole: "procurement", reason: "Phát hành RFQ chào thầu", createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: "trans-4", caseId: "case-1", fromStatus: "rfq_sent", toStatus: "collecting_quotes", actorId: "u-1", actorRole: "procurement", reason: "Đang thu thập báo giá", createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }
    ];
    const insertTransition = db.prepare(`
      INSERT INTO case_transitions (id, caseId, fromStatus, toStatus, actorId, actorRole, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of transitions) {
      insertTransition.run(t.id, t.caseId, t.fromStatus, t.toStatus, t.actorId, t.actorRole, t.reason, t.createdAt);
    }

    // Seed RFQ Cases
    const rfq1Suppliers = [
      { supplierId: "sup-2", name: "NCC Gạo Vàng Việt Nam", email: "gaovangvietnam@gmail.com", status: "sent" },
      { supplierId: "sup-4", name: "Nhà Cung Cấp Thiết Bị Tổng Hợp An Phát", email: "anphat.general@gmail.com", status: "replied", quoteId: "q-1" }
    ];
    const rfq2Suppliers = [
      { supplierId: "sup-1", name: "NCC Thực Phẩm Sạch Cầu Đất", email: "caudat.fresh@gmail.com", status: "replied", quoteId: "q-2" }
    ];

    const rfqs = [
      {
        id: "rfq-1",
        organizationId: "org-1",
        purchaseRequestId: "pr-1",
        status: "sent",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        suppliers: JSON.stringify(rfq1Suppliers),
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "rfq-2",
        organizationId: "org-1",
        purchaseRequestId: "pr-2",
        status: "approved",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        suppliers: JSON.stringify(rfq2Suppliers),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertRFQ = db.prepare(`
      INSERT INTO rfq_cases (id, organizationId, purchaseRequestId, status, dueDate, suppliers, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of rfqs) {
      insertRFQ.run(r.id, r.organizationId, r.purchaseRequestId, r.status, r.dueDate, r.suppliers, r.createdAt);
    }

    // Seed Quotes
    const q1Items = [
      { name: "Gạo ST25 Cao Cấp", quantity: 150, unit: "kg", unitPrice: 30000, totalPrice: 4500000 },
      { name: "Dầu Ăn Tường An 5L", quantity: 30, unit: "chai", unitPrice: 210000, totalPrice: 6300000 }
    ];
    const q2Items = [
      { name: "Xà Lách Mỹ Organic", quantity: 10, unit: "kg", unitPrice: 32000, totalPrice: 320000 }
    ];

    const quotes = [
      {
        id: "q-1",
        organizationId: "org-1",
        rfqCaseId: "rfq-1",
        supplierId: "sup-4",
        supplierName: "Nhà Cung Cấp Thiết Bị Tổng Hợp An Phát",
        items: JSON.stringify(q1Items),
        subtotal: 10800000,
        taxAmount: 1080000,
        shippingFee: 200000,
        totalAmount: 12080000,
        deliveryDays: 2,
        paymentTerms: "Thanh toán khi nhận hàng (COD)",
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        aiConfidenceScore: 98,
        status: "extracted",
        originalFileUrl: "quote_anphat_scan_1029.pdf",
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "q-2",
        organizationId: "org-1",
        rfqCaseId: "rfq-2",
        supplierId: "sup-1",
        supplierName: "NCC Thực Phẩm Sạch Cầu Đất",
        items: JSON.stringify(q2Items),
        subtotal: 320000,
        taxAmount: 32000,
        shippingFee: 50000,
        totalAmount: 402000,
        deliveryDays: 1,
        paymentTerms: "COD",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        aiConfidenceScore: 95,
        status: "selected",
        originalFileUrl: "bao_gia_caudat_salad.pdf",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertQuote = db.prepare(`
      INSERT INTO quotes (id, organizationId, rfqCaseId, supplierId, supplierName, items, subtotal, taxAmount, shippingFee, totalAmount, deliveryDays, paymentTerms, validUntil, aiConfidenceScore, status, originalFileUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const q of quotes) {
      insertQuote.run(
        q.id, q.organizationId, q.rfqCaseId, q.supplierId, q.supplierName, q.items,
        q.subtotal, q.taxAmount, q.shippingFee, q.totalAmount, q.deliveryDays, q.paymentTerms,
        q.validUntil, q.aiConfidenceScore, q.status, q.originalFileUrl, q.createdAt
      );
    }

    // Seed Quote Versions
    const quoteVersions = [
      {
        id: "qv-1-1",
        quoteId: "q-1",
        round: 1,
        items: JSON.stringify(q1Items),
        subtotal: 10800000,
        taxAmount: 1080000,
        shippingFee: 200000,
        totalAmount: 12080000,
        deliveryDays: 2,
        paymentTerms: "Thanh toán khi nhận hàng (COD)",
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        aiConfidenceScore: 98,
        originalFileUrl: "quote_anphat_scan_1029.pdf",
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertQV = db.prepare(`
      INSERT INTO quote_versions (id, quoteId, round, items, subtotal, taxAmount, shippingFee, totalAmount, deliveryDays, paymentTerms, validUntil, aiConfidenceScore, originalFileUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const qv of quoteVersions) {
      insertQV.run(
        qv.id, qv.quoteId, qv.round, qv.items, qv.subtotal, qv.taxAmount, qv.shippingFee, qv.totalAmount,
        qv.deliveryDays, qv.paymentTerms, qv.validUntil, qv.aiConfidenceScore, qv.originalFileUrl, qv.createdAt
      );
    }

    // Seed Purchase Order
    const pos = [
      {
        id: "po-2",
        organizationId: "org-1",
        caseId: "case-2",
        supplierId: "sup-1",
        supplierName: "NCC Thực Phẩm Sạch Cầu Đất",
        quoteId: "q-2",
        quoteVersionId: "qv-2-1",
        items: JSON.stringify(q2Items),
        subtotal: 320000,
        taxAmount: 32000,
        shippingFee: 50000,
        totalAmount: 402000,
        status: "issued",
        approvedBy: "Nguyễn Thị Mai (Giám Đốc)",
        approvedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertPO = db.prepare(`
      INSERT INTO purchase_orders (id, organizationId, caseId, supplierId, supplierName, quoteId, quoteVersionId, items, subtotal, taxAmount, shippingFee, totalAmount, status, approvedBy, approvedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const po of pos) {
      insertPO.run(
        po.id, po.organizationId, po.caseId, po.supplierId, po.supplierName, po.quoteId, po.quoteVersionId,
        po.items, po.subtotal, po.taxAmount, po.shippingFee, po.totalAmount, po.status, po.approvedBy, po.approvedAt, po.createdAt
      );
    }

    // Seed Email Accounts
    db.prepare(`
      INSERT INTO email_accounts (id, organizationId, email, status, createdAt)
      VALUES ('acc-1', 'org-1', 'procurement@stally.com', 'connected', ?)
    `).run(new Date().toISOString());

    // Seed Email Messages
    const emails = [
      {
        id: "email-out-1",
        organizationId: "org-1",
        gmailAccountId: "acc-1",
        gmailMessageId: "msg-out-1",
        gmailThreadId: "thread-1",
        internetMessageId: "<out1@stally.com>",
        inReplyTo: null,
        referencesList: JSON.stringify([]),
        direction: "outbound",
        fromAddress: "procurement@stally.com",
        toAddress: JSON.stringify(["anphat.general@gmail.com"]),
        ccAddress: JSON.stringify([]),
        subject: "[STALLY RFQ-1] Yêu cầu báo giá: Gạo ST25 và Dầu Ăn",
        bodyText: "Kính chào NCC An Phát, vui lòng báo giá cho...",
        bodyHtml: "<p>Kính chào NCC An Phát, vui lòng báo giá cho...</p>",
        snippet: "Kính chào NCC An Phát, vui lòng báo giá cho...",
        receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        sentAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        linkedCaseId: "case-1",
        linkedSupplierId: "sup-4",
        classification: "rfq",
        attachments: JSON.stringify([]),
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "email-in-1",
        organizationId: "org-1",
        gmailAccountId: "acc-1",
        gmailMessageId: "msg-in-1",
        gmailThreadId: "thread-1",
        internetMessageId: "<in1@anphat.com>",
        inReplyTo: "<out1@stally.com>",
        referencesList: JSON.stringify(["<out1@stally.com>"]),
        direction: "inbound",
        fromAddress: "Nhà Cung Cấp Thiết Bị Tổng Hợp An Phát <anphat.general@gmail.com>",
        toAddress: JSON.stringify(["procurement@stally.com"]),
        ccAddress: JSON.stringify([]),
        subject: "Re: [STALLY RFQ-1] Yêu cầu báo giá: Gạo ST25 và Dầu Ăn",
        bodyText: "Xin chào Ban Mua Sắm Stally F&B, chúng tôi gửi bảng giá đính kèm...",
        bodyHtml: "<p>Xin chào Ban Mua Sắm Stally F&B, chúng tôi gửi bảng giá đính kèm...</p>",
        snippet: "Xin chào Ban Mua Sắm Stally F&B, chúng tôi gửi bảng giá đính kèm...",
        receivedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        sentAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        linkedCaseId: "case-1",
        linkedSupplierId: "sup-4",
        classification: "quote",
        attachments: JSON.stringify([
          { id: "att-1", emailMessageId: "email-in-1", fileName: "quote_anphat_scan_1029.pdf", mimeType: "application/pdf", sizeBytes: 154200, storageKey: "att_anphat_1029" }
        ]),
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
      }
    ];
    const insertEmail = db.prepare(`
      INSERT INTO email_messages (id, organizationId, gmailAccountId, gmailMessageId, gmailThreadId, internetMessageId, inReplyTo, referencesList, direction, fromAddress, toAddress, ccAddress, subject, bodyText, bodyHtml, snippet, receivedAt, sentAt, linkedCaseId, linkedSupplierId, classification, attachments, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of emails) {
      insertEmail.run(
        e.id, e.organizationId, e.gmailAccountId, e.gmailMessageId, e.gmailThreadId, e.internetMessageId, e.inReplyTo, e.referencesList,
        e.direction, e.fromAddress, e.toAddress, e.ccAddress, e.subject, e.bodyText, e.bodyHtml, e.snippet, e.receivedAt, e.sentAt,
        e.linkedCaseId, e.linkedSupplierId, e.classification, e.attachments, e.createdAt
      );
    }

    // Seed Stock Movement
    const movements = [
      { id: "mov-1", organizationId: "org-1", itemId: "inv-1", movementType: "adjustment", quantity: 45, referenceType: "manual", referenceId: "Mở kho ban đầu", createdBy: "Lý Văn Khoa", createdAt: new Date().toISOString() }
    ];
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (id, organizationId, itemId, movementType, quantity, referenceType, referenceId, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of movements) {
      insertMovement.run(m.id, m.organizationId, m.itemId, m.movementType, m.quantity, m.referenceType, m.referenceId, m.createdBy, m.createdAt);
    }

    console.log("Mock data seeded successfully.");
  }
}

// ----------------------------------------------------
// ENTITY MAPPERS / PARSERS
// ----------------------------------------------------
export function parseSupplier(row: any): Supplier {
  if (!row) return row;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  };
}

export function parseProcurementCase(row: any): ProcurementCase {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : []
  };
}

export function parsePurchaseRequest(row: any): PurchaseRequest {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : []
  };
}

export function parseRfqCase(row: any): RfqCase {
  if (!row) return row;
  return {
    ...row,
    suppliers: row.suppliers ? JSON.parse(row.suppliers) : []
  };
}

export function parseQuote(row: any): Quote {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : []
  };
}

export function parseQuoteVersion(row: any): QuoteVersion {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : []
  };
}

export function parsePurchaseOrder(row: any): PurchaseOrder {
  if (!row) return row;
  return {
    ...row,
    items: row.items ? JSON.parse(row.items) : []
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
    attachments: row.attachments ? JSON.parse(row.attachments) : []
  };
}

// ----------------------------------------------------
// DB SYNCHRONIZATION PERSISTENCE ENGINE
// ----------------------------------------------------
export function saveToDb(table: string, entity: any) {
  const data = { ...entity };
  
  if (table === "suppliers" && data.tags) {
    data.tags = JSON.stringify(data.tags);
  } else if (table === "procurement_cases" && data.items) {
    data.items = JSON.stringify(data.items);
  } else if (table === "purchase_requests" && data.items) {
    data.items = JSON.stringify(data.items);
  } else if (table === "rfq_cases" && data.suppliers) {
    data.suppliers = JSON.stringify(data.suppliers);
  } else if (table === "quotes" && data.items) {
    data.items = JSON.stringify(data.items);
  } else if (table === "quote_versions" && data.items) {
    data.items = JSON.stringify(data.items);
  } else if (table === "purchase_orders" && data.items) {
    data.items = JSON.stringify(data.items);
  } else if (table === "email_messages") {
    data.referencesList = data.references ? JSON.stringify(data.references) : JSON.stringify([]);
    data.fromAddress = data.from;
    data.toAddress = data.to ? JSON.stringify(data.to) : JSON.stringify([]);
    data.ccAddress = data.cc ? JSON.stringify(data.cc) : JSON.stringify([]);
    data.attachments = data.attachments ? JSON.stringify(data.attachments) : JSON.stringify([]);
    
    delete data.references;
    delete data.from;
    delete data.to;
    delete data.cc;
  }
  
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => "?").join(", ");
  const columns = keys.join(", ");
  
  const sql = `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`;
  db.prepare(sql).run(...values);
}

export function persistDbState(dbState: any) {
  if (!dbState) return;
  const syncTransaction = db.transaction(() => {
    // Clear all tables to handle deletions perfectly
    db.prepare("DELETE FROM case_transitions").run();
    db.prepare("DELETE FROM ai_negotiation_logs").run();
    db.prepare("DELETE FROM rfq_email_drafts").run();
    db.prepare("DELETE FROM stock_movements").run();
    db.prepare("DELETE FROM quote_versions").run();
    db.prepare("DELETE FROM purchase_orders").run();
    db.prepare("DELETE FROM quotes").run();
    db.prepare("DELETE FROM rfq_cases").run();
    db.prepare("DELETE FROM procurement_cases").run();
    db.prepare("DELETE FROM purchase_requests").run();
    db.prepare("DELETE FROM inventory_items").run();
    db.prepare("DELETE FROM suppliers").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM email_messages").run();
    db.prepare("DELETE FROM email_accounts").run();
    db.prepare("DELETE FROM organizations").run();
    
    // Save everything
    if (dbState.organizations) {
      for (const org of dbState.organizations) saveToDb("organizations", org);
    }
    if (dbState.users) {
      for (const u of dbState.users) saveToDb("users", u);
    }
    if (dbState.suppliers) {
      for (const s of dbState.suppliers) saveToDb("suppliers", s);
    }
    if (dbState.inventory_items) {
      for (const i of dbState.inventory_items) saveToDb("inventory_items", i);
    }
    if (dbState.procurement_cases) {
      for (const c of dbState.procurement_cases) saveToDb("procurement_cases", c);
    }
    if (dbState.case_transitions) {
      for (const t of dbState.case_transitions) saveToDb("case_transitions", t);
    }
    if (dbState.purchase_requests) {
      for (const pr of dbState.purchase_requests) saveToDb("purchase_requests", pr);
    }
    if (dbState.rfq_cases) {
      for (const rfq of dbState.rfq_cases) saveToDb("rfq_cases", rfq);
    }
    if (dbState.quotes) {
      for (const q of dbState.quotes) saveToDb("quotes", q);
    }
    if (dbState.quote_versions) {
      for (const qv of dbState.quote_versions) saveToDb("quote_versions", qv);
    }
    if (dbState.purchase_orders) {
      for (const po of dbState.purchase_orders) saveToDb("purchase_orders", po);
    }
    if (dbState.email_accounts) {
      for (const ea of dbState.email_accounts) saveToDb("email_accounts", ea);
    }
    if (dbState.email_messages) {
      for (const em of dbState.email_messages) saveToDb("email_messages", em);
    }
    if (dbState.ai_negotiation_logs) {
      for (const log of dbState.ai_negotiation_logs) saveToDb("ai_negotiation_logs", log);
    }
    if (dbState.rfq_email_drafts) {
      for (const draft of dbState.rfq_email_drafts) saveToDb("rfq_email_drafts", draft);
    }
    if (dbState.stock_movements) {
      for (const m of dbState.stock_movements) saveToDb("stock_movements", m);
    }
  });
  
  syncTransaction();
}

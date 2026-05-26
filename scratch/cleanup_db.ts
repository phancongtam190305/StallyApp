import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve("stally.db"));

try {
  console.log("🧹 Starting database cleanup...");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Begin transaction
  const runCleanup = db.transaction(() => {
    // 1. Delete all case transitions not belonging to case-1 or case-2
    const transitionsDeleted = db.prepare("DELETE FROM case_transitions WHERE caseId NOT IN ('case-1', 'case-2')").run();
    console.log(`- Deleted ${transitionsDeleted.changes} case transitions.`);

    // 2. Delete all email messages not belonging to case-1 or case-2
    const emailsDeleted = db.prepare("DELETE FROM email_messages WHERE linkedCaseId NOT IN ('case-1', 'case-2') OR linkedCaseId IS NULL").run();
    console.log(`- Deleted ${emailsDeleted.changes} email messages.`);

    // 3. Delete AI negotiation logs
    const negLogsDeleted = db.prepare("DELETE FROM ai_negotiation_logs WHERE caseId NOT IN ('case-1', 'case-2')").run();
    console.log(`- Deleted ${negLogsDeleted.changes} AI negotiation logs.`);

    // 4. Delete RFQ email drafts
    const draftsDeleted = db.prepare("DELETE FROM rfq_email_drafts WHERE caseId NOT IN ('case-1', 'case-2')").run();
    console.log(`- Deleted ${draftsDeleted.changes} RFQ email drafts.`);

    // 5. Delete Stock movements not related to case-1 or case-2 POs
    const movementsDeleted = db.prepare("DELETE FROM stock_movements WHERE referenceId NOT IN ('po-2') OR referenceId IS NULL").run();
    console.log(`- Deleted ${movementsDeleted.changes} stock movements.`);

    // 6. Delete POs not belonging to case-1 or case-2
    const posDeleted = db.prepare("DELETE FROM purchase_orders WHERE caseId NOT IN ('case-1', 'case-2')").run();
    console.log(`- Deleted ${posDeleted.changes} purchase orders.`);

    // 7. Delete Quotes and Quote Versions not related to case-1 or case-2
    // Let's find valid RFQ cases first
    const rfqCases = db.prepare("SELECT id FROM rfq_cases WHERE purchaseRequestId IN (SELECT requestId FROM procurement_cases WHERE id IN ('case-1', 'case-2'))").all();
    const rfqIds = rfqCases.map((r: any) => `'${r.id}'`).join(",") || "''";

    const quoteVersionsDeleted = db.prepare(`DELETE FROM quote_versions WHERE quoteId NOT IN (SELECT id FROM quotes WHERE rfqCaseId IN (${rfqIds}))`).run();
    console.log(`- Deleted ${quoteVersionsDeleted.changes} quote versions.`);

    const quotesDeleted = db.prepare(`DELETE FROM quotes WHERE rfqCaseId NOT IN (${rfqIds})`).run();
    console.log(`- Deleted ${quotesDeleted.changes} quotes.`);

    // 8. Delete RFQ cases not belonging to case-1 or case-2
    const rfqsDeleted = db.prepare(`DELETE FROM rfq_cases WHERE purchaseRequestId NOT IN (SELECT requestId FROM procurement_cases WHERE id IN ('case-1', 'case-2'))`).run();
    console.log(`- Deleted ${rfqsDeleted.changes} RFQ cases.`);

    // 9. Delete Purchase requests not belonging to case-1 or case-2
    const prsDeleted = db.prepare(`DELETE FROM purchase_requests WHERE id NOT IN (SELECT requestId FROM procurement_cases WHERE id IN ('case-1', 'case-2') AND requestId IS NOT NULL)`).run();
    console.log(`- Deleted ${prsDeleted.changes} purchase requests.`);

    // 10. Delete Procurement cases not case-1 or case-2
    const casesDeleted = db.prepare("DELETE FROM procurement_cases WHERE id NOT IN ('case-1', 'case-2')").run();
    console.log(`- Deleted ${casesDeleted.changes} procurement cases.`);

    // 11. Reset inventory items to original clean stock levels
    db.prepare("UPDATE inventory_items SET quantityAvailable = 45.0, quantityOnOrder = 0.0 WHERE sku = 'SKU-ST25'").run();
    db.prepare("UPDATE inventory_items SET quantityAvailable = 12.0, quantityOnOrder = 10.0 WHERE sku = 'SKU-XL01'").run();
    db.prepare("UPDATE inventory_items SET quantityAvailable = 40.0, quantityOnOrder = 0.0 WHERE sku = 'SKU-TB02'").run();
    db.prepare("UPDATE inventory_items SET quantityAvailable = 8.0, quantityOnOrder = 0.0 WHERE sku = 'SKU-DA03'").run();
    db.prepare("UPDATE inventory_items SET quantityAvailable = 120.0, quantityOnOrder = 0.0 WHERE sku = 'SKU-ML04'").run();
    console.log("- Reset inventory items stock levels to standard seed values.");
  });

  runCleanup();
  console.log("🎉 Database cleanup successfully completed!");
} catch (e) {
  console.error("❌ Cleanup failed:", e);
} finally {
  db.close();
}

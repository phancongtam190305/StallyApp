import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("stally.db");
console.log("Opening SQLite Database at:", dbPath);
const db = new Database(dbPath);

try {
  console.log("\n--- PROCUREMENT CASES IN DB ---");
  const cases = db.prepare("SELECT id, title, status, purchaseOrderId FROM procurement_cases").all();
  cases.forEach(c => {
    console.log(`- Case ID: ${c.id}, Title: ${c.title}, Status: ${c.status}, PO ID: ${c.purchaseOrderId}`);
  });

  console.log("\n--- PURCHASE ORDERS IN DB ---");
  const pos = db.prepare("SELECT id, caseId, status, totalAmount FROM purchase_orders").all();
  pos.forEach(p => {
    console.log(`- PO ID: ${p.id}, Case ID: ${p.caseId}, Status: ${p.status}, Total Amount: ${p.totalAmount}`);
  });

  console.log("\n--- TIMELINE LOGS IN DB ---");
  const trans = db.prepare("SELECT caseId, fromStatus, toStatus, actorRole, reason, createdAt FROM case_transitions ORDER BY createdAt DESC LIMIT 10").all();
  trans.forEach(t => {
    console.log(`- Case ID: ${t.caseId}, ${t.fromStatus} -> ${t.toStatus} (${t.actorRole}): ${t.reason}`);
  });
} catch (e) {
  console.error("Error reading database:", e);
}
db.close();

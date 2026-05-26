import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve("stally.db"));

try {
  console.log("\n--- CASES ---");
  const cases = db.prepare("SELECT id, title, status, purchaseOrderId FROM procurement_cases").all();
  cases.forEach(c => {
    console.log(`- Case ID: ${c.id}, Title: ${c.title}, Status: ${c.status}, PO ID: ${c.purchaseOrderId}`);
  });

  console.log("\n--- PURCHASE ORDERS ---");
  const pos = db.prepare("SELECT id, caseId, status, items FROM purchase_orders").all();
  pos.forEach(p => {
    console.log(`- PO ID: ${p.id}, Case ID: ${p.caseId}, Status: ${p.status}`);
    console.log(`  Items:`, JSON.parse(p.items));
  });

  console.log("\n--- INVENTORY ITEMS ---");
  const inv = db.prepare("SELECT id, sku, name, quantityAvailable, quantityOnOrder FROM inventory_items").all();
  inv.forEach(i => {
    console.log(`- Item: ${i.name} (${i.sku}), Available: ${i.quantityAvailable}, OnOrder: ${i.quantityOnOrder}`);
  });
} catch (e) {
  console.error("Error:", e);
}
db.close();

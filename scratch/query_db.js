import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("stally.db");
console.log("Opening SQLite Database at:", dbPath);
const db = new Database(dbPath);

try {
  console.log("\n--- PROCUREMENT CASES IN DB ---");
  const cases = db.prepare("SELECT * FROM state_store").all();
  console.log(`Found ${cases.length} records in state_store.`);
  
  if (cases.length > 0) {
    // Parse the state JSON
    const state = JSON.parse(cases[0].state_json);
    console.log("\nProcurement Cases in parsed JSON:");
    state.procurement_cases.forEach(c => {
      console.log(`- Case ID: ${c.id}, Status: ${c.status}, PO ID: ${c.purchaseOrderId}`);
    });

    console.log("\nPurchase Orders in parsed JSON:");
    state.purchase_orders.forEach(p => {
      console.log(`- PO ID: ${p.id}, Case ID: ${p.caseId}, Status: ${p.status}, Total Amount: ${p.totalAmount}`);
    });
  }
} catch (e) {
  console.error("Error reading database:", e);
}
db.close();

import { db } from "../src/backend/db.ts";

async function main() {
  try {
    const res = await db.query("SELECT * FROM rfq_cases");
    console.log("rfq_cases rows:", res.rows);
    
    const cases = await db.query("SELECT id, title, status FROM procurement_cases");
    console.log("procurement_cases rows:", cases.rows);
    
    const prs = await db.query("SELECT id, title, status FROM purchase_requests");
    console.log("purchase_requests rows:", prs.rows);
  } catch (err) {
    console.error("Database query failed:", err);
  } finally {
    await db.end();
  }
}

main();

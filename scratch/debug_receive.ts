import { transitionCaseStatus, dbState, loadDbState } from "../src/backend/api_v1.ts";

async function debug() {
  try {
    console.log("Loading DB State...");
    await loadDbState();
    
    console.log("Procurement Cases currently in database:");
    dbState.procurement_cases.forEach(c => {
      console.log(`- Case ID: ${c.id}, Status: ${c.status}, PO ID: ${c.purchaseOrderId}`);
    });

    console.log("\nPurchase Orders in database:");
    dbState.purchase_orders.forEach(p => {
      console.log(`- PO ID: ${p.id}, Case ID: ${p.caseId}, Status: ${p.status}, Total Amount: ${p.totalAmount}`);
    });

    // Find a case that is in po_sent or receiving status
    const targetCase = dbState.procurement_cases.find(c => ["po_sent", "receiving", "exception"].includes(c.status));
    if (!targetCase) {
      console.log("\nNo cases found in po_sent, receiving, or exception status. Finding any approved or po_draft case...");
      const draftCase = dbState.procurement_cases.find(c => ["approved", "po_draft"].includes(c.status));
      if (draftCase) {
        console.log(`Found case in ${draftCase.status} status. ID: ${draftCase.id}`);
      } else {
        console.log("No cases found in po_draft or approved status either.");
      }
      return;
    }

    console.log(`\nSimulating transition for target Case ID: ${targetCase.id} from status: ${targetCase.status} to closed...`);
    try {
      const res = transitionCaseStatus({
        caseId: targetCase.id,
        toStatus: "closed",
        actorId: "u-4",
        actorRole: "warehouse",
        reason: "Test receive close",
        orgId: "org-1"
      });
      console.log("Success! New status:", res.status);
    } catch (e: any) {
      console.error("FAIL! Error thrown during transition:", e.message);
    }
  } catch (err: any) {
    console.error("Error in debug:", err);
  }
}

debug();

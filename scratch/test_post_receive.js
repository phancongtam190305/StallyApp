import fetch from "node-fetch";

async function testReceive() {
  try {
    console.log("Fetching state from local running server...");
    const stateRes = await fetch("http://localhost:3000/api/state", {
      headers: { "X-Organization-Id": "org-1" }
    });
    if (!stateRes.ok) {
      console.error("Failed to fetch state. Server status:", stateRes.status);
      return;
    }
    const state = await stateRes.json();
    
    // Find PO-2 which is a seeded PO or find another PO
    const pos = state.purchaseOrders || [];
    console.log(`Found ${pos.length} Purchase Orders in memory:`);
    pos.forEach(p => {
      console.log(`- PO ID: ${p.id}, Case ID: ${p.caseId}, Status: ${p.status}`);
    });

    const activePo = pos.find(p => p.status === "confirmed" || p.status === "issued" || p.status === "shipping");
    if (!activePo) {
      console.log("No active PO found to receive. Testing on the first PO instead...");
    }
    
    const targetPo = activePo || pos[0];
    if (!targetPo) {
      console.log("No POs found at all.");
      return;
    }

    console.log(`\nTesting receive on PO ID: ${targetPo.id} (Case ID: ${targetPo.caseId})`);
    
    const itemsPayload = targetPo.items.map(it => ({
      name: it.name,
      quantityReceived: it.quantity // fully received
    }));

    const receiveRes = await fetch(`http://localhost:3000/api/v1/purchase-orders/${targetPo.id}/receive`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Organization-Id": "org-1"
      },
      body: JSON.stringify({
        items: itemsPayload,
        receivedAt: new Date().toISOString()
      })
    });

    console.log("Response Status:", receiveRes.status);
    const body = await receiveRes.text();
    console.log("Response Body:", body);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

// Wait 1.5 seconds for dev server to start
setTimeout(testReceive, 1500);

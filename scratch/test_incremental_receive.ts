async function run() {
  const host = "http://localhost:3000";
  console.log("Fetching current state...");
  const res = await fetch(`${host}/api/state`, {
    headers: { "X-Organization-Id": "org-1" }
  });
  if (!res.ok) {
    console.error("Failed to fetch state from server.");
    return;
  }
  const state: any = await res.json();
  const casePOs = state.purchaseOrders.filter((p: any) => p.caseId === "case-1779610521273"); // Or find the first confirmed PO
  const po = casePOs[0] || state.purchaseOrders.find((p: any) => p.status === "confirmed");
  
  if (!po) {
    console.log("No confirmed purchase order found to test.");
    return;
  }

  console.log(`\nFound PO: ${po.id} for Case: ${po.caseId}. Status: ${po.status}`);
  console.log("Original items in PO:", po.items);

  const testItem = po.items[0];
  console.log(`\n1. Simulating partial receive of ${testItem.name} (Qty: 7 instead of ${testItem.quantity})...`);

  // Build the payload
  const payload = po.items.map((it: any, idx: number) => {
    return {
      name: it.name,
      quantityReceived: idx === 0 ? 7 : 0
    };
  });

  console.log("Payload:", payload);

  const receiveRes = await fetch(`${host}/api/v1/purchase-orders/${po.id}/receive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Organization-Id": "org-1"
    },
    body: JSON.stringify({
      items: payload,
      receivedAt: new Date().toISOString()
    })
  });

  console.log("Response status:", receiveRes.status);
  const receiveData: any = await receiveRes.json();
  console.log("Response body:", receiveData);

  // Fetch updated PO from database directly to verify quantityReceived is saved
  console.log("\nQuerying updated state from server...");
  const stateRes2 = await fetch(`${host}/api/state`, {
    headers: { "X-Organization-Id": "org-1" }
  });
  const state2: any = await stateRes2.json();
  const updatedPo = state2.purchaseOrders.find((p: any) => p.id === po.id);
  console.log("Updated PO items after first receive:", updatedPo.items);
}

run().catch(console.error);

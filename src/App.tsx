import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import StatsDashboard from "./components/StatsDashboard";
import PurchaseRequestsList from "./components/PurchaseRequestsList";
import RfqComparison from "./components/RfqComparison";
import InventoryManager from "./components/InventoryManager";
import ChatbotPanel from "./components/ChatbotPanel";
import SupplierManagement from "./components/SupplierManagement";
import LoginScreen from "./components/LoginScreen";
import OnboardingTutorial from "./components/OnboardingTutorial";

import { 
  PurchaseRequest, 
  RfqCase, 
  Quote, 
  InventoryItem, 
  StockMovement, 
  Supplier, 
  UserRole,
  PriorityLevel,
  PurchaseRequestItem
} from "./types";

import { 
  ShieldAlert, 
  Sparkles, 
  GitMerge, 
  Compass, 
  SlidersHorizontal,
  Wifi,
  Database,
  RefreshCw
} from "lucide-react";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentRole, setCurrentRole] = useState<UserRole>("procurement");

  // Multi-tenant logical isolation state
  const orgId = "org-1"; // Simulated logical multi-tenant organization

  // Sourced states
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRfqs] = useState<RfqCase[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  //Sourcing flow selection helpers
  const [selectedPr, setSelectedPr] = useState<PurchaseRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  // Sync state from server on load
  const syncStateFromServer = async () => {
    try {
      const res = await fetch("/api/state", {
        headers: { "X-Organization-Id": orgId }
      });
      if (!res.ok) throw new Error("Không thể đồng bộ với server.");
      const state = await res.json();
      
      setPurchaseRequests(state.purchaseRequests);
      setRfqs(state.rfqs);
      setQuotes(state.quotes);
      setInventory(state.inventory);
      setStockMovements(state.stockMovements);
      setSuppliers(state.suppliers || []);
      
      setLoading(false);
    } catch (err) {
      console.error("Fetch state failed", err);
      setErrorText("Lỗi máy chủ: Chưa bắt đầu server node.");
      setLoading(false);
    }
  };

  useEffect(() => {
    syncStateFromServer();
  }, [orgId]);

  // Handler: Create PR (EPIC A)
  const handleCreatePr = async (prData: { title: string; priority: PriorityLevel; requiredDate: string; items: PurchaseRequestItem[]; status?: string }) => {
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          ...prData,
          requesterId: currentRole === "requester" ? "u-2" : "u-1",
          requesterName: currentRole === "requester" ? "Trần Văn Bình (Bếp Trưởng)" : "Phan Công Tâm (Sourcing Staff)",
          departmentName: currentRole === "requester" ? "Bộ phận Bếp" : "Ban quản trị",
          source: "web"
        })
      });

      if (res.ok) {
        await syncStateFromServer();
      }
    } catch (e) {
      console.error("Create PR failed", e);
    }
  };

  // Handler: Auto-PR trigger from Inventory vơi (EPIC I)
  const handleCreatePrFromStock = async (stockItem: InventoryItem) => {
    // Fill the exact quantity needed to reach minStockLevel
    const targetQty = Math.max(1, stockItem.minStockLevel - stockItem.quantityAvailable);
    const notes = `Tự động phát hiện vơi thâm hụt (Tồn: ${stockItem.quantityAvailable} / Ngưỡng: ${stockItem.minStockLevel} ${stockItem.unit})`;
    
    await handleCreatePr({
      title: `Bổ sung tồn kho khẩn cấp: ${stockItem.name}`,
      priority: "high",
      status: "draft", // Ensure the PR status is 'draft' as requested
      requiredDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [
        { name: stockItem.name, quantity: targetQty, unit: stockItem.unit, notes }
      ]
    });
  };

  // Handler: Sourcing launch RFQ (EPIC C)
  const handleCreateRfq = async (prId: string, supplierIds: string[]) => {
    const selectedSupplierDetails = suppliers.filter(s => supplierIds.includes(s.id));
    
    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          purchaseRequestId: prId,
          suppliers: selectedSupplierDetails.map(s => ({
            supplierId: s.id,
            name: s.name,
            email: s.email
          }))
        })
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          ok: false,
          message: payload?.error?.message || payload?.error || "Không gửi được email RFQ.",
          details: payload?.error?.details,
        };
      }

      await syncStateFromServer();
      // Keep active selection linked
      const updatedPr = purchaseRequests.find(p => p.id === prId);
      if (updatedPr) {
        setSelectedPr({ ...updatedPr, status: "submitted" });
      }

      return {
        ok: true,
        message: `Đã gửi email RFQ thật tới ${payload?.email?.sentCount || selectedSupplierDetails.length} nhà cung cấp.`,
      };
    } catch (e) {
      console.error("Create RFQ failed", e);
      return {
        ok: false,
        message: "Không kết nối được backend để gửi RFQ.",
      };
    }
  };

  // Handler: Simulate Supplier Inbound Quote Webhook (EPIC D & E)
  const handleSimulateInboundEmail = async (rfqCaseId: string, supplierId: string, bodyText: string, filename: string) => {
    try {
      const res = await fetch("/api/webhooks/inbound-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          rfqCaseId,
          supplierId,
          bodyText,
          fileName: filename
        })
      });

      if (res.ok) {
        await syncStateFromServer();
      }
    } catch (e) {
      console.error("Webhook triggers failed", e);
    }
  };

  // Handler: Approve Quote (EPIC G & H)
  const handleApproveQuote = async (rfqId: string, quoteId: string) => {
    try {
      const res = await fetch(`/api/rfq/${rfqId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          selectedQuoteId: quoteId,
          approvedBy: "Nguyễn Thị Mai (Giám Đốc)"
        })
      });

      if (res.ok) {
        await syncStateFromServer();
      }
    } catch (e) {
      console.error("PO approval dispatch failed", e);
    }
  };

  // Handler: Goods receipt in stock (EPIC I)
  const handleReceiveGoods = async (itemId: string, qty: number, sourcePo: string) => {
    try {
      const res = await fetch("/api/inventory/receive-goods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          itemId,
          quantityReceived: qty,
          referenceId: sourcePo,
          createdBy: "Lý Văn Khoa (Thủ Kho)"
        })
      });

      if (res.ok) {
        await syncStateFromServer();
      }
    } catch (e) {
      console.error("Goods receipt failed", e);
    }
  };

  // Handler: Manual Stock Adjustment (EPIC I / Out-stock)
  const handleAdjustStock = async (itemId: string, qty: number, movementType: "in" | "out" | "adjustment", notes: string) => {
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          itemId,
          adjustmentQty: qty,
          movementType,
          referenceId: notes,
          createdBy: "Lý Văn Khoa (Thủ Kho)"
        })
      });

      if (res.ok) {
        await syncStateFromServer();
      }
    } catch (e) {
      console.error("Adjustment failed", e);
    }
  };

  const handleLogin = (role: UserRole, withTutorial: boolean) => {
    setCurrentRole(role);
    setIsLoggedIn(true);
    setShowTutorial(withTutorial);
    if (role === "warehouse") {
      setActiveTab("inventory");
    } else {
      setActiveTab("overview");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowTutorial(false);
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex font-sans text-slate-800">
      
      {showTutorial && (
        <OnboardingTutorial 
          role={currentRole}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onComplete={() => setShowTutorial(false)}
        />
      )}
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentRole={currentRole} 
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-72 p-8 text-slate-800 min-h-screen">
        
        {/* Top Header navbar bar - Sleek & Beautiful */}
        <header className="flex justify-between items-center pb-5 mb-6 border-b border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-display">Bảng điều khiển</span>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="text-base font-extrabold text-[#00535b] font-display tracking-tight">Hệ thống Thu mua Stally</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="text-xs text-[#00535b] font-bold bg-[#e0f2f1]/80 px-2 py-0.5 rounded border border-[#b2dfdb] font-mono">
                Mã chi nhánh: org-1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#e0f2f1] border border-[#b2dfdb] rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              <span className="text-slate-600 font-medium">Nhân sự hiện tại:</span>
              <span className="text-[#00535b] font-bold">{
                currentRole === "requester" ? "Bếp Trưởng Bình " :
                currentRole === "procurement" ? "Thu Mua Tâm " :
                currentRole === "manager" ? "Giám Đốc Mai " :
                "Thủ Kho Khoa "
              }</span>
            </div>
          </div>
        </header>

        {errorText && (
          <div className="mb-6 bg-red-50 border border-red-200 text-rose-800 p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold">Lỗi kết nối đồng bộ cơ sở dữ liệu</p>
              <p className="opacity-95">{errorText}. Vui lòng thử khởi động lại máy chủ phát triển.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-xs text-slate-400 space-y-3">
            <RefreshCw className="w-5 h-5 text-[#006d77] animate-spin" />
            <span className="font-medium tracking-wide">Đang đồng bộ hồ sơ nhà hàng...</span>
          </div>
        ) : (
          <div className="transition-all duration-300">
            {activeTab === "overview" && (
              <StatsDashboard 
                purchaseRequests={purchaseRequests}
                rfqs={rfqs}
                quotes={quotes}
                inventory={inventory}
                onCreatePrFromStock={handleCreatePrFromStock}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "pr" && (
              <PurchaseRequestsList 
                purchaseRequests={purchaseRequests}
                currentRole={currentRole}
                onCreatePr={handleCreatePr}
                onSelectPrForSourcing={(pr) => {
                  setSelectedPr(pr);
                }}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "rfq" && (
              <RfqComparison 
                selectedPr={selectedPr}
                rfqs={rfqs}
                quotes={quotes}
                suppliers={suppliers}
                currentRole={currentRole}
                onCreateRfq={handleCreateRfq}
                onApproveQuote={handleApproveQuote}
                onSimulateInboundEmail={handleSimulateInboundEmail}
              />
            )}

            {activeTab === "suppliers" && (
              <SupplierManagement 
                currentRole={currentRole}
                orgId={orgId}
                onSuppliersChanged={syncStateFromServer}
              />
            )}

            {activeTab === "inventory" && (
              <InventoryManager 
                inventory={inventory}
                stockMovements={stockMovements}
                currentRole={currentRole}
                onReceiveGoods={handleReceiveGoods}
                onAdjustStock={handleAdjustStock}
                onCreatePrFromStock={handleCreatePrFromStock}
              />
            )}

            {activeTab === "chatbot" && (
              <ChatbotPanel 
                onCreatePr={handleCreatePr}
                setActiveTab={setActiveTab}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

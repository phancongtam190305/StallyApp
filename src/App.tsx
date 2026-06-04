import React, { useState, useEffect } from "react";
import { apiUrl } from "./config";
import Sidebar from "./components/Sidebar";
import StatsDashboard from "./components/StatsDashboard";
import PurchaseRequestsList from "./components/PurchaseRequestsList";
import RfqComparison from "./components/RfqComparison";
import InventoryManager from "./components/InventoryManager";
import ChatbotPanel from "./components/ChatbotPanel";
import SupplierManagement from "./components/SupplierManagement";
import LoginScreen from "./components/LoginScreen";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { ToastProvider, useToast } from "./context/ToastContext";

// Import new cases pipeline components
import ProcurementDashboard from "./components/ProcurementDashboard";
import CaseDetailTimeline from "./components/CaseDetailTimeline";
import RequesterDashboard from "./components/RequesterDashboard";
import WarehouseDashboard from "./components/WarehouseDashboard";
import ManagerDashboard from "./components/ManagerDashboard";
import FloatingChatbot from "./components/FloatingChatbot";

import { 
  PurchaseRequest, 
  RfqCase, 
  Quote, 
  InventoryItem, 
  StockMovement, 
  Supplier, 
  UserRole,
  PriorityLevel,
  PurchaseRequestItem,
  User
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

export function AppContent() {
  const { showToast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentRole, setCurrentRole] = useState<UserRole>("procurement");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Multi-tenant logical isolation state
  const orgId = "org-1"; // Simulated logical multi-tenant organization

  // Cases dashboard state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Sourced states
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRfqs] = useState<RfqCase[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  //Sourcing flow selection helpers
  const [selectedPr, setSelectedPr] = useState<PurchaseRequest | null>(null);
  const [sseRefreshTrigger, setSseRefreshTrigger] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  // Sync state from server on load
  const syncStateFromServer = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/state"), {
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
      
      setErrorText("");
      setLoading(false);
    } catch (err) {
      console.error("Fetch state failed", err);
      setErrorText(err instanceof Error ? err.message : "Không thể kết nối server backend.");
      setLoading(false);
    }
  };

  useEffect(() => {
    syncStateFromServer();
  }, [orgId]);

  // Realtime Event Stream listener (SSE Client)
  useEffect(() => {
    if (!isLoggedIn) return;

    console.log("🔌 Connecting to Realtime SSE Stream...");
    const eventSource = new EventSource(apiUrl("/api/v1/events/stream"));

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Realtime event received:", data);
        
        if (data.type === "email.received") {
          showToast("📬 Nhận email phản hồi mới từ nhà cung cấp!", "info");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "quote.extracted") {
          showToast("✨ AI đã trích xuất thành công báo giá mới!", "success");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "case.updated") {
          const caseCode = data.caseId ? data.caseId.split('-')[1]?.toUpperCase() : "";
          showToast(`🔄 Hồ sơ thầu #${caseCode || ""} đã chuyển sang trạng thái mới!`, "info");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "supplier.discovery_completed") {
          showToast("📬 AI đã quét xong nhà cung cấp cho mặt hàng: " + (data.payload?.query || "") + "!", "success");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.error("Failed to parse realtime event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection error:", err);
    };

    return () => {
      console.log("🔌 Disconnecting from SSE Stream...");
      eventSource.close();
    };
  }, [isLoggedIn, orgId]);

  // Handler: Create PR (EPIC A)
  const handleCreatePr = async (prData: { title: string; priority: PriorityLevel; requiredDate: string; items: PurchaseRequestItem[]; status?: string }) => {
    try {
      const res = await fetch(apiUrl("/api/purchase-requests"), {
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
    const targetQty = Math.max(1, stockItem.minStockLevel - stockItem.quantityAvailable);
    const notes = `Tự động phát hiện vơi thâm hụt (Tồn: ${stockItem.quantityAvailable} / Ngưỡng: ${stockItem.minStockLevel} ${stockItem.unit})`;
    
    await handleCreatePr({
      title: `Bổ sung tồn kho khẩn cấp: ${stockItem.name}`,
      priority: "high",
      status: "draft",
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
      const res = await fetch(apiUrl("/api/rfq"), {
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
      const res = await fetch(apiUrl("/api/webhooks/inbound-email"), {
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
      // Find the corresponding case and request/approve PO draft via modern endpoints
      const casesRes = await fetch(apiUrl("/api/v1/cases"), {
        headers: { "X-Organization-Id": orgId }
      });
      if (casesRes.ok) {
        const casesData = await casesRes.json();
        const cases = casesData.data || [];
        const relatedCase = cases.find((c: any) => c.currentRfqId === rfqId || c.requestId === rfqs.find(r => r.id === rfqId)?.purchaseRequestId);
        if (relatedCase) {
          const caseId = relatedCase.id;
          
          // Submit approval request
          await fetch(apiUrl(`/api/v1/cases/${caseId}/approval/request`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Organization-Id": orgId
            },
            body: JSON.stringify({
              selectedQuoteId: quoteId,
              comment: "Trình duyệt tự động từ màn hình đối chiếu RFQ"
            })
          });

          // Approve the request
          await fetch(apiUrl(`/api/v1/approval-requests/${caseId}/approve`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Organization-Id": orgId
            },
            body: JSON.stringify({
              comment: "Phê duyệt tự động từ màn hình đối chiếu RFQ",
              selectedQuoteId: quoteId
            })
          });

          // Create PO Draft
          await fetch(apiUrl(`/api/v1/cases/${caseId}/po-draft`), {
            method: "POST",
            headers: { "X-Organization-Id": orgId }
          });
        }
      }

      const res = await fetch(apiUrl(`/api/rfq/${rfqId}/approve`), {
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
      // Find the inventory item name
      const itemName = inventory.find(i => i.id === itemId)?.name || "";

      const res = await fetch(apiUrl(`/api/v1/purchase-orders/${sourcePo}/receive`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organization-Id": orgId
        },
        body: JSON.stringify({
          items: [{ name: itemName, quantityReceived: qty }],
          receivedAt: new Date().toISOString()
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
      const res = await fetch(apiUrl("/api/inventory/adjust"), {
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

  const handleLogin = (role: UserRole, withTutorial: boolean, user?: User) => {
    setCurrentRole(role);
    setCurrentUser(user || null);
    setIsLoggedIn(true);
    setShowTutorial(withTutorial);
    setSelectedCaseId(null);
    if (role === "warehouse") {
      setActiveTab("inventory");
    } else {
      setActiveTab("overview");
    }
  };

  const handleLogout = () => {
    fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setIsLoggedIn(false);
    setCurrentUser(null);
    setShowTutorial(false);
    setSelectedCaseId(null);
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#EFF8F7] flex font-sans text-primary-dark">
      
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

      {/* Main Content Area - Single Screen Viewport Layout */}
      <main className="flex-1 ml-72 h-screen flex flex-col overflow-hidden p-8 text-primary-dark">
        
        {/* Top Header navbar bar - Styled as a playful pill-shaped board */}
        <header className="flex justify-between items-center bg-[#FFF8E7] border-3 border-primary-dark p-4 px-6 rounded-full shadow-card mb-6 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 font-display">Bảng điều khiển</span>
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="text-sm font-black text-primary-dark font-display tracking-wide">Hệ thống Thu mua Stally</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-dark/30" />
              <span className="text-[10px] text-primary-dark font-extrabold bg-[#E8F6F5] border border-primary-dark/20 px-2.5 py-0.5 rounded-full font-mono">
                Mã chi nhánh: org-1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-accent-light via-accent-gold to-accent-dark border-2 border-primary-dark rounded-full text-xs font-black text-primary-dark shadow-accent-glow hover:scale-[1.02] active:scale-[0.98] transition-all">
              <span className="w-2 h-2 rounded-full bg-[#27AE60] animate-pulse" />
              <span>Nhân sự hiện tại:</span>
              <span className="font-extrabold">
                {currentUser?.name || (
                  currentRole === "requester" ? "Bếp Trưởng Bình" :
                  currentRole === "procurement" ? "Thu Mua Tâm" :
                  currentRole === "manager" ? "Giám Đốc Mai" :
                  currentRole === "admin" ? "Quản trị viên" :
                  "Thủ Kho Khoa"
                )}
              </span>
            </div>
          </div>
        </header>

        {errorText && (
          <div className="mb-6 bg-[#FF8A6A]/10 border-3 border-[#EF6C4A] text-[#EF6C4A] p-4 rounded-[24px] text-xs flex items-center gap-2.5 shadow-coral-glow animate-fade-slide-up shrink-0">
            <ShieldAlert className="w-5 h-5 text-coral shrink-0" />
            <div>
              <p className="font-black">Lỗi kết nối đồng bộ cơ sở dữ liệu</p>
              <p className="opacity-95 font-bold">{errorText}. Kiểm tra server rồi bấm thử lại.</p>
              <button
                onClick={syncStateFromServer}
                className="mt-2 px-3 py-1.5 bg-white border border-[#EF6C4A]/30 rounded-lg text-[11px] font-black text-[#EF6C4A] hover:bg-[#FF8A6A]/10"
              >
                Thử đồng bộ lại
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-xs text-slate-400 space-y-3">
            <RefreshCw className="w-5 h-5 text-[#006d77] animate-spin" />
            <span className="font-medium tracking-wide">Đang đồng bộ hồ sơ nhà hàng...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-300">
            {/* Overview Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "overview" ? "block" : "none" }}
            >
              {currentRole === "requester" ? (
                <RequesterDashboard
                  inventory={inventory}
                  purchaseRequests={purchaseRequests}
                  onCreatePr={handleCreatePr}
                  currentRole={currentRole}
                  setActiveTab={setActiveTab}
                />
              ) : currentRole === "warehouse" ? (
                <WarehouseDashboard
                  inventory={inventory}
                  stockMovements={stockMovements}
                  currentRole={currentRole}
                  onReceiveGoods={handleReceiveGoods}
                  onAdjustStock={handleAdjustStock}
                  onCreatePrFromStock={handleCreatePrFromStock}
                  setActiveTab={setActiveTab}
                />
              ) : currentRole === "manager" ? (
                <ManagerDashboard
                  purchaseRequests={purchaseRequests}
                  rfqs={rfqs}
                  quotes={quotes}
                  suppliers={suppliers}
                  onApproveQuote={handleApproveQuote}
                  setActiveTab={setActiveTab}
                />
              ) : (
                <StatsDashboard 
                  purchaseRequests={purchaseRequests}
                  rfqs={rfqs}
                  quotes={quotes}
                  inventory={inventory}
                  onCreatePrFromStock={handleCreatePrFromStock}
                  setActiveTab={setActiveTab}
                />
              )}
            </div>

            {/* Cases Tab */}
            <div 
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
              style={{ display: activeTab === "cases" ? "flex" : "none" }}
            >
              {selectedCaseId ? (
                <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
                  <CaseDetailTimeline
                    caseId={selectedCaseId}
                    onBackToList={() => setSelectedCaseId(null)}
                    currentRole={currentRole}
                    orgId={orgId}
                    onStateChanged={syncStateFromServer}
                    refreshTrigger={sseRefreshTrigger}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <ProcurementDashboard
                    currentRole={currentRole}
                    orgId={orgId}
                    onSelectCase={(caseId) => setSelectedCaseId(caseId)}
                    isActive={activeTab === "cases"}
                  />
                </div>
              )}
            </div>

            {/* PR Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "pr" ? "block" : "none" }}
            >
              <PurchaseRequestsList 
                purchaseRequests={purchaseRequests}
                currentRole={currentRole}
                onCreatePr={handleCreatePr}
                onSelectPrForSourcing={(pr) => {
                  setSelectedPr(pr);
                }}
                setActiveTab={setActiveTab}
              />
            </div>

            {/* RFQ Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "rfq" ? "block" : "none" }}
            >
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
            </div>

            {/* Suppliers Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "suppliers" ? "block" : "none" }}
            >
              <SupplierManagement 
                currentRole={currentRole}
                orgId={orgId}
                onSuppliersChanged={syncStateFromServer}
                isActive={activeTab === "suppliers"}
              />
            </div>

            {/* Inventory Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "inventory" ? "block" : "none" }}
            >
              <InventoryManager 
                inventory={inventory}
                stockMovements={stockMovements}
                currentRole={currentRole}
                onReceiveGoods={handleReceiveGoods}
                onAdjustStock={handleAdjustStock}
                onCreatePrFromStock={handleCreatePrFromStock}
              />
            </div>

            {/* Chatbot Tab */}
            <div 
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6"
              style={{ display: activeTab === "chatbot" ? "block" : "none" }}
            >
              <ChatbotPanel 
                onCreatePr={handleCreatePr}
                setActiveTab={setActiveTab}
              />
            </div>
          </div>
        )}
      </main>

      {/* Floating AI Chatbot Bubble */}
      <FloatingChatbot
        currentRole={currentRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onCreatePr={handleCreatePr}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

import React, { useState, useEffect } from "react";
import { apiUrl } from "./config";
import Sidebar from "./components/Sidebar";
import PurchaseRequestsList from "./components/PurchaseRequestsList";
import RfqComparison from "./components/RfqComparison";
import InventoryManager from "./components/InventoryManager";
import ChatbotPanel from "./components/ChatbotPanel";
import SupplierManagement from "./components/SupplierManagement";
import LoginScreen from "./components/LoginScreen";
import { createTranslator, defaultLocale, Locale } from "./i18n";
import { ToastProvider, useToast } from "./context/ToastContext";

// Import new cases pipeline components
import ProcurementDashboard from "./components/ProcurementDashboard";
import CaseDetailTimeline from "./components/CaseDetailTimeline";
import FloatingChatbot from "./components/FloatingChatbot";
import { buildDashboardMetrics, DashboardTask } from "./dashboardMetrics";
import OperatorDashboard from "./components/dashboard/OperatorDashboard";
import ExecutiveDashboard from "./components/dashboard/ExecutiveDashboard";

import {
  PurchaseRequest,
  RfqCase,
  Quote,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  UserRole,
  PriorityLevel,
  PurchaseRequestItem,
  User,
  ProcurementCase
} from "./types";

import {
  ShieldAlert,
  Sparkles,
  GitMerge,
  Compass,
  SlidersHorizontal,
  Wifi,
  Database,
  RefreshCw,
  Search,
  Plus,
  Bell,
  Settings
} from "lucide-react";

export function AppContent() {
  const { showToast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentRole, setCurrentRole] = useState<UserRole>("procurement");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [dashboardView, setDashboardView] = useState<"operator" | "executive">("operator");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const t = createTranslator(locale);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);

  // Multi-tenant logical isolation state
  const orgId = "org-1"; // Simulated logical multi-tenant organization

  // Cases dashboard state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseCreateRequestToken, setCaseCreateRequestToken] = useState(0);

  // Sourced states
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRfqs] = useState<RfqCase[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cases, setCases] = useState<ProcurementCase[]>([]);

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
      if (!res.ok) throw new Error(t("errConnectionSync"));
      const state = await res.json();

      setPurchaseRequests(state.purchaseRequests);
      setRfqs(state.rfqs);
      setQuotes(state.quotes);
      setInventory(state.inventory);
      setStockMovements(state.stockMovements);
      setPurchaseOrders(state.purchaseOrders || []);
      setSuppliers(state.suppliers || []);
      setCases(state.cases || []);

      setErrorText("");
      setLoading(false);
    } catch (err) {
      console.error("Fetch state failed", err);
      setErrorText(err instanceof Error ? err.message : t("errConnectionBackend"));
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
          showToast(t("notifNewEmail"), "info");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "quote.extracted") {
          showToast(t("notifQuoteExtracted"), "success");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "negotiation.updated") {
          showToast(t("notifNegotiationAgreed").replace("{name}", data.payload?.supplierName || ""), "success");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "case.updated") {
          const caseCode = data.caseId ? data.caseId.split('-')[1]?.toUpperCase() : "";
          showToast(t("notifCaseUpdated").replace("{code}", caseCode || ""), "info");
          syncStateFromServer();
          setSseRefreshTrigger(prev => prev + 1);
        } else if (data.type === "supplier.discovery_completed") {
          showToast(t("notifSupplierDiscovered").replace("{query}", data.payload?.query || ""), "success");
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
          requesterName: currentRole === "requester" ? `Trần Văn Bình (${t("roleRequester")})` : `Phan Công Tâm (${t("roleProcurement")})`,
          departmentName: currentRole === "requester" ? t("deptKitchen") : t("deptProcurement"),
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
    const notes = locale === "en"
      ? `Auto-detected shrinkage (Stock: ${stockItem.quantityAvailable} / Min: ${stockItem.minStockLevel} ${stockItem.unit})`
      : `Tự động phát hiện vơi thâm hụt (Tồn: ${stockItem.quantityAvailable} / Ngưỡng: ${stockItem.minStockLevel} ${stockItem.unit})`;

    await handleCreatePr({
      title: locale === "en" ? `Urgent restock: ${stockItem.name}` : `Bổ sung tồn kho khẩn cấp: ${stockItem.name}`,
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
  const handleReceiveGoods = async (itemId: string, qty: number, sourcePo: string, itemNameOverride?: string) => {
    try {
      // Find the inventory item name
      const itemName = itemNameOverride || inventory.find(i => i.id === itemId)?.name || "";

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
    setShowTutorial(false);
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

  const handlePriorityTaskNavigate = (task: DashboardTask) => {
    if (task.targetCaseId) {
      setSelectedCaseId(task.targetCaseId);
      setActiveTab("cases");
      return;
    }

    if (task.targetPrId) {
      const pr = purchaseRequests.find((item) => item.id === task.targetPrId);
      if (pr) setSelectedPr(pr);
    }

    setActiveTab(task.targetTab);
  };

  const handleCreateCaseShortcut = () => {
    setSelectedCaseId(null);
    setActiveTab("cases");
    setCaseCreateRequestToken((value) => value + 1);
  };

  const dashboardMetrics = buildDashboardMetrics({
    purchaseRequests,
    rfqs,
    quotes,
    inventory,
    suppliers,
    cases,
  });

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} t={t} locale={locale} setLocale={setLocale} />;
  }

  return (
    <div className="min-h-screen stally-lux-shell flex font-sans text-primary-dark">
      <div className="stally-flow-lines" />

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentRole={currentRole}
        onLogout={handleLogout}
        t={t}
      />

      {/* Main Content Area - Single Screen Viewport Layout */}
      <main className="relative z-10 flex-1 lg:ml-64 h-screen flex flex-col overflow-hidden p-4 sm:p-6 text-primary-dark">

        {/* Top Header navbar bar */}
        <header className="lux-card relative z-30 flex flex-col sm:flex-row justify-between items-center gap-4 p-4 px-5 mb-5 shrink-0">
          {/* Left search */}
          <div className="flex-1 relative max-w-md min-w-0">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="global-search"
              placeholder={t("searchPlaceholder")}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none text-slate-800 focus:ring-2 focus:ring-[#E6A756] transition-all"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 rounded-2xl p-1">
              <button
                type="button"
                id="btn-lang-vi"
                onClick={() => setLocale("vi")}
                className={`px-2.5 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                  locale === "vi"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                VI
              </button>
              <button
                type="button"
                id="btn-lang-en"
                onClick={() => setLocale("en")}
                className={`px-2.5 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                  locale === "en"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                EN
              </button>
            </div>

            {/* Notification Stub */}
            <button
              type="button"
              id="btn-notifications"
              onClick={() => showToast(t("notifications"), "info")}
              className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-2xl bg-white hover:bg-slate-50 cursor-pointer shadow-sm relative transition-all"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
            </button>

            {/* Settings Stub with Popover */}
            <div className="relative">
              <button
                type="button"
                id="btn-settings"
                onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-2xl bg-white hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showSettingsPopover && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-50 animate-fade-slide-up">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3">
                    {t("settings")}
                  </h3>
                  <div className="space-y-4">
                    {/* View mode setting */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">
                        {t("viewSwitcher")}
                      </label>
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 w-full">
                        <button
                          type="button"
                          id="popover-btn-view-operator"
                          onClick={() => {
                            setDashboardView("operator");
                            setShowSettingsPopover(false);
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            dashboardView === "operator"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {t("operator")}
                        </button>
                        <button
                          type="button"
                          id="popover-btn-view-executive"
                          onClick={() => {
                            setDashboardView("executive");
                            setShowSettingsPopover(false);
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            dashboardView === "executive"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {t("executive")}
                        </button>
                      </div>
                    </div>

                    {/* Language setting */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">
                        {t("language")}
                      </label>
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 w-full">
                        <button
                          type="button"
                          id="popover-btn-lang-vi"
                          onClick={() => {
                            setLocale("vi");
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            locale === "vi"
                              ? "bg-slate-950 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          VI
                        </button>
                        <button
                          type="button"
                          id="popover-btn-lang-en"
                          onClick={() => {
                            setLocale("en");
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            locale === "en"
                              ? "bg-slate-950 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {errorText && (
          <div className="mb-6 bg-coral-light/10 border border-coral/30 text-coral-dark p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-coral-glow animate-fade-slide-up shrink-0">
            <ShieldAlert className="w-5 h-5 text-coral shrink-0" />
            <div>
              <p className="font-bold">{t("errSyncTitle")}</p>
              <p className="opacity-95 font-medium">{t("errSyncDesc").replace("{error}", errorText)}</p>
              <button
                onClick={syncStateFromServer}
                className="mt-2 px-3 py-1.5 bg-white border border-coral/30 rounded-full text-[11px] font-bold text-coral-dark hover:bg-coral-light/10"
              >
                {t("errSyncRetry")}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-xs text-slate-400 space-y-3">
            <RefreshCw className="w-5 h-5 text-primary-light animate-spin" />
            <span className="font-medium tracking-wide">{t("syncingCases")}</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-300">
            {/* Title Bar Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5 shrink-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">
                  {activeTab === "overview" && t("pageTitleOverview")}
                  {activeTab === "cases" && t("pageTitleCases")}
                  {activeTab === "pr" && t("pageTitlePr")}
                  {activeTab === "rfq" && t("pageTitleRfq")}
                  {activeTab === "suppliers" && t("pageTitleSuppliers")}
                  {activeTab === "inventory" && t("pageTitleInventory")}
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1" />
              </div>

              {/* Dynamic CTA Buttons based on active tab */}
              <div className="flex items-center gap-2.5">
                {(activeTab === "overview" || activeTab === "cases") && (
                  <button
                    type="button"
                    id="content-btn-create-case"
                    onClick={handleCreateCaseShortcut}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-coral hover:bg-coral-dark rounded-full cursor-pointer transition-all shadow-sm shadow-coral/10"
                  >
                    <Plus className="w-4 h-4" />
                    {t("createCaseBtn")}
                  </button>
                )}
                {activeTab === "overview" && (
                  <button
                    type="button"
                    id="content-btn-add-supplier"
                    onClick={() => setActiveTab("suppliers")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-full cursor-pointer transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {t("addSupplier")}
                  </button>
                )}
              </div>
            </div>

            {/* Overview Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
              style={{ display: activeTab === "overview" ? "block" : "none" }}
            >
              {dashboardView === "executive" ? (
                <ExecutiveDashboard metrics={dashboardMetrics} t={t} />
              ) : (
                <OperatorDashboard
                  metrics={dashboardMetrics}
                  onNavigate={handlePriorityTaskNavigate}
                  t={t}
                />
              )}
            </div>

            {/* Cases Tab */}
            <div
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
              style={{ display: activeTab === "cases" ? "flex" : "none" }}
            >
              {selectedCaseId ? (
                   <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24">
                  <CaseDetailTimeline
                    caseId={selectedCaseId}
                    onBackToList={() => setSelectedCaseId(null)}
                    currentRole={currentRole}
                    orgId={orgId}
                    onStateChanged={syncStateFromServer}
                    refreshTrigger={sseRefreshTrigger}
                    t={t}
                    locale={locale}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <ProcurementDashboard
                    currentRole={currentRole}
                    orgId={orgId}
                    onSelectCase={(caseId) => setSelectedCaseId(caseId)}
                    isActive={activeTab === "cases"}
                    createRequestToken={caseCreateRequestToken}
                    t={t}
                  />
                </div>
              )}
            </div>

            {/* PR Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
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
                t={t}
              />
            </div>

            {/* RFQ Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
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
                onOpenPurchaseRequests={() => setActiveTab("pr")}
                t={t}
                locale={locale}
              />
            </div>

            {/* Suppliers Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
              style={{ display: activeTab === "suppliers" ? "block" : "none" }}
            >
              <SupplierManagement
                currentRole={currentRole}
                orgId={orgId}
                onSuppliersChanged={syncStateFromServer}
                isActive={activeTab === "suppliers"}
                t={t}
                locale={locale}
              />
            </div>

            {/* Inventory Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
              style={{ display: activeTab === "inventory" ? "block" : "none" }}
            >
              <InventoryManager
                inventory={inventory}
                stockMovements={stockMovements}
                currentRole={currentRole}
                onReceiveGoods={handleReceiveGoods}
                onAdjustStock={handleAdjustStock}
                onCreatePrFromStock={handleCreatePrFromStock}
                t={t}
              />
            </div>

            {/* Chatbot Tab */}
            <div
              className="flex-1 overflow-y-auto min-h-0 pr-1 pb-24"
              style={{ display: activeTab === "chatbot" ? "block" : "none" }}
            >
              <ChatbotPanel
                onCreatePr={handleCreatePr}
                setActiveTab={setActiveTab}
                t={t}
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
        t={t}
        locale={locale}
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

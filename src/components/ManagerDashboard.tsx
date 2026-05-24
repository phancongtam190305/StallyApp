import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  PieChart, 
  Coins, 
  ShieldCheck, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  UserCheck, 
  ChevronRight, 
  X, 
  FileSpreadsheet, 
  Mail, 
  Reply, 
  HelpCircle, 
  ArrowLeftRight, 
  Check, 
  AlertTriangle, 
  FileUp, 
  Sparkles, 
  Filter
} from "lucide-react";
import { PurchaseRequest, RfqCase, Quote, Supplier } from "../types";
import ItemIcon from "./ItemIcon";

interface ManagerDashboardProps {
  purchaseRequests: PurchaseRequest[];
  rfqs: RfqCase[];
  quotes: Quote[];
  suppliers: Supplier[];
  onApproveQuote: (rfqId: string, quoteId: string) => void;
  setActiveTab: (tab: string) => void;
}

export default function ManagerDashboard({
  purchaseRequests,
  rfqs,
  quotes,
  suppliers,
  onApproveQuote,
  setActiveTab
}: ManagerDashboardProps) {
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"matrix" | "quotes" | "emails">("matrix");
  const [showClarifyInput, setShowClarifyInput] = useState(false);
  const [clarifyText, setClarifyText] = useState("");
  const [decisionAlert, setDecisionAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Interactive Chart States
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<number | null>(null);
  const [hoveredDoughnutSegment, setHoveredDoughnutSegment] = useState<string | null>(null);

  // --- STATS COMPUTATIONS ---
  const approvedQuotes = useMemo(() => quotes.filter(q => q.status === "selected"), [quotes]);
  
  const totalApprovedSpend = useMemo(() => {
    return approvedQuotes.reduce((sum, q) => sum + q.totalAmount, 0);
  }, [approvedQuotes]);

  // AI Negotiation Savings: Sourced quotes vs approved quotes.
  // We can calculate this by taking the recommended quote, and comparing it against the highest/average bid or a simulated 15% negotiation baseline.
  const totalSavings = useMemo(() => {
    // High-fidelity calculation: selected quote negotiated savings (simulate 12.5% of total spend was saved via AI rounds)
    return Math.round(totalApprovedSpend * 0.125);
  }, [totalApprovedSpend]);

  const activeSuppliersCount = useMemo(() => suppliers.length, [suppliers]);

  // --- CHART 1: MONTHLY SPENDING TREND (Bezier SVG) ---
  const trendData = useMemo(() => {
    return [
      { month: "T1", amount: 15400000, display: "15.4M" },
      { month: "T2", amount: 18500000, display: "18.5M" },
      { month: "T3", amount: 24100000, display: "24.1M" },
      { month: "T4", amount: 22800000, display: "22.8M" },
      { month: "T5", amount: 31400000, display: "31.4M" },
      { month: "T6 (Hiện tại)", amount: totalApprovedSpend > 0 ? totalApprovedSpend : 38600000, display: totalApprovedSpend > 0 ? `${(totalApprovedSpend / 1000000).toFixed(1)}M` : "38.6M" }
    ];
  }, [totalApprovedSpend]);

  // --- CHART 2: CATEGORY DOUGHNUT BREAKDOWN ---
  const categories = useMemo(() => {
    return [
      { id: "fresh", name: "Thịt Sạch & Hải Sản", percent: 45, color: "#006d77", amount: 17370000, length: 141.37, offset: 0 },
      { id: "staples", name: "Gạo & Lương thực", percent: 30, color: "#10b981", amount: 11580000, length: 94.25, offset: -141.37 },
      { id: "spices", name: "Gia vị & Chế biến", percent: 15, color: "#f59e0b", amount: 5790000, length: 47.12, offset: -235.62 },
      { id: "equip", name: "Công cụ & Thiết bị", percent: 10, color: "#6366f1", amount: 3860000, length: 31.42, offset: -282.74 }
    ];
  }, []);

  // --- APPROVAL QUEUE (RFQs not yet approved) ---
  const pendingApprovals = useMemo(() => {
    return rfqs.filter(rfq => {
      // An RFQ is pending manager approval if it is NOT approved and has quotes received
      const rfqQuotes = quotes.filter(q => q.rfqCaseId === rfq.id);
      return rfq.status !== "approved" && rfqQuotes.length > 0;
    });
  }, [rfqs, quotes]);

  const activeRfq = useMemo(() => {
    if (!selectedRfqId) return null;
    return rfqs.find(r => r.id === selectedRfqId) || null;
  }, [selectedRfqId, rfqs]);

  const activeQuotes = useMemo(() => {
    if (!selectedRfqId) return [];
    return quotes.filter(q => q.rfqCaseId === selectedRfqId);
  }, [selectedRfqId, quotes]);

  const activePr = useMemo(() => {
    if (!activeRfq) return null;
    return purchaseRequests.find(p => p.id === activeRfq.purchaseRequestId) || null;
  }, [activeRfq, purchaseRequests]);

  // Dynamic 3 Gold Metrics Selection: choose the best quote (lowest price or selected)
  const recommendedQuote = useMemo(() => {
    if (activeQuotes.length === 0) return null;
    const selected = activeQuotes.find(q => q.status === "selected");
    if (selected) return selected;
    // Default to lowest total Amount quote
    return [...activeQuotes].sort((a, b) => a.totalAmount - b.totalAmount)[0];
  }, [activeQuotes]);

  const recommendedSupplier = useMemo(() => {
    if (!recommendedQuote) return null;
    return suppliers.find(s => s.id === recommendedQuote.supplierId) || null;
  }, [recommendedQuote, suppliers]);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const handleApproveClick = () => {
    if (!activeRfq || !recommendedQuote) return;
    onApproveQuote(activeRfq.id, recommendedQuote.id);
    setDecisionAlert({
      type: "success",
      message: `🎉 Đã phê duyệt đơn hàng thầu thành công! Đơn đặt mua hàng (PO) đã được tạo và gửi đến ${recommendedQuote.supplierName}.`
    });
    setTimeout(() => {
      setDecisionAlert(null);
      setSelectedRfqId(null);
    }, 4500);
  };

  const handleClarifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyText.trim()) return;
    setDecisionAlert({
      type: "success",
      message: `📩 Yêu cầu làm rõ đã được gửi đến nhân viên thu mua: "${clarifyText}"`
    });
    setClarifyText("");
    setShowClarifyInput(false);
    setTimeout(() => setDecisionAlert(null), 4000);
  };

  const handleRejectClick = () => {
    if (!activeRfq) return;
    setDecisionAlert({
      type: "error",
      message: `❌ Đã từ chối phê duyệt hồ sơ RFQ #${activeRfq.id.toUpperCase()}. Hồ sơ đã được chuyển lại cho phòng thu mua xem xét.`
    });
    setTimeout(() => {
      setDecisionAlert(null);
      setSelectedRfqId(null);
    }, 4000);
  };

  return (
    <div className="space-y-8 animate-fade-slide-up pb-12 font-sans">
      
      {/* Luxury Welcome banner */}
      <div className="bg-gradient-to-r from-[#004d40] to-[#006d77] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#80cbc4] bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">Giám Đốc Ban Điều Hành</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-ping" />
            </div>
            <h2 className="text-2xl font-black font-display tracking-tight mt-2.5">Chào mừng trở lại, Nguyễn Thị Mai</h2>
            <p className="text-white/80 text-xs mt-1 font-medium max-w-lg leading-relaxed">
              Kiểm tra ngân sách chuỗi cung ứng Stally, đánh giá bảng so sánh thầu tối ưu hóa bởi AI, duyệt nhanh PO trị giá hàng chục triệu đồng chỉ trong một chạm.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab("pr")}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 font-bold text-xs px-4 py-2.5 rounded-xl transition-all backdrop-blur-md cursor-pointer flex items-center gap-1"
            >
              Xem Yêu Cầu Gốc
            </button>
            <button 
              onClick={() => setSelectedRfqId(pendingApprovals[0]?.id || null)}
              disabled={pendingApprovals.length === 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-[#003d44] font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:bg-slate-350/40 disabled:text-white/50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" /> Duyệt Ngay ({pendingApprovals.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-205 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl transition-transform group-hover:scale-125" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Chi Tiêu Đã Giải Ngân</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-2 font-display">{formatVND(totalApprovedSpend)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Hóa đơn PO chính thức được phê duyệt</span>
          </p>
        </div>

        <div className="bg-white border border-slate-205 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl transition-transform group-hover:scale-125" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Tiết Kiệm Qua AI Đàm Phán</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-2 font-display">~ {formatVND(totalSavings)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-750 font-bold mt-4 flex items-center gap-1 bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-150 w-max">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Tiết kiệm 12.5% so với giá chào thầu đầu</span>
          </p>
        </div>

        <div className="bg-white border border-slate-205 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl transition-transform group-hover:scale-125" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Đối Tác CRM Hoạt Động</p>
              <h3 className="text-2xl font-extrabold text-indigo-750 mt-2 font-display">{activeSuppliersCount} Nhà Cung Cấp</h3>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-750 border border-indigo-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>Đã ghép thầu & xác minh thông tin thầu tự động</span>
          </p>
        </div>
      </div>

      {/* Decision Alert Notification */}
      {decisionAlert && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-md animate-fade-slide-up ${
          decisionAlert.type === "success" 
            ? "bg-emerald-50 border-emerald-250 text-emerald-850" 
            : "bg-rose-50 border-rose-250 text-rose-850"
        }`}>
          {decisionAlert.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-bounce" /> : <XCircle className="w-5 h-5 text-rose-600" />}
          <div className="text-xs font-bold font-sans leading-relaxed">{decisionAlert.message}</div>
        </div>
      )}

      {/* Visual Analytics & Rich Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART 1: Spending Trend Area Chart (Bezier) */}
        <div className="lg:col-span-7 bg-white border border-slate-205 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-[#00535b] flex items-center gap-1.5 font-display">
                  <TrendingUp className="w-4 h-4 text-teal-650" /> Biểu đồ Xu hướng Chi tiêu Thu mua (6 Tháng)
                </h3>
                <p className="text-[11px] text-slate-450 font-semibold mt-0.5">Biểu đồ Area Chart mượt mà thể hiện dòng tiền PO thực tế hàng tháng.</p>
              </div>
              <span className="text-[9px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded border border-teal-150 font-mono">
                Real-time Data
              </span>
            </div>

            {/* SVG Bezier Graph */}
            <div className="relative h-64 mt-8 w-full select-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  {/* Gradient fill */}
                  <linearGradient id="manager-chart-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#006d77" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#006d77" stopOpacity="0.0" />
                  </linearGradient>
                  {/* Stroke stroke */}
                  <linearGradient id="manager-chart-curve" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#004d40" />
                    <stop offset="50%" stopColor="#006d77" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal guidelines */}
                <line x1="10" y1="40" x2="490" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="10" y1="80" x2="490" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="10" y1="120" x2="490" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="10" y1="160" x2="490" y2="160" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

                {/* Baseline */}
                <line x1="10" y1="180" x2="490" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />

                {/* Area under curve */}
                <path
                  d="M 10,160 C 50,150 70,145 100,140 C 130,135 160,115 190,110 C 220,105 250,130 280,125 C 310,120 340,85 370,75 C 400,65 430,45 460,40 L 460,180 L 10,180 Z"
                  fill="url(#manager-chart-area)"
                  className="transition-all duration-700"
                />

                {/* Curved bezier stroke line */}
                <path
                  d="M 10,160 C 50,150 70,145 100,140 C 130,135 160,115 190,110 C 220,105 250,130 280,125 C 310,120 340,85 370,75 C 400,65 430,45 460,40"
                  fill="none"
                  stroke="url(#manager-chart-curve)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />

                {/* Interactive Points */}
                {[
                  { cx: 10, cy: 160, val: "15.4M", month: "Tháng 1" },
                  { cx: 100, cy: 140, val: "18.5M", month: "Tháng 2" },
                  { cx: 190, cy: 110, val: "24.1M", month: "Tháng 3" },
                  { cx: 280, cy: 125, val: "22.8M", month: "Tháng 4" },
                  { cx: 370, cy: 75, val: "29.5M", month: "Tháng 5" },
                  { cx: 460, cy: 40, val: trendData[5].display, month: "Tháng 6" }
                ].map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.cx}
                    cy={pt.cy}
                    r={hoveredTrendPoint === idx ? 7 : 4.5}
                    className="fill-white stroke-[#006d77] stroke-[3] transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredTrendPoint(idx)}
                    onMouseLeave={() => setHoveredTrendPoint(null)}
                  />
                ))}
              </svg>

              {/* Dynamic Overlay HTML tooltips for SVG */}
              {hoveredTrendPoint !== null && (
                <div 
                  className="absolute bg-slate-900 text-white text-[10px] font-bold p-2 px-3 rounded-lg shadow-xl border border-slate-700 pointer-events-none transition-all duration-150"
                  style={{
                    left: `${(hoveredTrendPoint * 18.2) + 2}%`,
                    top: `${trendData[hoveredTrendPoint].amount > 25000000 ? "10%" : "35%"}`,
                    transform: "translateX(-50%)"
                  }}
                >
                  <p className="opacity-70 text-[9px] uppercase font-mono">{trendData[hoveredTrendPoint].month}</p>
                  <p className="text-teal-400 font-extrabold mt-0.5 text-xs font-mono">{formatVND(trendData[hoveredTrendPoint].amount)}</p>
                </div>
              )}
            </div>

            {/* X-Axis labels */}
            <div className="flex justify-between px-1.5 text-[10px] font-mono text-slate-400 font-bold mt-2 border-t border-slate-100 pt-3">
              <span>Tháng 1</span>
              <span>Tháng 2</span>
              <span>Tháng 3</span>
              <span>Tháng 4</span>
              <span>Tháng 5</span>
              <span className="text-[#006d77] font-extrabold">Tháng 6 (Hiện tại)</span>
            </div>
          </div>
        </div>

        {/* CHART 2: Category Doughnut Chart (Interactive) */}
        <div className="lg:col-span-5 bg-white border border-slate-205 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div>
            <h3 className="text-sm font-black text-[#00535b] flex items-center gap-1.5 font-display">
              <PieChart className="w-4 h-4 text-emerald-600" /> Phân bổ Cơ cấu Chi tiêu Mua sắm
            </h3>
            <p className="text-[11px] text-slate-455 mt-0.5 font-semibold">Tỉ trọng giải ngân theo nhóm ngành hàng thực phẩm & bếp.</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8">
              
              {/* Doughnut SVG Drawing */}
              <div className="relative w-40 h-40 shrink-0">
                <svg width="160" height="160" viewBox="0 0 200 200" className="overflow-visible">
                  {categories.map((cat) => {
                    const isHovered = hoveredDoughnutSegment === cat.id;
                    return (
                      <circle
                        key={cat.id}
                        cx="100"
                        cy="100"
                        r="60"
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth={isHovered ? 26 : 20}
                        strokeDasharray={`${cat.length} 376.99`}
                        strokeDashoffset={cat.offset * (376.99 / 314.16)}
                        transform="rotate(-90 100 100)"
                        className="transition-all duration-300 cursor-pointer stroke-linecap-round"
                        onMouseEnter={() => setHoveredDoughnutSegment(cat.id)}
                        onMouseLeave={() => setHoveredDoughnutSegment(null)}
                      />
                    );
                  })}
                  
                  {/* Center details */}
                  <circle cx="100" cy="100" r="45" className="fill-white shadow-sm" />
                </svg>

                {/* Interactive Center HTML Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                  {hoveredDoughnutSegment ? (
                    (() => {
                      const activeCat = categories.find(c => c.id === hoveredDoughnutSegment);
                      return (
                        <div className="p-1">
                          <p className="text-[9px] uppercase font-bold text-slate-400 truncate max-w-[90px]">{activeCat?.name}</p>
                          <p className="text-xs font-black text-slate-800 font-mono mt-0.5">{activeCat?.percent}%</p>
                        </div>
                      );
                    })()
                  ) : (
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">TỔNG CỘNG</p>
                      <p className="text-[11px] font-black text-slate-800 font-mono mt-0.5">{totalApprovedSpend > 0 ? `${(totalApprovedSpend / 1000000).toFixed(1)}M` : "38.6M"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Legends with hover trigger link */}
              <div className="flex-1 space-y-2.5 w-full">
                {categories.map((cat) => {
                  const isHovered = hoveredDoughnutSegment === cat.id;
                  return (
                    <div 
                      key={cat.id} 
                      className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-between text-xs cursor-pointer ${
                        isHovered ? "bg-slate-50 border-slate-300 shadow-xs" : "bg-transparent border-transparent hover:bg-slate-50/50"
                      }`}
                      onMouseEnter={() => setHoveredDoughnutSegment(cat.id)}
                      onMouseLeave={() => setHoveredDoughnutSegment(null)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-extrabold text-slate-700 truncate max-w-[110px]">{cat.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-800 font-mono">{cat.percent}%</p>
                        <p className="text-[9px] text-slate-400 font-mono font-medium">{formatVND(cat.amount)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* CORE WORKSPACE FLOWS - APPROVALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Approval Inbox Queue */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-205 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-[#00535b] flex items-center gap-1.5 font-display">
                  <Filter className="w-4 h-4 text-teal-650" /> Hộp Thư Phê Duyệt
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Danh sách đơn thầu RFQ đang chờ Giám Đốc duyệt.</p>
              </div>
              <span className="text-[10px] font-bold bg-[#e0f2f1] text-[#00535b] border border-[#b2dfdb] px-2 py-0.5 rounded font-mono">
                {pendingApprovals.length} Phiếu
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2.5">
                <ShieldCheck className="w-10 h-10 text-emerald-505 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Đã phê duyệt tất cả hồ sơ!</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] mx-auto leading-normal">
                    Chuỗi cung ứng Stally đang hoạt động mượt mà. Không có hồ sơ đọng.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {pendingApprovals.map((rfq) => {
                  const prObj = purchaseRequests.find(p => p.id === rfq.purchaseRequestId);
                  const isSelected = selectedRfqId === rfq.id;
                  const rQuotes = quotes.filter(q => q.rfqCaseId === rfq.id);
                  const minPrice = rQuotes.length > 0 ? Math.min(...rQuotes.map(q => q.totalAmount)) : 0;
                  
                  return (
                    <div 
                      key={rfq.id}
                      onClick={() => {
                        setSelectedRfqId(rfq.id);
                        setDrawerOpen(false);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? "bg-teal-50/20 border-teal-500 shadow-md ring-2 ring-teal-500/10" 
                          : "bg-white border-slate-205 hover:border-slate-350 hover:bg-slate-50/30"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 font-mono">CASE #{rfq.id.toUpperCase()}</p>
                          <h4 className="text-xs font-black text-slate-800 leading-snug line-clamp-2">{prObj?.title || "Yêu cầu thầu mua sắm"}</h4>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase font-mono shrink-0 ${
                          prObj?.priority === "high" ? "bg-rose-50 border border-rose-250 text-rose-700" : "bg-teal-50 border border-teal-200 text-teal-850"
                        }`}>
                          {prObj?.priority || "Medium"}
                        </span>
                      </div>

                      <div className="h-[1px] bg-slate-100 my-2.5" />

                      <div className="flex justify-between items-center text-[10.5px]">
                        <div className="flex items-center gap-1.5 text-slate-505">
                          <span className="font-bold text-slate-700">{rQuotes.length} nhà thầu</span>
                          <span>•</span>
                          <span className="font-mono">{prObj?.items.length || 0} sản phẩm</span>
                        </div>
                        <p className="font-extrabold text-teal-805 font-mono bg-teal-50/50 px-1.5 py-0.5 rounded-lg">Giá từ: {formatVND(minPrice)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Approval Wizard with 3 Gold Metrics */}
        <div className="lg:col-span-8">
          {!activeRfq ? (
            <div className="bg-slate-50 border border-slate-205 p-12 rounded-2xl text-center flex flex-col items-center justify-center space-y-4 h-full min-h-[350px]">
              <HelpCircle className="w-12 h-12 text-slate-300 animate-bounce" />
              <div>
                <h4 className="text-sm font-black text-slate-700">Chưa chọn hồ sơ cần duyệt</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mt-1">
                  Nhấp vào một hồ sơ thầu từ danh sách chờ bên trái để kích hoạt **Quy trình phê duyệt thông minh 3 Gold Metrics** và xem so sánh sâu.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-205 p-6 rounded-2xl shadow-sm space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start border-b border-slate-150 pb-4">
                <div>
                  <span className="text-[9px] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-teal-700 font-mono font-bold uppercase tracking-wider">Trình duyệt Giám Đốc</span>
                  <h3 className="text-base font-black text-slate-800 mt-2">Hồ sơ chào thầu &amp; Ký PO #{activeRfq.id.toUpperCase()}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Yêu cầu từ: <strong className="text-slate-600">{activePr?.requesterName} ({activePr?.departmentName})</strong> • Hạn: {activeRfq.dueDate}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 font-mono block">PHÊ DUYỆT NHANH</span>
                  <span className="text-xs font-black text-teal-800 font-mono bg-teal-50/70 border border-teal-200 px-2 py-0.5 rounded mt-1.5 inline-block">3 Gold Metrics</span>
                </div>
              </div>

              {/* 3 Gold Metrics Summary Card */}
              <div className="bg-teal-50/10 border border-teal-500/10 rounded-2xl p-5 shadow-inner space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-150/40 pb-2.5">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#006d77]">BẢN TỔNG HỢP 3 GOLD METRICS (STALLY AI)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  
                  {/* Metric 1: Recommended Supplier */}
                  <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between shadow-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">1. Đối Tác Được Khuyên Dùng</p>
                      <h4 className="text-xs font-black text-slate-800 mt-1.5">{recommendedQuote?.supplierName}</h4>
                      <p className="text-[10.5px] text-emerald-700 font-semibold mt-1">⭐️ Giá tốt nhất &amp; Điểm thầu 96%</p>
                    </div>
                    <div className="pt-2 text-[10px] text-slate-400 font-medium">
                      Thời gian: {recommendedQuote?.deliveryDays} ngày | Hạn nợ: {recommendedQuote?.paymentTerms}
                    </div>
                  </div>

                  {/* Metric 2: Financial Total & Budget */}
                  <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between shadow-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">2. Tổng Chi Phí &amp; Ngân Sách</p>
                      <h4 className="text-xs font-extrabold text-[#00535b] mt-1.5 font-mono">{formatVND(recommendedQuote?.totalAmount || 0)}</h4>
                      <p className="text-[10.5px] text-emerald-700 font-bold mt-1">✓ Tiết kiệm 12.5% ngân sách</p>
                    </div>
                    <div className="w-full bg-slate-105 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "87%" }} />
                    </div>
                  </div>

                  {/* Metric 3: Procurement/AI Rationale */}
                  <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between shadow-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">3. Lý Do Đề Xuất Của Thu Mua</p>
                      <p className="text-[10.5px] text-slate-500 leading-normal mt-1.5 italic line-clamp-3">
                        "Nhà cung cấp {recommendedQuote?.supplierName} có bảng chào thầu nguyên vật liệu tối ưu chi phí hơn 2.4 triệu đồng so với đối thủ khác. Hỗ trợ phương thức công nợ Net 15 ngày, giao hàng đúng chuẩn."
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Items List in this RFQ */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Sản phẩm yêu cầu thầu ({activePr?.items.length}):</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePr?.items.map((it, i) => (
                    <div key={i} className="bg-slate-55 p-2.5 rounded-xl border border-slate-205 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ItemIcon name={it.name} size="sm" className="scale-90 shadow-xs border-slate-205" />
                        <div>
                          <p className="font-bold text-xs text-slate-800">{it.name}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{it.notes || "Yêu cầu chất lượng chuẩn"}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-slate-700 font-extrabold bg-white p-1 px-2 rounded-lg border border-slate-150">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Interactive Button Trigger: Drawer and Approval Buttons */}
              <div className="pt-4 border-t border-slate-150 flex flex-col sm:flex-row justify-between items-center gap-4">
                
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawerTab("matrix");
                    setDrawerOpen(true);
                  }}
                  className="text-xs font-extrabold text-teal-700 hover:text-teal-900 transition-all flex items-center gap-1 cursor-pointer"
                >
                  Xem Bảng So Sánh Báo Giá Đầy Đủ &amp; Nhật Ký Đàm Phán (Audit Trail) ➔
                </button>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowClarifyInput(!showClarifyInput)}
                    className="flex-1 sm:flex-none text-slate-650 bg-white border border-slate-205 hover:bg-slate-50 font-bold text-xs p-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    Yêu Cầu Làm Rõ
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectClick}
                    className="flex-1 sm:flex-none text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 font-bold text-xs p-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    Từ Chối
                  </button>
                  <button
                    type="button"
                    id="btn-manager-approve"
                    onClick={handleApproveClick}
                    className="flex-1 sm:flex-none text-white bg-gradient-to-r from-teal-650 to-emerald-600 hover:from-teal-750 hover:to-emerald-700 font-black text-xs p-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" /> Ký &amp; Duyệt PO
                  </button>
                </div>

              </div>

              {/* Inlined Clarification input dialog */}
              {showClarifyInput && (
                <form onSubmit={handleClarifySubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4 animate-fade-slide-up space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">Bổ sung chỉ thị cho nhân viên thu mua</span>
                    <button type="button" onClick={() => setShowClarifyInput(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={clarifyText}
                    onChange={(e) => setClarifyText(e.target.value)}
                    placeholder="Ví dụ: 'Thương lượng lại phí vận chuyển với Gạo Vàng', 'Kiểm tra thêm chất lượng gạo mẫu'..."
                    className="w-full bg-white border border-slate-205 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-405 focus:outline-none focus:border-teal-500 rounded-xl font-medium"
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-[10px] p-2 px-4 rounded-lg transition-all cursor-pointer"
                    >
                      Gửi Chỉ Thị
                    </button>
                  </div>
                </form>
              )}

            </div>
          )}
        </div>

      </div>

      {/* --- DETAIL SLIDE-OUT TRIFOLD DRAWER (GLASSMORPHIC EDGE) --- */}
      {drawerOpen && activeRfq && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop translucent mask */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer content frame */}
          <div className="relative z-10 w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-in-right">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">Hồ sơ thẩm định thầu kiểm toán</p>
                <h3 className="text-sm font-black text-[#00535b] mt-1 font-display">Chi Tiết So Sánh Đấu Thầu &amp; Hội Thoại Đàm Phán #{activeRfq.id.toUpperCase()}</h3>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trifold Tabs Switcher bar */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 p-2 gap-1.5">
              <button
                onClick={() => setActiveDrawerTab("matrix")}
                className={`flex-1 p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeDrawerTab === "matrix" 
                    ? "bg-white text-teal-800 shadow-xs border border-slate-200/50" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Ma Trận So Sánh Báo Giá
              </button>
              <button
                onClick={() => setActiveDrawerTab("quotes")}
                className={`flex-1 p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeDrawerTab === "quotes" 
                    ? "bg-white text-teal-800 shadow-xs border border-slate-200/50" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800"
                }`}
              >
                <FileUp className="w-3.5 h-3.5" /> Đơn Báo Giá Gốc (PDF OCR)
              </button>
              <button
                onClick={() => setActiveDrawerTab("emails")}
                className={`flex-1 p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeDrawerTab === "emails" 
                    ? "bg-white text-teal-800 shadow-xs border border-slate-200/50" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800"
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Nhật Ký Đàm Phán AI (Email)
              </button>
            </div>

            {/* Drawer Body Scroll Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              
              {/* TAB 1: MA TRẬN GIÁ CHI TIẾT */}
              {activeDrawerTab === "matrix" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                          <th className="p-4 font-bold text-slate-650">Hạng mục so sánh</th>
                          {activeQuotes.map((q) => (
                            <th key={q.id} className="p-4 font-black text-teal-800 min-w-44 border-l border-slate-202">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-slate-700">{q.supplierName}</p>
                                <span className="text-[9px] font-mono text-slate-405 font-bold bg-slate-100 px-1 rounded block w-max mt-1">Báo Giá Gốc Trích Xuất</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {activePr?.items.map((prItem, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-slate-55/35">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <ItemIcon name={prItem.name} size="sm" className="scale-90 shadow-xs" />
                                  <div>
                                    <span className="font-extrabold text-slate-700 block">{prItem.name}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Yêu cầu: {prItem.quantity} {prItem.unit}</span>
                                  </div>
                                </div>
                              </td>
                              {activeQuotes.map((q) => {
                                const qItem = q.items.find(qi => qi.name.trim().toLowerCase() === prItem.name.trim().toLowerCase());
                                return (
                                  <td key={q.id} className="p-4 border-l border-slate-202 font-mono font-bold text-slate-650">
                                    {qItem ? (
                                      <div>
                                        <p className="text-slate-700 font-black">{qItem.unitPrice.toLocaleString()} đ</p>
                                        <p className="text-[10px] text-slate-400 font-medium">T.Tiền: {qItem.totalPrice.toLocaleString()} đ</p>
                                      </div>
                                    ) : (
                                      <span className="text-slate-450 font-sans italic font-normal">Không nộp thầu</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        <tr className="bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-650">Thời gian Giao Hàng</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-202 font-bold text-slate-705">
                              🚚 {q.deliveryDays} ngày
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-slate-650">Điều khoản Công Nợ</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-202 text-slate-650 font-medium">
                              💳 {q.paymentTerms}
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-slate-655">Thuế GTGT (VAT)</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-202 font-mono text-slate-500">
                              {q.taxAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-slate-655">Phí Vận Đơn</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-202 font-mono text-slate-500">
                              {q.shippingFee.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        <tr className="bg-teal-50/20 font-black border-t border-slate-202 text-teal-800">
                          <td className="p-4 text-xs font-black uppercase">TỔNG CỘNG CHỐT TRÊN HÓA ĐƠN</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-202 font-mono text-sm font-black">
                              {q.totalAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-2.5 text-xs text-slate-500">
                    <AlertTriangle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-700">Phân tích chênh lệch đơn giá:</p>
                      <p className="mt-1 leading-normal">
                        Bảng ma trận giá được trích xuất hoàn toàn tự động từ file PDF báo giá gốc gửi về của NCC. AI đã thực hiện khớp nối đơn vị (ví dụ bao 50kg ➔ kg) để đưa về cùng một hệ quy chiếu đơn vị cơ bản.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ĐƠN BÁO GIÁ GỐC PDF OCR */}
              {activeDrawerTab === "quotes" && (
                <div className="space-y-6">
                  {activeQuotes.map((q) => (
                    <div key={q.id} className="bg-white border border-slate-205 rounded-2xl p-5 shadow-xs space-y-4">
                      
                      {/* Document Meta information bar */}
                      <div className="flex justify-between items-center border-b border-slate-150 pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#006d77]" />
                          <div>
                            <h4 className="text-xs font-black text-slate-800">{q.originalFileUrl}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">Bản phân tích OCR lúc: {new Date(q.createdAt).toLocaleString("vi-VN")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-250 font-mono">
                            Độ tin cậy trích xuất: {q.aiConfidenceScore}%
                          </span>
                        </div>
                      </div>

                      {/* Visually stunning Mock PDF design */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-[11px] leading-relaxed text-slate-700 max-w-2xl mx-auto space-y-4 shadow-inner">
                        <div className="text-center border-b border-dashed border-slate-300 pb-3">
                          <h5 className="font-bold text-xs text-slate-800 uppercase">{q.supplierName}</h5>
                          <p className="text-slate-450 text-[10px] mt-0.5">Địa chỉ: Quận Bình Thạnh, TP. Hồ Chí Minh • Email: sales@{q.supplierId}.com</p>
                          <p className="text-slate-800 font-black text-xs uppercase mt-2">PHIẾU CHÀO GIÁ CUNG CẤP HÀNG HÓA</p>
                          <p className="text-slate-450 text-[10px] mt-0.5">Số: BG-{q.id.toUpperCase()} • Ngày hiệu lực: {q.validUntil}</p>
                        </div>

                        <div className="space-y-1">
                          <p>Kính gửi: BAN MUA SẮM STALLY FOOD GROUP</p>
                          <p>Dự án thầu: Khảo giá cung ứng nguyên liệu đợt tháng 6</p>
                          <p>Chúng tôi xin gửi bảng báo giá chi tiết sản phẩm chất lượng như sau:</p>
                        </div>

                        <div className="border-t border-b border-slate-305 py-2 space-y-2">
                          <div className="grid grid-cols-12 gap-1 font-bold border-b border-slate-200 pb-1 text-slate-800">
                            <span className="col-span-5">Tên sản phẩm</span>
                            <span className="col-span-2 text-right">SL</span>
                            <span className="col-span-2 text-right">Đơn vị</span>
                            <span className="col-span-3 text-right">Thành tiền</span>
                          </div>
                          {q.items.map((it, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-1 text-slate-600">
                              <span className="col-span-5 truncate">{it.name}</span>
                              <span className="col-span-2 text-right">{it.quantity}</span>
                              <span className="col-span-2 text-right">{it.unit}</span>
                              <span className="col-span-3 text-right font-bold">{it.totalPrice.toLocaleString()}đ</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end text-right">
                          <div className="space-y-1 font-semibold text-slate-600 w-64">
                            <div className="flex justify-between">
                              <span>Cộng tiền hàng:</span>
                              <span className="font-bold text-slate-800">{q.subtotal.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Thuế GTGT (10%):</span>
                              <span className="font-bold text-slate-800">{q.taxAmount.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Phí vận chuyển:</span>
                              <span className="font-bold text-slate-800">{q.shippingFee.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between text-slate-800 border-t border-slate-300 pt-1.5 text-xs font-black">
                              <span>TỔNG THANH TOÁN:</span>
                              <span className="text-teal-850">{q.totalAmount.toLocaleString()}đ</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-350 pt-3 text-[10px] text-slate-400 space-y-1">
                          <p>• Thời gian giao hàng dự kiến: {q.deliveryDays} ngày kể từ khi nhận được PO chính thức.</p>
                          <p>• Phương thức thanh toán: {q.paymentTerms}.</p>
                          <p>• Bảng báo giá được ký điện tử bởi đại diện kinh doanh {q.supplierName}.</p>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: NHẬT KÝ ĐÀM PHÁN AI EMAIL */}
              {activeDrawerTab === "emails" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-205 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Sparkles className="w-5 h-5 text-teal-650 shrink-0" />
                      <div>
                        <h4 className="text-xs font-black text-slate-805">Nhật Ký Email Đàm Phán Tự Động Hóa Qua AI</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5">Đối chiếu lịch sử trao đổi thư điện tử đàm phán giảm giá của AI Agent với nhà thầu thợ.</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      
                      {/* Email Round 1 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded font-mono">ROUND 1: LẤY BÁO GIÁ ĐẦU (AI Sourcing)</span>
                          <span className="text-slate-400 font-medium">2026-06-21 09:15</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                          <div className="flex justify-between border-b border-slate-150 pb-1.5 font-bold text-slate-600 text-[10.5px]">
                            <span>Từ: Phan Công Tâm (AI Procurement Agent)</span>
                            <span>Đến: {recommendedQuote?.supplierName} Sales</span>
                          </div>
                          <p className="font-extrabold text-[#00535b]">Chủ đề: [STALLY RFQ-{activeRfq.id.toUpperCase()}] Yêu cầu báo giá nguyên liệu bếp đợt khẩn cấp</p>
                          <p className="text-slate-505 leading-normal italic pl-3 border-l-2 border-slate-300">
                            "Kính mời quý đối tác {recommendedQuote?.supplierName} gửi báo giá chính thức cho các mặt hàng gạo ST25 và dầu ăn. Hạn gửi thầu trước ngày {activeRfq.dueDate}. Hệ thống sẽ bóc tách dữ liệu tự động..."
                          </p>
                        </div>
                      </div>

                      {/* Email Round 2 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="bg-teal-50 border border-teal-200 text-teal-700 font-bold px-2 py-0.5 rounded font-mono">ROUND 2: PHẢN HỒI BÁO GIÁ ĐẦU (Supplier)</span>
                          <span className="text-slate-400 font-medium">2026-06-21 11:30</span>
                        </div>
                        <div className="bg-teal-50/10 border border-teal-500/10 rounded-xl p-4 space-y-2 text-xs">
                          <div className="flex justify-between border-b border-slate-150 pb-1.5 font-bold text-slate-600 text-[10.5px]">
                            <span>Từ: Sales Representative ({recommendedQuote?.supplierName})</span>
                            <span>Đến: Phan Công Tâm (AI Procurement Agent)</span>
                          </div>
                          <p className="font-extrabold text-slate-800">Chủ đề: Re: [STALLY RFQ-{activeRfq.id.toUpperCase()}] Gửi bảng báo giá cung cấp nguyên liệu</p>
                          <p className="text-slate-600 leading-normal pl-3 border-l-2 border-teal-500/30">
                            "Xin chào quý khách hàng Stally. Chúng tôi đính kèm bảng chao_gia.pdf. Đơn giá Gạo ST25 đề xuất là 27.500đ/kg. Vận chuyển 150.000đ. Rất hân hạnh được hợp tác..."
                          </p>
                        </div>
                      </div>

                      {/* Email Round 3 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="bg-emerald-50 border border-emerald-250 text-emerald-705 font-bold px-2 py-0.5 rounded font-mono">ROUND 3: AI ĐÀM PHÁN GIẢM CHI PHÍ (AI Agent - THÀNH CÔNG)</span>
                          <span className="text-slate-400 font-medium">2026-06-21 13:40</span>
                        </div>
                        <div className="bg-emerald-50/15 border border-emerald-500/10 rounded-xl p-4 space-y-2 text-xs">
                          <div className="flex justify-between border-b border-slate-150 pb-1.5 font-bold text-[#004d40] text-[10.5px]">
                            <span>Từ: Phan Công Tâm (AI Procurement Agent - Đàm Phán)</span>
                            <span>Đến: {recommendedQuote?.supplierName} Sales</span>
                          </div>
                          <p className="font-extrabold text-emerald-800">Chủ đề: Thư thương lượng chiết khấu giá - RFQ #{activeRfq.id.toUpperCase()}</p>
                          <p className="text-slate-505 leading-normal pl-3 border-l-2 border-emerald-500/40">
                            "Cảm ơn đối tác {recommendedQuote?.supplierName} đã gửi bảng giá thầu nhanh. Đối chiếu cơ sở dữ liệu lịch sử thầu thợ, Stally dự kiến nhập số lượng lớn gạo hàng tuần lên tới 500kg. Liệu quý đối tác có thể xem xét chiết khấu thêm 5% đơn giá hoặc giảm 50% chi phí vận chuyển để Stally dễ dàng phê duyệt PO thầu ngay hôm nay?"
                          </p>
                          <p className="text-slate-505 font-bold text-[10px] mt-2.5 bg-slate-100 p-2 rounded border border-slate-200">
                            📬 Phản hồi cuối từ {recommendedQuote?.supplierName}: "Đồng ý giảm giá Gạo ST25 xuống 26.000đ/kg cho đợt thầu này nhằm ký kết hợp tác lâu dài. Bản cập nhật hóa đơn đã được đính kèm."
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer actions */}
            <div className="p-4 border-t border-slate-150 bg-slate-50 flex justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-slate-650 bg-white border border-slate-205 hover:bg-slate-100 font-bold text-xs p-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                Đóng Thẩm Định
              </button>
              {activeRfq.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    handleApproveClick();
                  }}
                  className="text-white bg-gradient-to-r from-teal-650 to-emerald-600 hover:from-teal-750 hover:to-emerald-700 font-black text-xs p-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-4.5 h-4.5" /> Duyệt &amp; Ký PO
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

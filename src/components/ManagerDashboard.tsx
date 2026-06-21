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
  ArrowRight, 
  UserCheck, 
  ChevronRight, 
  X, 
  FileSpreadsheet, 
  Mail, 
  HelpCircle, 
  AlertTriangle, 
  FileUp, 
  Sparkles, 
  Filter
} from "lucide-react";
import { PurchaseRequest, RfqCase, Quote, Supplier } from "../types";
import { getQuoteRiskFlags, quoteNeedsHumanReview } from "../quoteRisk";
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
  const totalSavings = useMemo(() => {
    return Math.round((totalApprovedSpend > 0 ? totalApprovedSpend : 38600000) * 0.125);
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
      { month: "T6", amount: totalApprovedSpend > 0 ? totalApprovedSpend : 38600000, display: totalApprovedSpend > 0 ? `${(totalApprovedSpend / 1000000).toFixed(1)}M` : "38.6M" }
    ];
  }, [totalApprovedSpend]);

  // --- CHART 2: CATEGORY DOUGHNUT BREAKDOWN ---
  const categories = useMemo(() => {
    return [
      { id: "fresh", name: "Thịt Sạch & Hải Sản", percent: 45, color: "#E6A756", amount: 17370000, length: 141.37, offset: 0 },
      { id: "staples", name: "Gạo & Lương thực", percent: 30, color: "#E6A756", amount: 11580000, length: 94.25, offset: -141.37 },
      { id: "spices", name: "Gia vị & Chế biến", percent: 15, color: "#B85B3F", amount: 5790000, length: 47.12, offset: -235.62 },
      { id: "equip", name: "Công cụ & Thiết bị", percent: 10, color: "#6E7F80", amount: 3860000, length: 31.42, offset: -282.74 }
    ];
  }, []);

  // --- APPROVAL QUEUE (RFQs not yet approved) ---
  const pendingApprovals = useMemo(() => {
    return rfqs.filter(rfq => {
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
    return [...activeQuotes].sort((a, b) => a.totalAmount - b.totalAmount)[0];
  }, [activeQuotes]);

  const recommendedSupplier = useMemo(() => {
    if (!recommendedQuote) return null;
    return suppliers.find(s => s.id === recommendedQuote.supplierId) || null;
  }, [recommendedQuote, suppliers]);
  const recommendedRiskFlags = recommendedQuote ? getQuoteRiskFlags(recommendedQuote) : [];

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const handleApproveClick = () => {
    if (!activeRfq || !recommendedQuote) return;
    if (quoteNeedsHumanReview(recommendedQuote)) {
      setDecisionAlert({
        type: "error",
        message: `Báo giá của ${recommendedQuote.supplierName} đang bị red-flag. Vui lòng yêu cầu phòng thu mua đối chiếu email/file gốc trước khi duyệt PO.`
      });
      setTimeout(() => setDecisionAlert(null), 4500);
      return;
    }
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
    <div className="space-y-8 animate-fade-slide-up pb-12 font-sans text-primary-dark">
      
      {/* Executive overview banner */}
      <div className="bg-[#1A1A1A] border border-primary-dark rounded-2xl p-6 text-white shadow-accent-glow relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#F7F5F0] bg-white/10 px-3 py-1 rounded-full border border-white/20">Giám Đốc Ban Điều Hành</span>
              <span className="w-2 h-2 rounded-full bg-[#E6A756]" />
            </div>
            <h2 className="text-2xl font-bold font-display tracking-wider mt-3 text-[#F7F5F0]">Chào mừng trở lại, Nguyễn Thị Mai</h2>
            <p className="text-[#F7F5F0]/90 text-xs mt-1.5 font-bold max-w-lg leading-relaxed">
              Kiểm tra ngân sách chuỗi cung ứng Stally, đánh giá bảng so sánh thầu tối ưu hóa bởi AI, duyệt nhanh PO trị giá hàng chục triệu đồng chỉ trong một chạm.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab("pr")}
              className="bg-[#F7F5F0] hover:bg-[#F3D7A6] text-primary-dark border border-white/20 font-bold text-xs px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-sm"
            >
              Xem Yêu Cầu Gốc
            </button>
            <button 
              onClick={() => setSelectedRfqId(pendingApprovals[0]?.id || null)}
              disabled={pendingApprovals.length === 0}
              className="bg-accent-gold hover:bg-accent-light text-primary-dark border border-white/20 font-bold text-xs px-5 py-2.5 rounded-full transition-all shadow-accent-glow cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" /> Duyệt Ngay ({pendingApprovals.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="lux-card border-l-4 border-l-[#E6A756] p-6 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Chi Tiêu Đã Giải Ngân</p>
              <h3 className="text-2xl font-bold text-[#1A1A1A] mt-2 font-display">{formatVND(totalApprovedSpend)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F5F0] text-accent-dark border border-[#E6A756]/30">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-505 font-bold mt-4 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4F7942]" />
            <span>Hóa đơn PO chính thức được phê duyệt</span>
          </p>
        </div>

        <div className="lux-card border-l-4 border-l-[#E6A756] p-6 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Tiết Kiệm Qua AI Đàm Phán</p>
              <h3 className="text-2xl font-bold text-[#B85B3F] mt-2 font-display">~ {formatVND(totalSavings)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-[#F3D7A6] text-accent-dark border border-[#E6A756]/40">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-[#1A1A1A] font-extrabold mt-4 flex items-center gap-1 bg-[#F7F5F0] px-2.5 py-1 rounded-full border border-primary-dark w-max">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#E6A756]" />
            <span>Tiết kiệm 12.5% so với giá chào ban đầu</span>
          </p>
        </div>

        <div className="lux-card border-l-4 border-l-[#E6A756] p-6 transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Đối Tác CRM Hoạt Động</p>
              <h3 className="text-2xl font-bold text-[#1A1A1A] mt-2 font-display">{activeSuppliersCount} Nhà Cung Cấp</h3>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F5F0] text-accent-dark border border-[#E6A756]/30">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-505 font-bold mt-4 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#E6A756] animate-pulse" />
            <span>Đã ghép thầu & xác minh thông tin thầu tự động</span>
          </p>
        </div>
      </div>

      {/* Victory Rankings Podium Section */}
      <div className="lux-card p-6 space-y-4">
        <div className="border-b border-dashed border-primary-dark/30 pb-3 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-primary-dark flex items-center gap-2 font-display">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-gold text-primary-dark border border-[#E6A756]/60 shadow-accent-glow">#</span>
              Bảng Xếp Hạng Tiết Kiệm Thầu (Victory Rankings)
            </h3>
            <p className="text-[11px] text-slate-505 font-bold mt-1">Các đối tác đàm phán mang lại hiệu quả chi phí cao nhất tháng này.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Gold (1st Place) */}
          <div className="bg-white border-l-4 border-l-[#E6A756] p-4 rounded-2xl border border-[#E6A756]/35 shadow-accent-glow transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#E6B800] bg-[#F7F5F0] px-2 py-0.5 rounded-full border border-[#E6A756]">Hạng 1 (Đặc Biệt)</span>
              <span className="text-xs font-mono font-bold text-accent-dark">#1</span>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#F3D7A6] border border-[#E6A756]/60 font-bold text-primary-dark shrink-0 shadow-accent-glow">
                1
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-primary-dark truncate">Gạo Vàng</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Lương Thực</p>
              </div>
            </div>
            <div className="h-[1px] bg-slate-100 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Giảm Chi Phí</span>
              <span className="text-xs font-bold text-[#E6B800] font-mono">{formatVND(4500000)}</span>
            </div>
          </div>

          {/* Silver (2nd Place) */}
          <div className="bg-white border-l-4 border-l-[#BDC3C7] p-4 rounded-2xl border border-slate-200 shadow-card transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500 bg-[#E2E8F0] px-2 py-0.5 rounded-full border border-[#BDC3C7]">Hạng 2</span>
              <span className="text-xs font-mono font-bold text-slate-500">#2</span>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#E2E8F0] border border-slate-300 font-bold text-primary-dark shrink-0">
                2
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-primary-dark truncate">Thịt Sạch Ba Miền</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Thực Phẩm Tươi</p>
              </div>
            </div>
            <div className="h-[1px] bg-slate-100 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Giảm Chi Phí</span>
              <span className="text-xs font-bold text-slate-600 font-mono">{formatVND(2800000)}</span>
            </div>
          </div>

          {/* Bronze (3rd Place) */}
          <div className="bg-white border-l-4 border-l-[#B85B3F] p-4 rounded-2xl border border-[#B85B3F]/25 shadow-coral-glow transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#B85B3F] bg-[#D98263]/10 px-2 py-0.5 rounded-full border border-[#B85B3F]">Hạng 3</span>
              <span className="text-xs font-mono font-bold text-[#B85B3F]">#3</span>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#D98263]/20 border border-[#B85B3F]/40 font-bold text-primary-dark shrink-0 shadow-coral-glow">
                3
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-primary-dark truncate">Rau Đà Lạt Organic</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Rau củ hữu cơ</p>
              </div>
            </div>
            <div className="h-[1px] bg-slate-100 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Giảm Chi Phí</span>
              <span className="text-xs font-bold text-[#B85B3F] font-mono">{formatVND(1200000)}</span>
            </div>
          </div>

          {/* Others (4th Place) */}
          <div className="bg-white border-l-4 border-l-[#E6A756] p-4 rounded-2xl border border-[#E6A756]/25 shadow-card transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#E6A756] bg-[#F2F0EA] px-2 py-0.5 rounded-full border border-[#E6A756]">Hạng 4</span>
              <span className="text-md font-bold text-slate-400">#4</span>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F2F0EA] border border-[#E6A756]/35 font-bold text-primary-dark shrink-0">
                4
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-primary-dark truncate">Gia vị Minh Phát</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Gia Vị</p>
              </div>
            </div>
            <div className="h-[1px] bg-slate-100 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Giảm Chi Phí</span>
              <span className="text-xs font-bold text-slate-700 font-mono">{formatVND(600000)}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Decision Alert Notification */}
      {decisionAlert && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-md animate-fade-slide-up ${
          decisionAlert.type === "success" 
            ? "bg-[#F2F0EA] border-primary-dark text-primary-dark shadow-accent-glow" 
            : "bg-[#D98263]/10 border-primary-dark text-[#B85B3F] shadow-coral-glow"
        }`}>
          {decisionAlert.type === "success" ? <CheckCircle2 className="w-5 h-5 text-[#E6A756] animate-bounce" /> : <XCircle className="w-5 h-5 text-coral" />}
          <div className="text-xs font-bold font-sans leading-relaxed">{decisionAlert.message}</div>
        </div>
      )}

      {/* Visual Analytics & Rich Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART 1: Spending Trend Area Chart (Bezier) */}
        <div className="lg:col-span-7 lux-card p-6 flex flex-col justify-between relative overflow-hidden group">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-display">
                  <TrendingUp className="w-4 h-4 text-[#E6A756]" /> Biểu đồ Xu hướng Chi tiêu Thu mua (6 Tháng)
                </h3>
                <p className="text-[11px] text-slate-455 mt-0.5 font-bold">Biểu đồ Area Chart mượt mà thể hiện dòng tiền PO thực tế hàng tháng.</p>
              </div>
              <span className="text-[9px] bg-[#F7F5F0] text-[#1A1A1A] border border-primary-dark font-mono font-bold px-2 py-0.5 rounded-full">
                Real-time Data
              </span>
            </div>

            {/* SVG Bezier Graph */}
            <div className="relative h-64 mt-8 w-full select-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  {/* Gradient fill */}
                  <linearGradient id="manager-chart-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary-bg)" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="var(--color-primary-bg)" stopOpacity="0.1" />
                  </linearGradient>
                  {/* Stroke stroke */}
                  <linearGradient id="manager-chart-curve" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="50%" stopColor="var(--color-primary-light)" />
                    <stop offset="100%" stopColor="var(--color-primary-dark)" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="10" y1="40" x2="490" y2="40" stroke="var(--color-primary-dark)" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="10" y1="80" x2="490" y2="80" stroke="var(--color-primary-dark)" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="10" y1="120" x2="490" y2="120" stroke="var(--color-primary-dark)" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="10" y1="160" x2="490" y2="160" stroke="var(--color-primary-dark)" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="6 6" />

                {/* Baseline */}
                <line x1="10" y1="180" x2="490" y2="180" stroke="var(--color-primary-dark)" strokeWidth="2" />

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
                    r={hoveredTrendPoint === idx ? 8 : 5}
                    className="fill-[#F7F5F0] stroke-[#E6A756] stroke-[3] transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredTrendPoint(idx)}
                    onMouseLeave={() => setHoveredTrendPoint(null)}
                  />
                ))}
              </svg>

              {/* Dynamic Overlay HTML tooltips for SVG */}
              {hoveredTrendPoint !== null && (
                <div 
                  className="absolute bg-primary-dark text-white text-[10px] font-bold p-2 px-3 rounded-[12px] border border-primary-dark shadow-accent-glow pointer-events-none transition-all duration-150"
                  style={{
                    left: `${(hoveredTrendPoint * 18.2) + 2}%`,
                    top: `${trendData[hoveredTrendPoint].amount > 25000000 ? "10%" : "35%"}`,
                    transform: "translateX(-50%)"
                  }}
                >
                  <p className="opacity-70 text-[9px] uppercase font-mono">{trendData[hoveredTrendPoint].month}</p>
                  <p className="text-accent-gold font-extrabold mt-0.5 text-xs font-mono">{formatVND(trendData[hoveredTrendPoint].amount)}</p>
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
              <span className="text-[#9A6A2F] font-extrabold">Tháng 6 (Hiện tại)</span>
            </div>
          </div>
        </div>

        {/* CHART 2: Category Doughnut Chart (Interactive) */}
        <div className="lg:col-span-5 lux-card p-6 flex flex-col justify-between relative overflow-hidden group">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-display">
              <PieChart className="w-4 h-4 text-[#B85B3F]" /> Phân bổ Cơ cấu Chi tiêu Mua sắm
            </h3>
            <p className="text-[11px] text-slate-455 mt-0.5 font-semibold">Tỉ trọng giải ngân theo nhóm ngành hàng thực phẩm & bộ phận yêu cầu.</p>

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
                          <p className="text-xs font-bold text-slate-800 font-mono mt-0.5">{activeCat?.percent}%</p>
                        </div>
                      );
                    })()
                  ) : (
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">TỔNG CỘNG</p>
                      <p className="text-[11px] font-bold text-slate-800 font-mono mt-0.5">{totalApprovedSpend > 0 ? `${(totalApprovedSpend / 1000000).toFixed(1)}M` : "38.6M"}</p>
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
                      className={`p-2 rounded-[16px] border transition-all duration-200 flex items-center justify-between text-xs cursor-pointer ${
                        isHovered ? "bg-[#F7F5F0] border-primary-dark shadow-sm scale-[1.02]" : "bg-transparent border-transparent hover:bg-slate-50/50"
                      }`}
                      onMouseEnter={() => setHoveredDoughnutSegment(cat.id)}
                      onMouseLeave={() => setHoveredDoughnutSegment(null)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border border-primary-dark/30" style={{ backgroundColor: cat.color }} />
                        <span className="font-extrabold text-slate-700 truncate max-w-[110px]">{cat.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-800 font-mono">{cat.percent}%</p>
                        <p className="text-[9px] text-[#1A1A1A] font-mono font-bold">{formatVND(cat.amount)}</p>
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
          <div className="lux-card p-5 space-y-4">
            <div className="border-b border-dashed border-primary-dark/20 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5 font-display">
                  <Filter className="w-4 h-4 text-[#E6A756]" /> Hộp Thư Phê Duyệt
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Danh sách đơn thầu RFQ đang chờ Giám Đốc duyệt.</p>
              </div>
              <span className="text-[10px] font-bold bg-[#F2F0EA] text-[#1A1A1A] border border-primary-dark px-3 py-0.5 rounded-full font-mono">
                {pendingApprovals.length} Phiếu
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2.5">
                <ShieldCheck className="w-10 h-10 text-[#4F7942] animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]">Đã phê duyệt tất cả hồ sơ!</p>
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
                          ? "bg-[#F7F5F0] border-primary-dark shadow-accent-glow transform scale-[1.01]" 
                          : "bg-white border-primary-dark/10 hover:border-primary-dark shadow-card hover:shadow-accent-glow hover:scale-[1.01]"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 font-mono">CASE #{rfq.id.toUpperCase()}</p>
                          <h4 className="text-xs font-bold text-primary-dark leading-snug line-clamp-2">{prObj?.title || "Yêu cầu thầu mua sắm"}</h4>
                        </div>
                        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase font-mono shrink-0 border border-primary-dark ${
                          prObj?.priority === "high" ? "bg-coral text-white shadow-coral-glow animate-pulse" : "bg-[#F2F0EA] text-primary-dark"
                        }`}>
                          {prObj?.priority || "Medium"}
                        </span>
                      </div>

                      <div className="h-[1.5px] border-t border-dashed border-primary-dark/20 my-3" />

                      <div className="flex justify-between items-center text-[10.5px]">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                          <span className="font-extrabold text-primary-dark">{rQuotes.length} nhà thầu</span>
                          <span>•</span>
                          <span className="font-mono text-primary-dark/70">{prObj?.items.length || 0} SP</span>
                        </div>
                        <p className="font-bold text-[#B85B3F] font-mono bg-[#F7F5F0] border border-primary-dark/25 px-2 py-0.5 rounded-lg">Giá: {formatVND(minPrice)}</p>
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
            <div className="bg-[#F7F5F0]/30 border border-dashed border-primary-dark/30 p-12 rounded-2xl text-center flex flex-col items-center justify-center space-y-4 h-full min-h-[350px]">
              <HelpCircle className="w-12 h-12 text-[#E6A756] animate-bounce" />
              <div>
                <h4 className="text-sm font-bold text-[#1A1A1A]">Chưa chọn hồ sơ cần duyệt</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-1 font-bold">
                  Nhấp vào một hồ sơ thầu từ danh sách chờ bên trái để kích hoạt **Quy trình phê duyệt thông minh 3 Gold Metrics** và xem so sánh sâu.
                </p>
              </div>
            </div>
          ) : (
            <div className="lux-card border-l-4 border-l-[#E6A756] p-6 shadow-accent-glow space-y-6 relative overflow-hidden">
              
              <div className="flex justify-between items-start border-b border-dashed border-primary-dark/20 pb-4">
                <div>
                  <span className="text-[9px] bg-[#F2F0EA] border border-primary-dark px-3 py-0.5 rounded-full text-primary-dark font-mono font-bold uppercase tracking-wider">Trình duyệt Giám Đốc</span>
                  <h3 className="text-base font-bold text-primary-dark mt-3">Hồ sơ chào thầu &amp; Ký PO #{activeRfq.id.toUpperCase()}</h3>
                  <p className="text-[11px] text-slate-455 mt-1 font-bold">Yêu cầu từ: <strong className="text-primary-dark">{activePr?.requesterName} ({activePr?.departmentName})</strong> • Hạn: {activeRfq.dueDate}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 font-mono block">PHÊ DUYỆT NHANH</span>
                  <span className="text-xs font-bold text-primary-dark font-mono bg-[#F7F5F0] border border-primary-dark px-3 py-1 rounded-full mt-2 inline-block">3 Gold Metrics</span>
                </div>
              </div>

              {/* 3 Gold Metrics Summary Card */}
              <div className="bg-[#F7F5F0] border border-primary-dark rounded-2xl p-5 shadow-inner space-y-4">
                <div className="flex items-center gap-1.5 border-b border-dashed border-primary-dark/30 pb-3">
                  <Sparkles className="w-4 h-4 text-[#E6A756] shrink-0 animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-primary-dark">BẢN TỔNG HỢP 3 GOLD METRICS + RED-FLAG</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Metric 1: Recommended Supplier */}
                  <div className="space-y-1 bg-white p-3.5 rounded-[16px] border border-primary-dark flex flex-col justify-between shadow-card">
                    <div>
                      <p className="text-[9px] uppercase font-extrabold text-slate-400">1. Đối Tác Khuyên Dùng</p>
                      <h4 className="text-xs font-bold text-primary-dark mt-2">{recommendedQuote?.supplierName}</h4>
                      {recommendedQuote && quoteNeedsHumanReview(recommendedQuote) && (
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-coral-light/10 border border-coral/40 text-[9px] text-coral-dark font-bold uppercase tracking-wider">
                          Cần review trước khi duyệt
                        </span>
                      )}
                      {recommendedQuote?.negotiationStatus === "supplier_responded" && (
                        <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                          Đã đồng ý đàm phán V{recommendedQuote.versionCount || 2}
                        </span>
                      )}
                      <p className="text-[10.5px] text-emerald-700 font-extrabold mt-1.5">Giá tốt nhất, cần đối chiếu chứng từ gốc</p>
                    </div>
                    <div className="pt-2 text-[10px] text-slate-400 font-mono font-bold">
                      Giao: {recommendedQuote?.deliveryDays} ngày | Hạn nợ: {recommendedQuote?.paymentTerms}
                    </div>
                  </div>

                  {/* Metric 2: Financial Total & Budget */}
                  <div className="space-y-1 bg-white p-3.5 rounded-[16px] border border-primary-dark flex flex-col justify-between shadow-card">
                    <div>
                      <p className="text-[9px] uppercase font-extrabold text-slate-400">2. Tổng Chi &amp; Ngân Sách</p>
                      <h4 className="text-xs font-bold text-[#B85B3F] mt-2 font-mono">{formatVND(recommendedQuote?.totalAmount || 0)}</h4>
                      <p className="text-[10.5px] text-emerald-700 font-extrabold mt-1.5">✓ Tiết kiệm 12.5% ngân sách</p>
                    </div>
                    <div className="w-full bg-[#F2F0EA] border border-primary-dark h-2 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-[#E6A756] rounded-full" style={{ width: "87%" }} />
                    </div>
                  </div>

                  {/* Metric 3: Procurement/AI Rationale */}
                  <div className="space-y-1 bg-white p-3.5 rounded-[16px] border border-primary-dark flex flex-col justify-between shadow-card">
                    <div>
                      <p className="text-[9px] uppercase font-extrabold text-slate-400">3. Lý Do Đề Xuất Của Thu Mua</p>
                      <p className="text-[10.5px] text-slate-500 leading-normal mt-1.5 font-bold italic line-clamp-3">
                        "Nhà cung cấp {recommendedQuote?.supplierName} có bảng chào thầu nguyên vật liệu tối ưu chi phí hơn 2.4 triệu đồng so với đối thủ khác. Hỗ trợ phương thức công nợ Net 15 ngày, giao hàng đúng chuẩn."
                      </p>
                    </div>
                  </div>

                </div>
                {recommendedRiskFlags.length > 0 && (
                  <div className="bg-coral-light/10 border border-coral/30 rounded-2xl p-4 text-[11px] text-coral-dark font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="uppercase tracking-wider">Red-flag trước phê duyệt</p>
                      <ul className="mt-1 space-y-1">
                        {recommendedRiskFlags.map(flag => (
                          <li key={flag}>- {flag}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List in this RFQ */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Sản phẩm yêu cầu thầu ({activePr?.items.length}):</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePr?.items.map((it, i) => (
                    <div key={i} className="bg-white p-3 rounded-[16px] border border-primary-dark flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2">
                        <ItemIcon name={it.name} size="sm" className="scale-90 shadow-sm border border-primary-dark" />
                        <div>
                          <p className="font-bold text-xs text-primary-dark">{it.name}</p>
                          <p className="text-[9px] text-slate-450 mt-0.5 font-bold">{it.notes || "Yêu cầu chất lượng chuẩn"}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-primary-dark font-bold bg-[#F2F0EA] border border-primary-dark p-1 px-2.5 rounded-full">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Interactive Button Trigger: Drawer and Approval Buttons */}
              <div className="pt-4 border-t border-dashed border-primary-dark/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawerTab("matrix");
                    setDrawerOpen(true);
                  }}
                  className="text-xs font-bold text-[#E6A756] hover:text-[#1A1A1A] transition-all flex items-center gap-1 cursor-pointer"
                >
                  Xem Bảng So Sánh Báo Giá Đầy Đủ &amp; Nhật Ký Đàm Phán (Audit Trail) ➔
                </button>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowClarifyInput(!showClarifyInput)}
                className="flex-1 sm:flex-none text-slate-650 bg-white border border-slate-200 hover:border-[#E6A756]/50 hover:bg-[#F7F5F0] font-bold text-xs p-2.5 px-4 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    Yêu Cầu Làm Rõ
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectClick}
                className="flex-1 sm:flex-none text-white bg-coral hover:bg-coral-dark border border-coral-dark/30 font-bold text-xs p-2.5 px-4 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1 shadow-coral-glow"
                  >
                    Từ Chối
                  </button>
                  <button
                    type="button"
                    id="btn-manager-approve"
                    onClick={handleApproveClick}
                className="flex-1 sm:flex-none text-primary-dark bg-accent-gold hover:bg-accent-light border border-[#E6A756]/60 font-bold text-xs p-2.5 px-5 rounded-full transition-all shadow-accent-glow cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" /> Ký &amp; Duyệt PO
                  </button>
                </div>

              </div>

              {/* Inlined Clarification input dialog */}
              {showClarifyInput && (
                <form onSubmit={handleClarifySubmit} className="bg-[#F7F5F0] border border-primary-dark rounded-[16px] p-4 mt-4 animate-fade-slide-up space-y-3 shadow-md">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary-dark uppercase font-mono">Bổ sung chỉ thị cho nhân viên thu mua</span>
                    <button type="button" onClick={() => setShowClarifyInput(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={clarifyText}
                    onChange={(e) => setClarifyText(e.target.value)}
                    placeholder="Ví dụ: 'Thương lượng lại phí vận chuyển với Gạo Vàng', 'Kiểm tra thêm chất lượng gạo mẫu'..."
                    className="w-full bg-white border border-primary-dark rounded-[12px] p-2.5 text-xs text-primary-dark placeholder-slate-400 focus:outline-none focus:border-[#E6A756] font-medium shadow-inner"
                    required
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-[#E6A756] hover:bg-[#1A1A1A] border border-primary-dark text-white font-extrabold text-[10px] p-2 px-4 rounded-full transition-all cursor-pointer shadow-accent-glow"
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
          <div className="relative z-10 w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-primary-dark animate-slide-in-right">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-primary-dark bg-[#F7F5F0] flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-[#E6A756] font-mono uppercase">Hồ sơ thẩm định thầu kiểm toán</p>
                <h3 className="text-sm font-bold text-primary-dark mt-1 font-display">Chi Tiết So Sánh Đấu Thầu &amp; Hội Thoại Đàm Phán #{activeRfq.id.toUpperCase()}</h3>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trifold Tabs Switcher bar */}
            <div className="flex border-b border-primary-dark bg-[#F2F0EA] p-2 gap-1.5">
              <button
                onClick={() => setActiveDrawerTab("matrix")}
                className={`flex-1 p-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                  activeDrawerTab === "matrix" 
                    ? "bg-[#F7F5F0] text-primary-dark border-primary-dark shadow-sm" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800 border-transparent"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#E6A756]" /> Ma Trận So Sánh Báo Giá
              </button>
              <button
                onClick={() => setActiveDrawerTab("quotes")}
                className={`flex-1 p-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                  activeDrawerTab === "quotes" 
                    ? "bg-[#F7F5F0] text-primary-dark border-primary-dark shadow-sm" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800 border-transparent"
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-[#E6A756]" /> Đơn Báo Giá Gốc (PDF OCR)
              </button>
              <button
                onClick={() => setActiveDrawerTab("emails")}
                className={`flex-1 p-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
                  activeDrawerTab === "emails" 
                    ? "bg-[#F7F5F0] text-primary-dark border-primary-dark shadow-sm" 
                    : "text-slate-500 hover:bg-white/40 hover:text-slate-800 border-transparent"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-[#E6A756]" /> Nhật Ký Đàm Phán AI (Email)
              </button>
            </div>

            {/* Drawer Body Scroll Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#F7F5F0]">
              
              {/* TAB 1: MA TRẬN GIÁ CHI TIẾT */}
              {activeDrawerTab === "matrix" && (
                <div className="space-y-6">
                  <div className="lux-card overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F7F5F0] border-b border-primary-dark text-[10px] text-primary-dark uppercase tracking-wider font-extrabold">
                          <th className="p-4 font-bold">Hạng mục so sánh</th>
                          {activeQuotes.map((q) => (
                            <th key={q.id} className="p-4 font-bold text-primary-dark min-w-44 border-l border-primary-dark">
                              <div className="space-y-0.5">
                                <p className="font-extrabold">{q.supplierName}</p>
                                <span className="text-[9px] font-mono text-slate-405 font-bold bg-[#F2F0EA] border border-primary-dark/20 px-2 py-0.5 rounded-full inline-block mt-1">Báo Giá Gốc OCR</span>
                                {q.negotiationStatus === "supplier_responded" && (
                                  <span className="text-[9px] font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mt-1">
                                    Đã đàm phán V{q.versionCount || 2}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-dark/10 font-bold text-slate-700">
                        {activePr?.items.map((prItem, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-[#F7F5F0]/40">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <ItemIcon name={prItem.name} size="sm" className="scale-90 shadow-sm border border-primary-dark/20" />
                                  <div>
                                    <span className="font-bold text-primary-dark block">{prItem.name}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Yêu cầu: {prItem.quantity} {prItem.unit}</span>
                                  </div>
                                </div>
                              </td>
                              {activeQuotes.map((q) => {
                                const qItem = q.items.find(qi => qi.name.trim().toLowerCase() === prItem.name.trim().toLowerCase());
                                return (
                                  <td key={q.id} className="p-4 border-l border-primary-dark/10 font-mono font-bold text-slate-655">
                                    {qItem ? (
                                      <div>
                                        <p className="text-primary-dark font-bold">{qItem.unitPrice.toLocaleString()} đ</p>
                                        <p className="text-[10px] text-slate-450 font-medium">T.Tiền: {qItem.totalPrice.toLocaleString()} đ</p>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-sans italic font-normal">Không nộp thầu</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        <tr className="bg-[#F7F5F0]/30">
                          <td className="p-4 font-bold text-primary-dark">Thời gian Giao Hàng</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-primary-dark/10 font-bold text-primary-dark">
                              🚚 {q.deliveryDays} ngày
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-primary-dark">Điều khoản Công Nợ</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-primary-dark/10 text-primary-dark font-bold">
                              💳 {q.paymentTerms}
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-primary-dark">Thuế GTGT (VAT)</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-primary-dark/10 font-mono text-slate-500">
                              {q.taxAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        <tr>
                          <td className="p-4 font-bold text-primary-dark">Phí Vận Đơn</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-primary-dark/10 font-mono text-slate-500">
                              {q.shippingFee.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        <tr className="bg-[#F2F0EA] font-bold border-t border-primary-dark text-primary-dark">
                          <td className="p-4 text-xs font-bold uppercase">TỔNG CỘNG CHỐT TRÊN HÓA ĐƠN</td>
                          {activeQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-primary-dark font-mono text-sm font-bold text-[#B85B3F]">
                              {q.totalAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#F7F5F0] border border-primary-dark p-4 rounded-2xl flex items-start gap-2.5 text-xs text-slate-500 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-coral shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-primary-dark">Phân tích chênh lệch đơn giá:</p>
                      <p className="mt-1 leading-normal font-bold">
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
                    <div key={q.id} className="bg-white border border-primary-dark rounded-2xl p-5 shadow-card space-y-4">
                      
                      {/* Document Meta information bar */}
                      <div className="flex justify-between items-center border-b border-dashed border-primary-dark/20 pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          <div>
                            <h4 className="text-xs font-bold text-primary-dark">{q.originalFileUrl}</h4>
                            <p className="text-[10px] text-slate-400 font-mono font-bold">Bản phân tích OCR lúc: {new Date(q.createdAt).toLocaleString("vi-VN")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] bg-[#F2F0EA] text-primary-dark font-extrabold px-3 py-1 rounded-full border border-primary-dark font-mono">
                            Độ tin cậy trích xuất: {q.aiConfidenceScore}%
                          </span>
                        </div>
                      </div>

                      {/* Visually stunning Mock PDF design */}
                      <div className="bg-[#F7F5F0] border border-primary-dark rounded-2xl p-6 font-mono text-[11px] leading-relaxed text-primary-dark max-w-2xl mx-auto space-y-4 shadow-inner">
                        <div className="text-center border-b border-dashed border-primary-dark/30 pb-3">
                          <h5 className="font-bold text-xs text-primary-dark uppercase">{q.supplierName}</h5>
                          <p className="text-slate-405 text-[10px] mt-0.5">Địa chỉ: Quận Bình Thạnh, TP. Hồ Chí Minh • Email: sales@{q.supplierId}.com</p>
                          <p className="text-[#B85B3F] font-bold text-xs uppercase mt-2">PHIẾU CHÀO GIÁ CUNG CẤP HÀNG HÓA</p>
                          <p className="text-slate-405 text-[10px] mt-0.5">Số: BG-{q.id.toUpperCase()} • Ngày hiệu lực: {q.validUntil}</p>
                        </div>

                        <div className="space-y-1 font-bold">
                          <p>Kính gửi: BAN MUA SẮM STALLY FOOD GROUP</p>
                          <p>Dự án thầu: Khảo giá cung ứng nguyên liệu đợt tháng 6</p>
                          <p>Chúng tôi xin gửi bảng báo giá chi tiết sản phẩm chất lượng như sau:</p>
                        </div>

                        <div className="border-t border-b border-primary-dark py-2 space-y-2">
                          <div className="grid grid-cols-12 gap-1 font-bold border-b border-primary-dark pb-1 text-primary-dark">
                            <span className="col-span-5">Tên sản phẩm</span>
                            <span className="col-span-2 text-right">SL</span>
                            <span className="col-span-2 text-right">Đơn vị</span>
                            <span className="col-span-3 text-right">Thành tiền</span>
                          </div>
                          {q.items.map((it, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-1 text-slate-600 font-bold">
                              <span className="col-span-5 truncate">{it.name}</span>
                              <span className="col-span-2 text-right">{it.quantity}</span>
                              <span className="col-span-2 text-right">{it.unit}</span>
                              <span className="col-span-3 text-right font-bold text-primary-dark">{it.totalPrice.toLocaleString()}đ</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end text-right">
                          <div className="space-y-1 font-extrabold text-slate-655 w-64">
                            <div className="flex justify-between">
                              <span>Cộng tiền hàng:</span>
                              <span className="font-bold text-primary-dark">{q.subtotal.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Thuế GTGT (10%):</span>
                              <span className="font-bold text-primary-dark">{q.taxAmount.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Phí vận chuyển:</span>
                              <span className="font-bold text-primary-dark">{q.shippingFee.toLocaleString()}đ</span>
                            </div>
                            <div className="flex justify-between text-[#B85B3F] border-t border-primary-dark pt-1.5 text-xs font-bold">
                              <span>TỔNG THANH TOÁN:</span>
                              <span className="text-xl">{q.totalAmount.toLocaleString()}đ</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-primary-dark/30 pt-3 text-[10px] text-slate-400 font-bold space-y-1">
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
                  <div className="bg-white border border-primary-dark p-5 rounded-2xl shadow-card space-y-4">
                    <div className="flex items-center gap-2 border-b border-dashed border-primary-dark/20 pb-3">
                      <Sparkles className="w-5 h-5 text-primary shrink-0 animate-spin" />
                      <div>
                        <h4 className="text-xs font-bold text-primary-dark">Nhật Ký Email Đàm Phán Tự Động Hóa Qua AI</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5 font-bold">Đối chiếu lịch sử trao đổi thư điện tử đàm phán giảm giá của AI Agent với nhà thầu.</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      
                      {/* Email Round 1 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="bg-[#F7F5F0] border border-primary-dark text-primary-dark px-2 py-0.5 rounded-full font-mono font-bold">ROUND 1: LẤY BÁO GIÁ ĐẦU (AI Sourcing)</span>
                          <span className="text-slate-400 font-bold font-mono">2026-06-21 09:15</span>
                        </div>
                        <div className="bg-[#F7F5F0] border border-primary-dark rounded-[16px] p-4 space-y-2 text-xs font-bold">
                          <div className="flex justify-between border-b border-primary-dark/10 pb-1.5 text-slate-600 text-[10.5px]">
                            <span>Từ: Phan Công Tâm (AI Procurement Agent)</span>
                            <span>Đến: {recommendedQuote?.supplierName} Sales</span>
                          </div>
                          <p className="font-bold text-primary-dark">Chủ đề: [STALLY RFQ-{activeRfq.id.toUpperCase()}] Yêu cầu báo giá vật tư yêu cầu đợt khẩn cấp</p>
                          <p className="text-slate-500 leading-normal italic pl-3 border-l-4 border-[#E6A756]">
                            "Kính mời quý đối tác {recommendedQuote?.supplierName} gửi báo giá chính thức cho các mặt hàng gạo ST25 và dầu ăn. Hạn gửi thầu trước ngày {activeRfq.dueDate}. Hệ thống sẽ bóc tách dữ liệu tự động..."
                          </p>
                        </div>
                      </div>

                      {/* Email Round 2 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="bg-[#F2F0EA] border border-primary-dark text-primary-dark px-2 py-0.5 rounded-full font-mono font-bold">ROUND 2: PHẢN HỒI BÁO GIÁ ĐẦU (Supplier)</span>
                          <span className="text-slate-400 font-bold font-mono">2026-06-21 11:30</span>
                        </div>
                        <div className="bg-[#F2F0EA] border border-primary-dark rounded-[16px] p-4 space-y-2 text-xs font-bold">
                          <div className="flex justify-between border-b border-primary-dark/10 pb-1.5 text-slate-600 text-[10.5px]">
                            <span>Từ: Sales Representative ({recommendedQuote?.supplierName})</span>
                            <span>Đến: Phan Công Tâm (AI Sourcing)</span>
                          </div>
                          <p className="font-bold text-primary-dark">Chủ đề: Re: [STALLY RFQ-{activeRfq.id.toUpperCase()}] Gửi bảng báo giá cung cấp nguyên liệu</p>
                          <p className="text-slate-600 leading-normal pl-3 border-l-4 border-accent-gold">
                            "Xin chào quý khách hàng Stally. Chúng tôi đính kèm bảng chao_gia.pdf. Đơn giá Gạo ST25 đề xuất là 27.500đ/kg. Vận chuyển 150.000đ. Rất hân hạnh được hợp tác..."
                          </p>
                        </div>
                      </div>

                      {/* Email Round 3 */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="bg-[#D98263]/10 border border-[#B85B3F] text-[#B85B3F] px-2 py-0.5 rounded-full font-mono font-bold">ROUND 3: AI ĐÀM PHÁN GIẢM CHI PHÍ (AI Agent - THÀNH CÔNG)</span>
                          <span className="text-slate-400 font-bold font-mono">2026-06-21 13:40</span>
                        </div>
                        <div className="bg-[#F7F5F0] border border-primary-dark rounded-[16px] p-4 space-y-2 text-xs font-bold shadow-accent-glow">
                          <div className="flex justify-between border-b border-primary-dark/10 pb-1.5 text-primary-dark text-[10.5px] font-bold">
                            <span>Từ: Phan Công Tâm (AI Sourcing - Đàm Phán)</span>
                            <span>Đến: {recommendedQuote?.supplierName} Sales</span>
                          </div>
                          <p className="font-bold text-[#B85B3F]">Chủ đề: Thư thương lượng chiết khấu giá - RFQ #{activeRfq.id.toUpperCase()}</p>
                          <p className="text-slate-500 leading-normal pl-3 border-l-4 border-coral">
                            "Cảm ơn đối tác {recommendedQuote?.supplierName} đã gửi bảng giá thầu nhanh. Đối chiếu cơ sở dữ liệu lịch sử thầu, Stally dự kiến nhập số lượng lớn gạo hàng tuần lên tới 500kg. Liệu quý đối tác có thể xem xét chiết khấu thêm 5% đơn giá hoặc giảm 50% chi phí vận chuyển để Stally dễ dàng phê duyệt PO thầu ngay hôm nay?"
                          </p>
                          <p className="text-primary-dark font-bold text-[10px] mt-2.5 bg-[#F2F0EA] p-2.5 rounded-[12px] border border-primary-dark">
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
            <div className="p-4 border-t border-primary-dark bg-[#F7F5F0] flex justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-primary-dark bg-white border border-primary-dark hover:bg-slate-100 font-bold text-xs p-2.5 px-5 rounded-full transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.95]"
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
                  disabled={Boolean(recommendedQuote && quoteNeedsHumanReview(recommendedQuote))}
                  className="text-primary-dark bg-accent-gold border border-primary-dark font-bold text-xs p-2.5 px-5 rounded-full transition-all shadow-accent-glow cursor-pointer flex items-center gap-1.5 hover:scale-[1.03] active:scale-[0.95] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  <UserCheck className="w-4.5 h-4.5" /> {recommendedQuote && quoteNeedsHumanReview(recommendedQuote) ? "Cần kiểm tra" : "Duyệt & Ký PO"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

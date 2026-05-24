import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Sparkles, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  SlidersHorizontal,
  ChevronRight,
  GitPullRequest,
  Send,
  Coins,
  ShieldCheck,
  FileCheck,
  Calendar,
  Building,
  Info,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { UserRole, ProcurementCase, PurchaseRequestItem } from "../types";

interface ProcurementDashboardProps {
  currentRole: UserRole;
  orgId: string;
  onSelectCase: (caseId: string) => void;
  // Shared handlers from parent if available
}

export default function ProcurementDashboard({ 
  currentRole, 
  orgId, 
  onSelectCase 
}: ProcurementDashboardProps) {

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ProcurementCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeLane, setActiveLane] = useState<string>("all");
  
  // Creation modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newRequiredDate, setNewRequiredDate] = useState("");
  const [initialItems, setInitialItems] = useState<Array<{ name: string; quantity: number; unit: string; notes: string }>>([
    { name: "", quantity: 1, unit: "kg", notes: "" }
  ]);
  const [creating, setCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/cases`, {
        headers: { "X-Organization-Id": orgId }
      });
      const data = await res.json();
      setCases(data.data || []);
      setLoading(false);
    } catch (e) {
      console.error(e);
      showToast("Không thể tải danh sách hồ sơ thầu.", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // ----------------------------------------------------
  // KANBAN LANES DEFINITIONS
  // ----------------------------------------------------
  const lanes = [
    {
      id: "intake",
      title: "Đón nhận & Xác minh",
      desc: "Standardize & Audit",
      statuses: ["draft_request", "request_submitted", "request_validating"],
      bgColor: "bg-slate-50/70 border-slate-200/60",
      accentColor: "border-t-slate-400 text-slate-600 bg-slate-100/65"
    },
    {
      id: "sourcing",
      title: "Chào thầu & RFQ",
      desc: "Match & Broadcast RFQs",
      statuses: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"],
      bgColor: "bg-sky-50/30 border-sky-100",
      accentColor: "border-t-sky-400 text-sky-700 bg-sky-50/80"
    },
    {
      id: "negotiation",
      title: "Thương thảo giá",
      desc: "AI negotiation v2",
      statuses: ["quote_review", "comparison_ready", "negotiating"],
      bgColor: "bg-[#e0f2f1]/20 border-[#b2dfdb]/40",
      accentColor: "border-t-teal-500 text-teal-700 bg-[#e0f2f1]/50"
    },
    {
      id: "approval",
      title: "Phê duyệt PO",
      desc: "Manager signature",
      statuses: ["pending_approval", "approved", "po_draft"],
      bgColor: "bg-amber-50/20 border-amber-100/70",
      accentColor: "border-t-amber-400 text-amber-700 bg-amber-50/60 animate-pulse"
    },
    {
      id: "fulfillment",
      title: "Nhập kho & Đóng",
      desc: "Receipt & Settlement",
      statuses: ["po_sent", "receiving", "closed", "cancelled", "exception"],
      bgColor: "bg-emerald-50/15 border-emerald-100/60",
      accentColor: "border-t-emerald-400 text-emerald-700 bg-emerald-50/50"
    }
  ];

  // ----------------------------------------------------
  // FILTER LOGIC
  // ----------------------------------------------------
  const filteredCases = cases.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  // Calculate high level KPI totals
  const totalActiveCases = cases.filter(c => c.status !== "closed" && c.status !== "cancelled").length;
  const pendingApprovalCount = cases.filter(c => c.status === "pending_approval").length;
  const exceptionCount = cases.filter(c => c.status === "exception").length;
  const totalCompletedCount = cases.filter(c => c.status === "closed").length;

  // ----------------------------------------------------
  // CREATION HANDLER
  // ----------------------------------------------------
  const handleAddInitialItem = () => {
    setInitialItems(prev => [...prev, { name: "", quantity: 1, unit: "kg", notes: "" }]);
  };

  const handleRemoveInitialItem = (idx: number) => {
    if (initialItems.length === 1) return;
    setInitialItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemFieldChange = (idx: number, field: string, val: any) => {
    setInitialItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleCreateCase = async () => {
    if (!newTitle) {
      showToast("Vui lòng nhập tên hồ sơ mua sắm.", "error");
      return;
    }
    const cleanItems = initialItems.filter(it => it.name.trim() !== "");
    if (cleanItems.length === 0) {
      showToast("Vui lòng thêm ít nhất 1 mặt hàng có tên.", "error");
      return;
    }

    setCreating(true);
    try {
      // 1. Create the base case container
      const res = await fetch(`/api/v1/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          requiredDate: newRequiredDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          requesterName: "Bếp Trưởng Bình",
          departmentName: "Bộ phận Bếp STALLY",
          createdFrom: "manual",
          items: cleanItems
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      showToast("Đã khởi tạo quy trình thầu sắm Case mới thành công!", "success");
      setShowCreateModal(false);
      setNewTitle("");
      setInitialItems([{ name: "", quantity: 1, unit: "kg", notes: "" }]);
      fetchCases();
    } catch (e: any) {
      showToast(e.message || "Không thể tạo hồ sơ thầu.", "error");
    } finally {
      setCreating(false);
    }
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case "urgent": return "bg-rose-50 text-rose-700 border-rose-200";
      case "high": return "bg-amber-50 text-amber-700 border-amber-200";
      case "medium": return "bg-teal-50 text-teal-700 border-teal-200";
      default: return "bg-slate-50 text-slate-650 border-slate-200";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return "Khẩn 🚨";
      case "high": return "Cao ⚠️";
      case "medium": return "Vừa";
      default: return "Thấp";
    }
  };

  const getStatusSimpleLabel = (s: string) => {
    const map: Record<string, string> = {
      draft_request: "Yêu cầu nháp",
      request_submitted: "Đã gửi yêu cầu",
      request_validating: "Đang xác minh",
      supplier_matching: "Đang khớp NCC",
      rfq_draft: "Đang soạn RFQ",
      rfq_sent: "Đã phát RFQ",
      collecting_quotes: "Chờ báo giá",
      quote_review: "Đang duyệt giá",
      comparison_ready: "Sẵn so sánh",
      negotiating: "Đàm phán AI",
      pending_approval: "Chờ CEO Duyệt",
      approved: "Đã duyệt",
      po_draft: "Lập PO nháp",
      po_sent: "Đã gửi PO",
      receiving: "Đang nhận hàng",
      closed: "Đã hoàn thành",
      cancelled: "Đã hủy",
      exception: "Lỗi nghiệp vụ"
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-6 animate-fade-slide-up select-none">
      
      {/* Toast popup */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border text-xs max-w-sm transition-all duration-300 ${
          toastMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span className="font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* KPI summaries with Premium card design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl executive-shadow flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Hồ sơ thầu hiện hành</p>
            <h3 className="text-2xl font-bold text-[#1e293b] font-display">{totalActiveCases} Hoạt động</h3>
            <p className="text-[11px] text-slate-500">Thu mua liên thông khép kín.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl executive-shadow flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">CEO Chờ duyệt PO</p>
            <h3 className={`text-2xl font-bold font-display ${pendingApprovalCount > 0 ? "text-amber-600 animate-pulse" : "text-slate-800"}`}>
              {pendingApprovalCount} Hồ sơ
            </h3>
            <p className="text-[11px] text-slate-500">Chờ Giám Đốc xác nhận thầu.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl executive-shadow flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Lỗi nghiệp vụ cảnh báo</p>
            <h3 className={`text-2xl font-bold font-display ${exceptionCount > 0 ? "text-rose-600 animate-pulse" : "text-slate-800"}`}>
              {exceptionCount} Sự cố
            </h3>
            <p className="text-[11px] text-slate-500">Hụt hàng nhập kho đối soát.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl executive-shadow flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">Đơn hàng hoàn tất</p>
            <h3 className="text-2xl font-bold text-emerald-700 font-display">{totalCompletedCount} Đã đóng</h3>
            <p className="text-[11px] text-slate-500">Hàng hóa đã bổ sung thực kho.</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl executive-shadow flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input 
              type="text" 
              placeholder="Tìm theo tên thầu, bếp trưởng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50/50 hover:border-slate-350 focus:border-teal-500 rounded-xl text-xs font-bold text-slate-800 focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Priority filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-500">Mức ưu tiên:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
            >
              <option value="all">Tất cả</option>
              <option value="urgent">Khẩn cấp 🚨</option>
              <option value="high">Cao ⚠️</option>
              <option value="medium">Vừa</option>
              <option value="low">Thấp</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchCases}
            className="px-3.5 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-650 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Khởi tạo Case thầu
          </button>
        </div>
      </div>

      {/* 5-Lane Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 overflow-x-auto min-h-[600px] pb-4">
        {lanes.map((lane) => {
          const laneCases = filteredCases.filter(c => lane.statuses.includes(c.status));
          
          return (
            <div 
              key={lane.id} 
              className={`p-4 rounded-2xl border flex flex-col space-y-4 min-w-[240px] shrink-0 h-[650px] overflow-hidden ${lane.bgColor}`}
            >
              {/* Lane Header */}
              <div className={`p-3 rounded-xl border-t-4 border border-slate-200 flex justify-between items-start ${lane.accentColor}`}>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-black truncate leading-none">{lane.title}</h4>
                  <span className="text-[9px] text-slate-400 font-bold font-mono tracking-wide mt-1 block uppercase leading-none">{lane.desc}</span>
                </div>
                <span className="text-xs font-black font-mono bg-white/70 px-2 py-0.5 rounded-lg border border-slate-200/50 shadow-sm shrink-0">
                  {laneCases.length}
                </span>
              </div>

              {/* Lane Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1.5">
                {laneCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="bg-white border border-slate-200 hover:border-slate-350 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer space-y-3 flex flex-col group relative overflow-hidden active:scale-98"
                  >
                    {/* Top row priority & code */}
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-slate-400 font-mono tracking-wider">#{c.id.toUpperCase().split('-')[1]}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${getPriorityBadgeColor(c.priority)}`}>
                        {getPriorityLabel(c.priority)}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h5 className="text-xs font-black text-slate-800 leading-tight group-hover:text-teal-700 transition">
                        {c.title}
                      </h5>
                    </div>

                    {/* Items snippet */}
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                      <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">Danh mục mặt hàng ({c.items.length}):</p>
                      <div className="space-y-0.5">
                        {c.items.slice(0, 2).map((it, idx) => (
                          <p key={idx} className="text-[10px] font-bold text-slate-650 truncate leading-normal">
                            • {it.name} <span className="text-[#00535b] font-mono">({it.quantity} {it.unit})</span>
                          </p>
                        ))}
                        {c.items.length > 2 && (
                          <p className="text-[9px] font-medium text-slate-400 italic font-mono pl-2 leading-none">và {c.items.length - 2} sản phẩm khác...</p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100/70 pt-2 mt-1">
                      <span className="truncate max-w-[90px]">{c.requesterName}</span>
                      <span className="font-mono text-[9px] bg-slate-50 px-1 py-0.5 rounded border border-slate-150">{getStatusSimpleLabel(c.status)}</span>
                    </div>

                    {/* Tiny visual progress indicator */}
                    <div className="h-[2px] bg-slate-100 w-full rounded-full overflow-hidden absolute bottom-0 left-0">
                      <div 
                        className="h-full bg-teal-600 rounded-full" 
                        style={{ 
                          width: 
                            lane.id === "intake" ? "20%" :
                            lane.id === "sourcing" ? "40%" :
                            lane.id === "negotiation" ? "60%" :
                            lane.id === "approval" ? "80%" : "100%"
                        }}
                      />
                    </div>
                  </div>
                ))}

                {laneCases.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl h-32 text-center text-slate-400 font-bold text-[10.5px] space-y-1 select-none">
                    <FolderOpen className="w-5 h-5 text-slate-300" />
                    <span>Không có hồ sơ thầu</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#091e22]/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl executive-shadow max-h-[90vh] overflow-hidden flex flex-col animate-fade-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
                <h3 className="text-base font-black text-[#00535b] font-display">Tạo hồ sơ Case Thu Mua mới</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-450 hover:text-slate-600 font-black font-mono text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tên hồ sơ mua sắm thầu:</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Đơn thầu gạo ST25 & Dầu ăn sỉ tháng 6"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="p-2.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Hạn chót nhập kho dự kiến:</label>
                  <input 
                    type="date" 
                    value={newRequiredDate}
                    onChange={e => setNewRequiredDate(e.target.value)}
                    className="p-2.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Độ ưu tiên hồ sơ:</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-bold text-center">
                  {[
                    { val: "low", label: "Thấp ☕" },
                    { val: "medium", label: "Vừa 🟢" },
                    { val: "high", label: "Cao ⚠️" },
                    { val: "urgent", label: "Khẩn cấp 🚨" }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setNewPriority(opt.val as any)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        newPriority === opt.val 
                          ? "bg-teal-50 border-teal-500 text-teal-700 font-black shadow-sm" 
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items checklist editor */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Danh sách sản phẩm ban đầu:</label>
                  <button
                    onClick={handleAddInitialItem}
                    className="p-1 px-2.5 text-[10px] bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    + Thêm dòng
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {initialItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200/60 relative">
                      <div className="sm:col-span-5 flex flex-col space-y-1">
                        <input 
                          type="text" 
                          placeholder="Tên nguyên liệu... (Gạo, thịt...)"
                          value={item.name}
                          onChange={e => handleItemFieldChange(idx, "name", e.target.value)}
                          className="p-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <input 
                          type="number" 
                          placeholder="SL"
                          value={item.quantity}
                          onChange={e => handleItemFieldChange(idx, "quantity", Number(e.target.value))}
                          className="p-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <select 
                          value={item.unit}
                          onChange={e => handleItemFieldChange(idx, "unit", e.target.value)}
                          className="p-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                        >
                          <option value="kg">kg</option>
                          <option value="bao">bao</option>
                          <option value="hộp">hộp</option>
                          <option value="chai">chai (5L)</option>
                          <option value="đv">đơn vị</option>
                        </select>
                      </div>
                      <div className="sm:col-span-1 text-center">
                        <button
                          onClick={() => handleRemoveInitialItem(idx)}
                          disabled={initialItems.length === 1}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateCase}
                disabled={creating}
                className="px-5 py-2.5 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Khởi tạo Case thầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

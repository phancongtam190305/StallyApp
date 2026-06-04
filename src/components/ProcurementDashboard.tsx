import React, { useState, useEffect } from "react";
import { apiUrl } from "../config";
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
import { useToast } from "../context/ToastContext";

interface ProcurementDashboardProps {
  currentRole: UserRole;
  orgId: string;
  onSelectCase: (caseId: string) => void;
}

export default function ProcurementDashboard({ 
  currentRole, 
  orgId, 
  onSelectCase 
}: ProcurementDashboardProps) {

  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ProcurementCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form fields for new thầu
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newRequiredDate, setNewRequiredDate] = useState("");
  const [initialItems, setInitialItems] = useState<Array<{ name: string; quantity: number; unit: string; notes: string }>>([
    { name: "", quantity: 1, unit: "kg", notes: "" }
  ]);
  const [creating, setCreating] = useState(false);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/v1/cases`), {
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

  const lanes = [
    {
      id: "intake",
      title: "Đón nhận",
      desc: "Standardize & Audit",
      statuses: ["draft_request", "request_submitted", "request_validating"],
      bgColor: "bg-white border-2 border-primary-dark/30",
      accentColor: "border-b-2 border-dashed border-primary/20 text-primary-dark bg-[#EFF8F7]"
    },
    {
      id: "sourcing",
      title: "Chào thầu",
      desc: "Supplier Matching",
      statuses: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"],
      bgColor: "bg-white border-2 border-primary-dark/30",
      accentColor: "border-b-2 border-dashed border-primary/20 text-primary bg-[#EFF8F7]"
    },
    {
      id: "negotiation",
      title: "Đàm phán",
      desc: "AI negotiation v2",
      statuses: ["quote_review", "comparison_ready", "negotiating"],
      bgColor: "bg-white border-2 border-primary-dark/30",
      accentColor: "border-b-2 border-dashed border-primary/20 text-primary-dark bg-[#EFF8F7]"
    },
    {
      id: "approval",
      title: "Duyệt PO",
      desc: "Manager signature",
      statuses: ["pending_approval", "approved", "po_draft"],
      bgColor: "bg-white border-2 border-primary-dark/30",
      accentColor: "border-b-2 border-dashed border-primary/20 text-accent-dark bg-[#EFF8F7]"
    },
    {
      id: "fulfillment",
      title: "Nhập kho",
      desc: "Receipt & Delivery",
      statuses: ["po_sent", "receiving", "closed", "cancelled", "exception"],
      bgColor: "bg-white border-2 border-primary-dark/30",
      accentColor: "border-b-2 border-dashed border-primary/20 text-[#27AE60] bg-[#EFF8F7]"
    }
  ];

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  const totalActiveCases = cases.filter(c => c.status !== "closed" && c.status !== "cancelled").length;
  const pendingApprovalCount = cases.filter(c => c.status === "pending_approval").length;
  const exceptionCount = cases.filter(c => c.status === "exception").length;
  const totalCompletedCount = cases.filter(c => c.status === "closed").length;

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
      const res = await fetch(apiUrl(`/api/v1/cases`), {
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
      case "urgent": return "bg-coral-light/10 text-coral-dark border-coral";
      case "high": return "bg-accent-light/10 text-accent-dark border-accent-gold";
      case "medium": return "bg-primary-bg text-primary-dark border-primary";
      default: return "bg-slate-50 text-slate-650 border-slate-200";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return "🚨 Khẩn";
      case "high": return "⚠️ Cao";
      case "medium": return "Vừa";
      default: return "Thấp";
    }
  };

  const getStatusSimpleLabel = (s: string) => {
    const map: Record<string, string> = {
      draft_request: "PR Nháp",
      request_submitted: "Bếp đã gửi PR",
      request_validating: "Xác minh",
      supplier_matching: "Khớp NCC",
      rfq_draft: "Soạn RFQ",
      rfq_sent: "Đã gửi RFQ",
      collecting_quotes: "Chờ báo giá",
      quote_review: "Xem xét báo giá",
      comparison_ready: "Sẵn sàng duyệt",
      negotiating: "Đàm phán AI",
      pending_approval: "Chờ CEO Duyệt",
      approved: "Đã ký duyệt PO",
      po_draft: "Soạn PO nháp",
      po_sent: "Đã gửi PO",
      receiving: "Đang nhận hàng",
      closed: "Hoàn tất đóng",
      cancelled: "Đã hủy bỏ",
      exception: "Sự cố hao hụt"
    };
    return map[s] || s;
  };

  return (
    <div className="flex-1 flex flex-col space-y-5 select-none overflow-hidden h-full">

      {/* KPI summaries in Flip7 Bubble Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
        
        {/* KPI 1 (Teal) */}
        <div className="bg-white border-3 border-primary-dark p-5 rounded-3xl shadow-card flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[9px] text-primary-dark/70 font-black uppercase tracking-wider font-display">Hồ sơ mua sắm</p>
            <h3 className="text-xl font-black text-primary-dark font-display uppercase">{totalActiveCases} Đang chạy</h3>
            <p className="text-[10px] text-primary-dark/60 font-bold">Thao tác số hóa liên tục</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-primary-bg text-primary-dark border-2 border-primary-dark shadow-teal-glow">
            <Layers className="w-5 h-5 text-primary-dark" />
          </div>
        </div>

        {/* KPI 2 (Gold) */}
        <div className="bg-white border-3 border-primary-dark p-5 rounded-3xl shadow-card flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[9px] text-primary-dark/70 font-black uppercase tracking-wider font-display">Chờ duyệt PO</p>
            <h3 className={`text-xl font-black font-display uppercase ${pendingApprovalCount > 0 ? "text-accent-dark animate-pulse" : "text-primary-dark"}`}>
              {pendingApprovalCount} Đợi CEO
            </h3>
            <p className="text-[10px] text-primary-dark/60 font-bold">Cần ký điện tử PO</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-accent-light/20 text-accent-dark border-2 border-primary-dark shadow-accent-glow">
            <FileCheck className="w-5 h-5 text-accent-dark" />
          </div>
        </div>

        {/* KPI 3 (Coral) */}
        <div className="bg-white border-3 border-primary-dark p-5 rounded-3xl shadow-card flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[9px] text-primary-dark/70 font-black uppercase tracking-wider font-display">Hao hụt &amp; Cảnh báo</p>
            <h3 className={`text-xl font-black font-display uppercase ${exceptionCount > 0 ? "text-coral-dark animate-pulse" : "text-primary-dark"}`}>
              {exceptionCount} Sự cố
            </h3>
            <p className="text-[10px] text-primary-dark/60 font-bold">Thủ kho báo hỏng hàng</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-coral-light/20 text-coral-dark border-2 border-primary-dark shadow-coral-glow">
            <AlertTriangle className="w-5 h-5 text-coral-dark" />
          </div>
        </div>

        {/* KPI 4 (Green) */}
        <div className="bg-white border-3 border-primary-dark p-5 rounded-3xl shadow-card flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[9px] text-primary-dark/70 font-black uppercase tracking-wider font-display">Lô thầu đã đóng</p>
            <h3 className="text-xl font-black text-success font-display uppercase">{totalCompletedCount} Xong</h3>
            <p className="text-[10px] text-primary-dark/60 font-bold">Đã chốt công nợ NCC</p>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-success border-2 border-primary-dark">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-white border-3 border-primary-dark p-4 rounded-3xl shadow-card flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shrink-0">
        
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search (Cream Color Style) */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input 
              type="text" 
              placeholder="Tìm thầu, mã case, bếp trưởng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-primary-dark/30 bg-cream focus:border-primary-dark rounded-full text-xs font-bold text-primary-dark focus:outline-none transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-primary-dark/60 absolute left-3.5 top-3" />
          </div>

          {/* Priority filter */}
          <div className="flex items-center space-x-1.5 text-xs font-black uppercase text-primary-dark">
            <SlidersHorizontal className="w-4 h-4 text-primary-light" />
            <span>Mức ưu tiên:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="p-2 bg-cream border-2 border-primary-dark/30 rounded-xl text-xs font-black text-primary-dark focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="urgent">🚨 Khẩn cấp</option>
              <option value="high">⚠️ Cao</option>
              <option value="medium">Vừa</option>
              <option value="low">Thấp</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchCases}
            className="px-4 py-2.5 border-2 border-primary-dark bg-white hover:bg-cream text-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 transition shadow-accent-glow transform active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 text-primary-dark" /> Tạo thầu mới
          </button>
        </div>
      </div>

      {/* 5-Lane Kanban Board Layout (Responsive smooth-scrolling Board) */}
      <div className="flex flex-row gap-5 overflow-x-auto flex-1 pb-4 w-full select-none scroll-smooth min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center rounded-3xl border-3 border-primary-dark">
            <div className="bg-cream border-3 border-primary-dark p-6 rounded-2xl shadow-card flex flex-col items-center gap-4 animate-scale-up">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-accent-dark animate-spin" />
                <Sparkles className="w-4 h-4 text-accent-gold absolute top-0 right-0 animate-bounce" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary-dark font-mono">Đang nạp dữ liệu thầu...</span>
            </div>
          </div>
        )}
        {lanes.map((lane) => {
          const laneCases = filteredCases.filter(c => lane.statuses.includes(c.status));
          
          return (
            <div 
              key={lane.id} 
              className={`w-[280px] sm:w-[320px] shrink-0 p-4 rounded-3xl flex flex-col space-y-4 h-full overflow-hidden ${lane.bgColor} relative`}
            >
              {/* Lane Header */}
              <div className={`p-3.5 rounded-2xl border-2 border-primary-dark flex justify-between items-center shadow-sm ${lane.accentColor}`}>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-black uppercase tracking-wider truncate leading-none">{lane.title}</h4>
                  <span className="text-[8px] text-primary-dark/65 font-black font-mono tracking-widest mt-1 block uppercase leading-none">{lane.desc}</span>
                </div>
                <span className="text-xs font-black font-mono bg-white px-2 py-0.5 rounded-full border-2 border-primary-dark shadow-sm shrink-0">
                  {laneCases.length}
                </span>
              </div>

              {/* Lane Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
                {laneCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="bg-white border-3 border-primary-dark p-4 rounded-2xl shadow-card hover:shadow-accent-glow transition-all cursor-pointer space-y-3 flex flex-col group relative overflow-hidden transform hover:scale-[1.02] active:scale-[0.96] duration-200 border-l-8"
                    style={{
                      borderLeftColor: 
                        c.priority === "urgent" ? "#EF6C4A" :
                        c.priority === "high" ? "#FFD23F" : "#2BA8A2"
                    }}
                  >
                    {/* Top row priority & code */}
                    <div className="flex justify-between items-center text-[9px] font-black">
                      <span className="text-primary-dark/60 font-mono tracking-wider">#{c.id.toUpperCase().split('-')[1]}</span>
                      <span className={`px-1.5 py-0.5 rounded-md border uppercase font-mono ${getPriorityBadgeColor(c.priority)}`}>
                        {getPriorityLabel(c.priority)}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h5 className="text-xs font-black text-primary-dark uppercase tracking-wide leading-tight group-hover:text-primary transition">
                        {c.title}
                      </h5>
                    </div>

                    {/* Items snippet (Cream background container) */}
                    <div className="bg-cream border-2 border-primary-dark/30 p-2.5 rounded-xl space-y-1.5 shadow-inner">
                      <p className="text-[8px] font-black text-primary-dark/60 uppercase tracking-widest leading-none">Vật tư yêu cầu ({c.items.length}):</p>
                      <div className="space-y-0.5">
                        {c.items.slice(0, 2).map((it, idx) => (
                          <p key={idx} className="text-[10px] font-black text-primary-dark truncate leading-normal">
                            • {it.name} <span className="text-primary font-black font-mono">({it.quantity} {it.unit})</span>
                          </p>
                        ))}
                        {c.items.length > 2 && (
                          <p className="text-[9px] font-bold text-primary-dark/50 italic font-mono pl-2 leading-none">và {c.items.length - 2} hàng khác...</p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className="flex justify-between items-center text-[9.5px] text-primary-dark/75 font-black border-t-2 border-dashed border-primary-dark/10 pt-2.5 mt-1 uppercase tracking-wider">
                      <span className="truncate max-w-[90px]">{c.requesterName.split(' ')[0]}</span>
                      <span className="font-mono text-[8px] bg-cream px-2 py-0.5 rounded border border-primary-dark/30">{getStatusSimpleLabel(c.status)}</span>
                    </div>
                  </div>
                ))}

                {laneCases.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-6 border-3 border-dashed border-primary-dark/20 rounded-2xl h-32 text-center text-primary-dark/50 font-black text-[10px] space-y-1">
                    <FolderOpen className="w-6 h-6 text-primary-light" />
                    <span>LÀN TRỐNG</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-primary-dark rounded-3xl w-full max-w-2xl shadow-coral-glow max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            
            {/* Modal Header using setup parallellogram design */}
            <div className="p-5 border-b-2 border-primary-dark flex justify-between items-center bg-cream">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary-dark" />
                <h3 className="text-sm font-black text-primary-dark font-display uppercase tracking-widest">Khởi Tạo Case Thu Mua</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-primary-dark hover:text-coral font-black font-mono text-sm cursor-pointer p-1.5 border-2 border-transparent hover:border-primary-dark/25 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Tiêu đề thầu sắm:</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Cung ứng hải sản tươi sống ca tối"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Hạn nhận hàng dự kiến:</label>
                  <input 
                    type="date" 
                    value={newRequiredDate}
                    onChange={e => setNewRequiredDate(e.target.value)}
                    className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Độ ưu tiên thầu:</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-black text-center uppercase tracking-wider">
                  {[
                    { val: "low", label: "Thấp" },
                    { val: "medium", label: "Vừa" },
                    { val: "high", label: "Cao ⚠️" },
                    { val: "urgent", label: "Khẩn 🚨" }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setNewPriority(opt.val as any)}
                      className={`p-2 rounded-xl border-2 transition cursor-pointer ${
                        newPriority === opt.val 
                          ? "bg-accent-gold border-primary-dark text-primary-dark shadow-accent-glow" 
                          : "bg-white border-primary-dark/20 text-primary-dark/70 hover:bg-cream"
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
                  <label className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Danh mục mặt hàng ban đầu:</label>
                  <button
                    onClick={handleAddInitialItem}
                    className="p-1 px-3 text-[10px] bg-primary-bg hover:bg-primary-light border-2 border-primary-dark text-primary-dark font-black uppercase rounded-full tracking-wider transition cursor-pointer"
                  >
                    + Thêm hàng
                  </button>
                </div>

                <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                  {initialItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-cream/30 p-3 rounded-2xl border-2 border-primary-dark/40 relative">
                      <div className="sm:col-span-5 flex flex-col space-y-1">
                        <input 
                          type="text" 
                          placeholder="Tên nguyên liệu..."
                          value={item.name}
                          onChange={e => handleItemFieldChange(idx, "name", e.target.value)}
                          className="p-2 border-2 border-primary-dark/30 bg-cream focus:border-primary-dark rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <input 
                          type="number" 
                          placeholder="SL"
                          value={item.quantity}
                          onChange={e => handleItemFieldChange(idx, "quantity", Number(e.target.value))}
                          className="p-2 border-2 border-primary-dark/30 bg-cream focus:border-primary-dark rounded-xl text-xs font-mono font-black text-center focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3 flex flex-col space-y-1">
                        <select 
                          value={item.unit}
                          onChange={e => handleItemFieldChange(idx, "unit", e.target.value)}
                          className="p-2 border-2 border-primary-dark/30 bg-cream focus:border-primary-dark rounded-xl text-xs font-black text-primary-dark focus:outline-none"
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
                          className="p-1.5 text-coral hover:bg-coral-light/10 border-2 border-transparent hover:border-coral rounded-xl transition disabled:opacity-30 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer (Pill Buttons) */}
            <div className="p-4 bg-cream border-t-2 border-primary-dark flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 border-2 border-primary-dark text-primary-dark font-black text-xs rounded-full uppercase tracking-wider cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCreateCase}
                disabled={creating}
                className="px-6 py-2.5 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 cursor-pointer shadow-accent-glow uppercase tracking-wider transform active:scale-95 transition-all"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Khởi tạo thầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

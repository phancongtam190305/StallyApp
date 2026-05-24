import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Send, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  History, 
  FileEdit,
  Sparkles,
  ChevronRight,
  Calendar,
  Layers,
  ChefHat,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { PurchaseRequest, PurchaseRequestItem, PriorityLevel, InventoryItem, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface RequesterDashboardProps {
  inventory: InventoryItem[];
  purchaseRequests: PurchaseRequest[];
  onCreatePr: (prData: { 
    title: string; 
    priority: PriorityLevel; 
    requiredDate: string; 
    items: PurchaseRequestItem[];
    status?: string;
  }) => Promise<void>;
  currentRole: UserRole;
  setActiveTab?: (tab: string) => void;
}

interface FormRow {
  name: string;
  quantity: number;
  unit: string;
  notes: string;
  showSuggestions: boolean;
  filteredSuggestions: InventoryItem[];
}

export default function RequesterDashboard({
  inventory,
  purchaseRequests,
  onCreatePr,
  currentRole,
  setActiveTab
}: RequesterDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"create" | "history">("create");
  
  // Create Request State
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [requiredDate, setRequiredDate] = useState("");
  const [formRows, setFormRows] = useState<FormRow[]>([
    { name: "", quantity: 1, unit: "cái", notes: "", showSuggestions: false, filteredSuggestions: [] }
  ]);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // History State
  const [expandedPrId, setExpandedPrId] = useState<string | null>(null);

  // Suggestions Ref Map to handle clicking outside suggestions
  const suggestionContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      setFormRows(prev => 
        prev.map((row, idx) => {
          const container = suggestionContainerRefs.current[idx];
          if (container && !container.contains(event.target as Node)) {
            return { ...row, showSuggestions: false };
          }
          return row;
        })
      );
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keyboard navigation focus handlers
  const focusInput = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.focus();
    }, 50);
  };

  const handleAddItemRow = () => {
    setFormRows([
      ...formRows,
      { name: "", quantity: 1, unit: "cái", notes: "", showSuggestions: false, filteredSuggestions: [] }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formRows.length === 1) return;
    setFormRows(formRows.filter((_, idx) => idx !== index));
  };

  const handleItemNameChange = (index: number, val: string) => {
    const updated = [...formRows];
    
    // Suggest items from catalog
    let matches: InventoryItem[] = [];
    if (val.trim()) {
      matches = inventory.filter(item => 
        item.name.toLowerCase().includes(val.toLowerCase()) ||
        item.sku.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
    }

    updated[index] = {
      ...updated[index],
      name: val,
      filteredSuggestions: matches,
      showSuggestions: matches.length > 0
    };
    setFormRows(updated);
  };

  const selectSuggestion = (index: number, item: InventoryItem) => {
    const updated = [...formRows];
    updated[index] = {
      ...updated[index],
      name: item.name,
      unit: item.unit || updated[index].unit,
      showSuggestions: false,
      filteredSuggestions: []
    };
    setFormRows(updated);
    
    // Focus quantity cell
    focusInput(`quantity-input-${index}`);
  };

  const handleItemFieldChange = (index: number, field: keyof FormRow, val: any) => {
    const updated = [...formRows];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? Math.max(1, Number(val)) : val
    };
    setFormRows(updated);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If suggestions are visible, select the first suggestion
      const row = formRows[index];
      if (row.showSuggestions && row.filteredSuggestions.length > 0) {
        selectSuggestion(index, row.filteredSuggestions[0]);
      } else {
        // Otherwise, shift focus to quantity input
        focusInput(`quantity-input-${index}`);
      }
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If it is the last row, add a new row and focus it
      if (index === formRows.length - 1) {
        handleAddItemRow();
        focusInput(`name-input-${index + 1}`);
      } else {
        // Otherwise focus next row name
        focusInput(`name-input-${index + 1}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");
    
    if (!title.trim()) {
      setErrorText("Vui lòng điền tiêu đề yêu cầu mua hàng.");
      return;
    }

    const invalidRow = formRows.some(row => !row.name.trim() || row.quantity <= 0);
    if (invalidRow) {
      setErrorText("Tất cả các dòng mặt hàng phải có tên sản phẩm và số lượng hợp lệ.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreatePr({
        title: title.trim(),
        priority,
        requiredDate: requiredDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: formRows.map(row => ({
          name: row.name.trim(),
          quantity: row.quantity,
          unit: row.unit,
          notes: row.notes
        }))
      });
      
      setSuccessText("Gửi yêu cầu mua hàng thành công!");
      setTitle("");
      setPriority("medium");
      setRequiredDate("");
      setFormRows([
        { name: "", quantity: 1, unit: "cái", notes: "", showSuggestions: false, filteredSuggestions: [] }
      ]);
      
      // Auto switch to history to view progress after a short delay
      setTimeout(() => {
        setActiveSubTab("history");
        setSuccessText("");
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorText("Lỗi khi gửi yêu cầu mua hàng. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter requests that belong to this requester
  // As u-2 is mapped in App.tsx to "Trần Văn Bình (Bếp Trưởng)"
  const filteredPrs = purchaseRequests.filter(pr => pr.requesterId === "u-2" || pr.requesterName.includes("Bình"));

  // Stepper calculations
  const steps = [
    { label: "Đã nhận yêu cầu", desc: "Đang chuyển giao" },
    { label: "Đang xử lý thầu", desc: "So sánh & đàm phán" },
    { label: "Đang giao hàng", desc: "PO đã được duyệt gửi" },
    { label: "Đã hoàn thành", desc: "Đã kiểm thực tồn" }
  ];

  const getStepProgress = (status: string) => {
    switch (status) {
      case "draft":
        return 0;
      case "submitted":
        return 1;
      case "approved":
        return 2;
      case "completed":
        return 3;
      case "cancelled":
        return -1;
      default:
        return 1;
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Premium Executive Top Bar */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold font-display text-[#00535b] tracking-tight">
                Không Gian Bếp Trưởng &amp; Phòng Ban
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Khởi tạo yêu cầu vật tư tốc độ cao, quản lý tiến trình cung ứng minh bạch.
              </p>
            </div>
          </div>
        </div>
        
        {/* Toggle subtab switches */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveSubTab("create")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === "create"
                ? "bg-white text-[#00535b] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Tạo yêu cầu mới
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === "history"
                ? "bg-white text-[#00535b] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử yêu cầu ({filteredPrs.length})
          </button>
        </div>
      </div>

      {activeSubTab === "create" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Autocomplete Form Table */}
          <div className="lg:col-span-8 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 font-display">
                  <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" /> Autocomplete Danh Sách Nguyên Liệu
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhập tên sản phẩm để nhận gợi ý tức thì, ấn Enter để chuyển ô nhanh.</p>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm dòng
              </button>
            </div>

            {errorText && (
              <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <span className="font-semibold">{errorText}</span>
              </div>
            )}

            {successText && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 animate-bounce" />
                <span className="font-semibold">{successText}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form title */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">
                  Tiêu đề phiếu mua sắm
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bổ sung nguyên liệu Bếp Trưởng cuối tuần"
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-3 text-xs text-slate-800 font-medium placeholder-slate-400 shadow-inner"
                />
              </div>

              {/* Rows List */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {formRows.map((row, index) => (
                  <div 
                    key={index} 
                    className="relative group bg-slate-50 hover:bg-teal-50/20 border border-slate-200 rounded-2xl p-4 transition-all"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Autocomplete Input */}
                      <div className="col-span-12 md:col-span-6 relative" ref={el => suggestionContainerRefs.current[index] = el}>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Tên sản phẩm</label>
                        <div className="flex items-center gap-1.5">
                          <ItemIcon name={row.name} size="sm" className="scale-90 border-slate-300 shadow-sm shrink-0" />
                          <div className="relative w-full">
                            <input
                              type="text"
                              id={`name-input-${index}`}
                              value={row.name}
                              onChange={(e) => handleItemNameChange(index, e.target.value)}
                              onKeyDown={(e) => handleNameKeyDown(e, index)}
                              placeholder="Gõ tên hoặc SKU để tìm..."
                              className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 rounded-xl p-2 text-xs text-slate-800"
                            />
                            
                            {/* Suggestions Dropdown */}
                            {row.showSuggestions && row.filteredSuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 overflow-hidden">
                                {row.filteredSuggestions.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => selectSuggestion(index, item)}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-teal-50/50 flex items-center justify-between group transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ItemIcon name={item.name} size="sm" className="scale-75 border-none" />
                                      <div>
                                        <p className="font-bold text-slate-800 group-hover:text-teal-900">{item.name}</p>
                                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">SKU: {item.sku} | Tồn: {item.quantityAvailable} {item.unit}</p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-700 px-2 py-0.5 rounded font-mono font-bold">
                                      {item.unit}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Input */}
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Số lượng</label>
                        <input
                          type="number"
                          id={`quantity-input-${index}`}
                          value={row.quantity}
                          onChange={(e) => handleItemFieldChange(index, "quantity", e.target.value)}
                          onKeyDown={(e) => handleQtyKeyDown(e, index)}
                          min="1"
                          placeholder="Số lượng"
                          className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 rounded-xl p-2 text-xs text-slate-800 font-mono font-bold text-center"
                        />
                      </div>

                      {/* Unit Input */}
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Đơn vị</label>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleItemFieldChange(index, "unit", e.target.value)}
                          placeholder="Đơn vị (kg, chi,...)"
                          className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2 text-xs text-slate-850"
                        />
                      </div>
                    </div>

                    {/* Note row */}
                    <div className="mt-2.5 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-11">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleItemFieldChange(index, "notes", e.target.value)}
                          placeholder="Nhập ghi chú yêu cầu bổ sung cho mặt hàng này..."
                          className="w-full bg-white border border-slate-150 focus:outline-none focus:border-teal-400 rounded-lg p-1.5 px-2.5 text-[11px] text-slate-500"
                        />
                      </div>
                      
                      {/* Delete Action button */}
                      <div className="col-span-1 flex justify-end">
                        {formRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded-lg transition-colors cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </div>

          {/* Setup Sidebar Controls (glassmorphic sidebar inside form) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5 h-fit">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" /> Thiết Lập Lịch Nhận
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Thời hạn mong muốn nhận nguyên liệu thực phẩm.</p>
            </div>

            {/* Date select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" /> Ngày mong muốn nhận hàng
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800"
              />
            </div>

            {/* Priority Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-display">
                Mức độ khẩn cấp (Độ ưu tiên)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "low", label: "Thường", style: "border-slate-200 text-slate-600 hover:border-slate-300" },
                  { value: "medium", label: "Trung", style: "border-slate-200 text-slate-600 hover:border-slate-300" },
                  { value: "high", label: "Khẩn cấp", style: "border-rose-200 text-rose-700 bg-rose-50/20 hover:border-rose-350" }
                ].map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value as PriorityLevel)}
                      className={`py-2 px-1 text-center text-[11px] font-bold border rounded-lg transition-all ${
                        isSelected 
                          ? p.value === "high" 
                            ? "bg-rose-600 text-white border-rose-600" 
                            : "bg-[#00535b] text-white border-[#00535b]" 
                          : p.style
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[1px] bg-slate-100 my-2" />

            {/* Form Actions */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              id="btn-submit-requester-pr"
              className="w-full bg-[#00535b] hover:bg-[#003d44] disabled:bg-teal-900/50 text-white font-extrabold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {isSubmitting ? (
                <span>Đang xử lý thầu...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 animate-pulse" />
                  <span>Gửi Ban Mua Sắm Xét Thầu (PR)</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* History View Tab */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <History className="w-4 h-4 text-teal-600 animate-spin-slow" />
              <span>Tiến Độ Bếp Thực Phẩm Giao Nhận ({filteredPrs.length})</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Dữ liệu cách ly an toàn</span>
          </div>

          {filteredPrs.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Clock className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
              <p className="text-slate-500 font-bold text-sm mt-4">Chưa có yêu cầu mua hàng nào được ghi nhận</p>
              <p className="text-slate-400 text-xs mt-1">Các phiếu của bạn sẽ được hiển thị và cập nhật tiến trình thầu tại đây.</p>
              <button 
                onClick={() => setActiveSubTab("create")} 
                className="mt-4 bg-[#00535b] text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Tạo yêu cầu mới ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPrs.map((pr) => {
                const currentStep = getStepProgress(pr.status);
                const isExpanded = expandedPrId === pr.id;
                const isCancelled = pr.status === "cancelled";
                const isHigh = pr.priority === "high";

                return (
                  <div 
                    key={pr.id} 
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm overflow-hidden transition-all"
                  >
                    {/* Header Summary */}
                    <div 
                      onClick={() => setExpandedPrId(isExpanded ? null : pr.id)}
                      className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50/50"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono font-black">
                            {pr.id.toUpperCase()}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                            isHigh ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-slate-50 border border-slate-200 text-slate-600"
                          }`}>
                            Khẩn cấp: {pr.priority}
                          </span>
                          <span className="text-[9px] bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-slate-500 font-mono rounded">
                            {new Date(pr.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">{pr.title}</h4>
                        <p className="text-xs text-slate-400 font-medium">
                          Tổng số: <span className="text-slate-700 font-extrabold">{pr.items.length} dòng mặt hàng</span> | Hạn giao: <span className="text-[#00535b] font-bold font-mono">{pr.requiredDate}</span>
                        </p>
                      </div>

                      {/* Right Stepper State badge */}
                      <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                        <div className="text-right">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                            isCancelled 
                              ? "bg-rose-50 border border-rose-100 text-rose-700"
                              : pr.status === "completed" 
                                ? "bg-emerald-50 border border-emerald-100 text-emerald-800"
                                : "bg-teal-50 border border-teal-100 text-teal-800"
                          }`}>
                            {isCancelled 
                              ? "Đã hủy" 
                              : pr.status === "completed" 
                                ? "Hoàn thành nhận" 
                                : pr.status === "approved"
                                  ? "Đang giao hàng"
                                  : "Đang xử lý thầu"
                            }
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Progress Stepper Visual Trail */}
                    {!isCancelled ? (
                      <div className="px-6 pb-5 pt-1 border-t border-slate-50 bg-slate-50/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
                          
                          {/* Background Connector Bar (Desktop) */}
                          <div className="absolute hidden sm:block top-4 left-6 right-6 h-[2px] bg-slate-200 z-0" />
                          
                          {/* Active filled connector bar */}
                          {currentStep > 0 && (
                            <div 
                              className="absolute hidden sm:block top-4 left-6 h-[2px] bg-teal-650 z-0 transition-all duration-500"
                              style={{ width: `${(currentStep / 3) * 92}%` }}
                            />
                          )}

                          {steps.map((step, idx) => {
                            const isPast = idx < currentStep;
                            const isCurrent = idx === currentStep;
                            
                            return (
                              <div key={idx} className="flex sm:flex-col items-center gap-2.5 sm:gap-1.5 z-10 flex-1 relative">
                                {/* Dot indicator */}
                                <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-sm transition-all duration-300 ${
                                  isPast 
                                    ? "bg-teal-650 border-teal-650 text-white"
                                    : isCurrent 
                                      ? "bg-white border-teal-650 text-teal-700 font-black ring-4 ring-teal-50"
                                      : "bg-white border-slate-200 text-slate-400"
                                }`}>
                                  {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                                </div>
                                
                                {/* Label details */}
                                <div className="text-left sm:text-center">
                                  <p className={`text-[11px] font-black leading-none ${isCurrent ? "text-teal-750 font-extrabold" : isPast ? "text-slate-650" : "text-slate-400"}`}>
                                    {step.label}
                                  </p>
                                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">{step.desc}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-3 border-t border-slate-50 bg-rose-50/20 text-rose-800 text-[11px] font-bold">
                        Đơn yêu cầu mua hàng này đã được Ban Thu Mua / Quản Lý hủy và đóng hồ sơ thầu.
                      </div>
                    )}

                    {/* Expandable Items Checklist Details (Zero Pricing Exposure) */}
                    {isExpanded && (
                      <div className="p-5 border-t border-slate-100 bg-slate-50/40 space-y-3">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                          Bảng kê kiểm kê vật tư yêu cầu ({pr.items.length} nhóm)
                        </div>
                        <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                <th className="p-3 pl-4">Mặt hàng</th>
                                <th className="p-3 text-center">Số lượng</th>
                                <th className="p-3">Đơn vị</th>
                                <th className="p-3">Ghi chú bếp trưởng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                              {pr.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/40">
                                  <td className="p-3 pl-4 flex items-center gap-2">
                                    <ItemIcon name={it.name} size="sm" className="scale-75" />
                                    <span className="font-bold text-slate-800">{it.name}</span>
                                  </td>
                                  <td className="p-3 text-center font-mono font-black text-slate-900">{it.quantity}</td>
                                  <td className="p-3 font-mono text-slate-500">{it.unit}</td>
                                  <td className="p-3 text-slate-400 text-[11px] font-normal italic">{it.notes || "---"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

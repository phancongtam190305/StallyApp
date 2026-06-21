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
      const row = formRows[index];
      if (row.showSuggestions && row.filteredSuggestions.length > 0) {
        selectSuggestion(index, row.filteredSuggestions[0]);
      } else {
        focusInput(`quantity-input-${index}`);
      }
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === formRows.length - 1) {
        handleAddItemRow();
        focusInput(`name-input-${index + 1}`);
      } else {
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

  const filteredPrs = purchaseRequests.filter(pr => pr.requesterId === "u-2" || pr.requesterName.includes("Bình"));

  const steps = [
    { label: "Đã nhận", desc: "PR đã lưu" },
    { label: "Đang RFQ", desc: "So sánh thầu" },
    { label: "Đã gửi thầu", desc: "PO đã gửi đi" },
    { label: "Hoàn tất", desc: "Đã cân đối kho" }
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

  // Safe checks for low stock items
  const lowStockCount = inventory.filter(item => item.quantityAvailable < item.minStockLevel).length;

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Top Banner (Flipped Gold/Teal theme) */}
      <div className="bg-white border border-primary-dark p-6 rounded-3xl shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary-bg text-primary border border-primary-dark shadow-accent-glow shrink-0">
            <ChefHat className="w-6 h-6 text-primary-dark" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-primary-dark uppercase tracking-tight">
              Không Gian Người Yêu Cầu &amp; Cung Ứng
            </h2>
            <p className="text-primary-dark/80 text-xs mt-0.5 font-bold">
              Phác thảo nhanh các phiếu đặt hàng thực phẩm, quản lý tồn kho bộ phận yêu cầu thực tế.
            </p>
          </div>
        </div>
        
        {/* Playful Pill Toggle Switch */}
        <div className="flex bg-primary-bg p-1.5 rounded-full border border-primary-dark shrink-0 shadow-sm">
          <button
            onClick={() => setActiveSubTab("create")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all border ${
              activeSubTab === "create"
                ? "bg-accent-gold text-primary-dark border-primary-dark shadow-accent-glow"
                : "text-primary border-transparent hover:text-primary-dark"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            Tạo phiếu mới
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all border ${
              activeSubTab === "history"
                ? "bg-accent-gold text-primary-dark border-primary-dark shadow-accent-glow"
                : "text-primary border-transparent hover:text-primary-dark"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Tiến độ ({filteredPrs.length})
          </button>
        </div>
      </div>

      {/* Low stock alerts render with Flip7 Coral BOOM style */}
      {lowStockCount > 0 && activeSubTab === "create" && (
        <div className="bg-white border border-coral p-5 rounded-3xl shadow-coral-glow flex items-center justify-between gap-4 animate-boom-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-coral-light/25 border border-coral flex items-center justify-center text-coral shrink-0">
              <AlertCircle className="w-5 h-5 text-coral-dark" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-coral-dark uppercase tracking-wider">CẢNH BÁO: PHÁT HIỆN THÂM HỤT TỒN KHO</h4>
              <p className="text-xs text-primary-dark font-bold mt-0.5">
                Hiện có <span className="text-coral-dark font-extrabold">{lowStockCount} mặt hàng</span> trong kho bộ phận yêu cầu đang vơi dưới ngưỡng an toàn tối thiểu.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (setActiveTab) setActiveTab("inventory");
            }}
            className="px-4 py-2 bg-coral hover:bg-coral-dark border border-primary-dark text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-coral-glow transition-all transform active:scale-95 cursor-pointer shrink-0"
          >
            Kiểm kho ngay
          </button>
        </div>
      )}

      {activeSubTab === "create" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Autocomplete Form Table */}
          <div className="lg:col-span-8 bg-white border border-primary-dark p-6 rounded-3xl shadow-card space-y-5">
            <div className="pb-3 border-b border-dashed border-primary/30 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-primary-dark flex items-center gap-1.5 uppercase tracking-wider font-display">
                  <span>🧑‍🍳</span> Autocomplete Yêu Cầu Vật Tư
                </h3>
                <p className="text-[11px] text-primary-dark/70 font-bold mt-0.5">Điền nguyên liệu để nhận gợi ý tức thì. Nhấn phím Enter để thêm hàng loạt.</p>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="bg-primary-bg hover:bg-primary-light hover:text-white text-primary border border-primary-dark text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary-dark hover:text-white" /> Thêm hàng
              </button>
            </div>

            {errorText && (
              <div className="bg-white border border-error p-3.5 rounded-2xl text-xs flex items-center gap-2.5 text-error font-bold shadow-md">
                <AlertCircle className="w-5 h-5 text-error shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {successText && (
              <div className="bg-white border border-success p-3.5 rounded-2xl text-xs flex items-center gap-2.5 text-success font-bold shadow-md">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <span>{successText}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form title */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-primary-dark/80 font-bold uppercase tracking-widest font-display block">
                  Tiêu đề phiếu mua sắm
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bổ sung rau củ tươi cho ca tối cuối tuần"
                  className="w-full bg-cream border border-primary-dark/40 focus:border-primary-dark rounded-xl p-3 text-xs text-primary-dark font-bold placeholder-primary-dark/40 shadow-inner focus:outline-none"
                />
              </div>

              {/* Rows List */}
              <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                {formRows.map((row, index) => (
                  <div 
                    key={index} 
                    className="relative group bg-surface-base border border-primary-dark/20 hover:border-primary-dark rounded-2xl p-4 transition-all shadow-sm"
                  >
                    {/* Visual left bar decoration */}
                    <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary-light rounded-l-xl" />
                    
                    <div className="grid grid-cols-12 gap-3 items-center pl-2">
                      {/* Autocomplete Input */}
                      <div className="col-span-12 md:col-span-6 relative" ref={el => suggestionContainerRefs.current[index] = el}>
                        <label className="text-[9px] text-primary-dark/70 font-bold uppercase tracking-widest block mb-1">Tên nguyên liệu</label>
                        <div className="flex items-center gap-2">
                          <ItemIcon name={row.name} size="sm" className="scale-90 border border-primary-dark shrink-0" />
                          <div className="relative w-full">
                            <input
                              type="text"
                              id={`name-input-${index}`}
                              value={row.name}
                              onChange={(e) => handleItemNameChange(index, e.target.value)}
                              onKeyDown={(e) => handleNameKeyDown(e, index)}
                              placeholder="Nhập nguyên liệu cần bổ sung..."
                              className="w-full bg-cream border border-primary-dark/30 focus:border-primary-dark rounded-xl p-2 px-3 text-xs text-primary-dark font-bold focus:outline-none"
                            />
                            
                            {/* Suggestions Dropdown */}
                            {row.showSuggestions && row.filteredSuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-primary-dark rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-primary-dark/15 overflow-hidden">
                                {row.filteredSuggestions.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => selectSuggestion(index, item)}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-primary-bg flex items-center justify-between group transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ItemIcon name={item.name} size="sm" className="scale-75 border-none" />
                                      <div>
                                        <p className="font-bold text-primary-dark group-hover:text-primary">{item.name}</p>
                                        <p className="text-[9px] text-primary-dark/60 font-bold font-mono mt-0.5">Tồn: {item.quantityAvailable} {item.unit} (Safety: {item.minStockLevel})</p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] bg-cream text-primary-dark border border-primary-dark/30 group-hover:border-primary-dark px-2 py-0.5 rounded font-mono font-bold">
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
                        <label className="text-[9px] text-primary-dark/70 font-bold uppercase tracking-widest block mb-1">Số lượng</label>
                        <input
                          type="number"
                          id={`quantity-input-${index}`}
                          value={row.quantity}
                          onChange={(e) => handleItemFieldChange(index, "quantity", e.target.value)}
                          onKeyDown={(e) => handleQtyKeyDown(e, index)}
                          min="1"
                          placeholder="Số lượng"
                          className="w-full bg-cream border border-primary-dark/30 focus:border-primary-dark rounded-xl p-2 text-xs text-primary-dark font-mono font-bold text-center focus:outline-none"
                        />
                      </div>

                      {/* Unit Input */}
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[9px] text-primary-dark/70 font-bold uppercase tracking-widest block mb-1">Đơn vị</label>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleItemFieldChange(index, "unit", e.target.value)}
                          placeholder="kg, gói,..."
                          className="w-full bg-cream border border-primary-dark/30 focus:border-primary-dark rounded-xl p-2 text-xs text-primary-dark font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Note row */}
                    <div className="mt-3 grid grid-cols-12 gap-3 items-center pl-2">
                      <div className="col-span-11">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleItemFieldChange(index, "notes", e.target.value)}
                          placeholder="Ghi chú thêm: Yêu cầu hạn sử dụng xa, cắt lát sẵn, v.v."
                          className="w-full bg-white border border-primary-dark/20 focus:border-primary-dark rounded-lg p-2 px-3 text-[11px] text-primary-dark font-medium focus:outline-none placeholder-primary-dark/45"
                        />
                      </div>
                      
                      {/* Delete Action button */}
                      <div className="col-span-1 flex justify-end">
                        {formRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            className="p-1.5 text-primary-dark/40 hover:text-coral hover:bg-coral-light/10 border border-transparent hover:border-coral rounded-xl transition-all cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </div>

          {/* Setup Sidebar Controls */}
          <div className="lg:col-span-4 bg-white border border-primary-dark p-6 rounded-3xl shadow-card space-y-5 h-fit">
            <div className="pb-2 border-b border-dashed border-primary/20">
              <h3 className="text-sm font-bold text-primary-dark flex items-center gap-1.5 uppercase tracking-wider">
                <span>📅</span> Hạn Nhận & Độ Khẩn
              </h3>
            </div>

            {/* Date select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-primary-dark/80 font-bold uppercase tracking-widest font-display flex items-center gap-1">
                Ngày mong muốn nhận
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full bg-cream border border-primary-dark/30 focus:border-primary-dark rounded-xl p-2.5 text-xs text-primary-dark font-bold focus:outline-none"
              />
            </div>

            {/* Priority Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-primary-dark/80 font-bold uppercase tracking-widest font-display block">
                Mức độ khẩn cấp
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "low", label: "Thường", style: "border-primary-dark/30 text-primary-dark hover:bg-primary-bg" },
                  { value: "medium", label: "Trung bình", style: "border-primary-dark/30 text-primary-dark hover:bg-primary-bg" },
                  { value: "high", label: "Khẩn cấp", style: "border-coral text-coral-dark bg-coral-light/10 hover:bg-coral-light/20" }
                ].map((p) => {
                  const isSelected = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value as PriorityLevel)}
                      className={`py-2 px-1 text-center text-[10px] font-bold uppercase tracking-wide border rounded-xl transition-all cursor-pointer ${
                        isSelected 
                          ? p.value === "high" 
                            ? "bg-coral text-white border-primary-dark shadow-coral-glow transform scale-[1.03]" 
                            : "bg-primary text-white border-primary-dark shadow-accent-glow transform scale-[1.03]" 
                          : p.style
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[1px] bg-primary-dark/15 my-2" />

            {/* Form Actions (Gold Pill Button) */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              id="btn-submit-requester-pr"
              className="w-full bg-accent-gold hover:bg-accent-dark disabled:bg-accent-light/40 text-primary-dark font-bold text-xs py-3.5 rounded-full flex items-center justify-center gap-1.5 transition-all border border-primary-dark shadow-accent-glow transform active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              {isSubmitting ? (
                <span>Đang gửi thầu...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Xét Duyệt (PR)</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* History View Tab */
        <div className="space-y-4">
          <div className="bg-white border border-primary-dark p-4 rounded-3xl shadow-card flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-dark uppercase tracking-wider">
              <span>📋</span> Lịch Sử Giao Nhận & Đặt Thầu ({filteredPrs.length})
            </div>
          </div>

          {filteredPrs.length === 0 ? (
            <div className="text-center py-20 bg-white border border-primary-dark rounded-3xl shadow-card">
              <Clock className="w-12 h-12 text-primary-light mx-auto animate-pulse" />
              <p className="text-primary-dark font-bold text-sm mt-4 uppercase tracking-wider">Chưa có yêu cầu mua sắm nào</p>
              <p className="text-primary-dark/75 text-xs mt-1 font-bold">Các phiếu thầu bạn lập sẽ hiển thị tiến trình nhận hàng tại đây.</p>
              <button 
                onClick={() => setActiveSubTab("create")} 
                className="mt-5 bg-accent-gold hover:bg-accent-dark text-primary-dark px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border border-primary-dark shadow-accent-glow transition-all transform active:scale-95 cursor-pointer"
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
                    className={`bg-white border border-primary-dark rounded-3xl shadow-card overflow-hidden transition-all relative border-l-8 ${
                      isCancelled ? "border-l-coral" : pr.status === "completed" ? "border-l-success" : "border-l-primary"
                    }`}
                  >
                    {/* Header Summary */}
                    <div 
                      onClick={() => setExpandedPrId(isExpanded ? null : pr.id)}
                      className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-primary-bg/10"
                    >
                      <div className="space-y-1.5 flex-1 pl-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-cream border border-primary-dark px-2 py-0.5 rounded text-primary-dark font-mono font-bold shadow-sm">
                            {pr.id.toUpperCase()}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase font-mono border ${
                            isHigh ? "bg-coral-light/10 border-coral text-coral-dark" : "bg-primary-bg border-primary/20 text-primary-dark"
                          }`}>
                            {pr.priority === "high" ? "🚨 KHẨN CẤP" : "THƯỜNG"}
                          </span>
                          <span className="text-[9px] text-primary-dark/60 font-bold font-mono">
                            Khởi tạo: {new Date(pr.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider">{pr.title}</h4>
                        <p className="text-xs text-primary-dark/80 font-bold">
                          Danh mục: <span className="text-primary font-bold">{pr.items.length} mặt hàng</span> | Hạn nhận thầu: <span className="text-coral font-bold font-mono">{pr.requiredDate}</span>
                        </p>
                      </div>

                      {/* Right Stepper State badge */}
                      <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                        <div className="text-right">
                          <span className={`text-[10px] px-3 py-1 rounded-full font-bold border ${
                            isCancelled 
                              ? "bg-coral-light/10 border-coral text-coral-dark"
                              : pr.status === "completed" 
                                ? "bg-emerald-50 border-success text-success"
                                : "bg-primary-bg border-primary text-primary-dark"
                          }`}>
                            {isCancelled 
                              ? "Đã hủy bỏ" 
                              : pr.status === "completed" 
                                ? "Đã nhập kho" 
                                : pr.status === "approved"
                                  ? "Đang vận chuyển"
                                  : "Chờ duyệt thầu"
                            }
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-primary-dark" /> : <ChevronDown className="w-5 h-5 text-primary-dark" />}
                      </div>
                    </div>

                    {/* Progress Stepper Visual Trail (Game board visual styling) */}
                    {!isCancelled ? (
                      <div className="px-6 pb-6 pt-2 border-t border-dashed border-primary/10 bg-primary-bg/5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
                          
                          {/* Playful Thick Connector Bar */}
                          <div className="absolute hidden sm:block top-4.5 left-8 right-8 h-1 bg-primary-dark/15 z-0 rounded-full" />
                          
                          {/* Active filled connector bar */}
                          {currentStep > 0 && (
                            <div 
                              className="absolute hidden sm:block top-4.5 left-8 h-1 bg-primary z-0 transition-all duration-500 rounded-full"
                              style={{ width: `${(currentStep / 3) * 88}%` }}
                            />
                          )}

                          {steps.map((step, idx) => {
                            const isPast = idx < currentStep;
                            const isCurrent = idx === currentStep;
                            
                            return (
                              <div key={idx} className="flex sm:flex-col items-center gap-2.5 sm:gap-2 z-10 flex-1 relative">
                                {/* Dot indicator */}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shadow-sm transition-all duration-300 ${
                                  isPast 
                                    ? "bg-primary border-primary-dark text-white"
                                    : isCurrent 
                                      ? "bg-accent-gold border-primary-dark text-primary-dark font-bold ring-4 ring-accent-light/35 shadow-accent-glow transform scale-[1.1]"
                                      : "bg-white border-primary-dark/30 text-primary-dark/45"
                                }`}>
                                  {isPast ? <CheckCircle2 className="w-4.5 h-4.5 text-white" /> : idx + 1}
                                </div>
                                
                                {/* Label details */}
                                <div className="text-left sm:text-center">
                                  <p className={`text-[10px] font-bold uppercase tracking-wider leading-none ${isCurrent ? "text-primary-dark font-bold" : isPast ? "text-primary-dark/80" : "text-primary-dark/40"}`}>
                                    {step.label}
                                  </p>
                                  <p className="text-[8px] font-bold text-primary-dark/50 uppercase tracking-widest mt-0.5">{step.desc}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-3 border-t border-dashed border-coral/30 bg-coral-light/5 text-coral-dark text-[10px] font-bold uppercase tracking-wider">
                        Phiếu PR này đã bị hủy bỏ và không thể tiếp tục thực hiện quy trình thầu.
                      </div>
                    )}

                    {/* Expandable Items Table */}
                    {isExpanded && (
                      <div className="p-5 border-t border-primary-dark/15 bg-cream/10 space-y-3">
                        <div className="text-[9px] text-primary-dark/60 font-bold uppercase tracking-wider font-mono">
                          Bảng chi tiết nguyên liệu yêu cầu ({pr.items.length} mặt hàng)
                        </div>
                        <div className="bg-white border border-primary-dark rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-primary-bg border-b border-primary-dark text-[9px] font-bold text-primary-dark uppercase tracking-wider">
                                <th className="p-3 pl-4">Tên sản phẩm</th>
                                <th className="p-3 text-center">Số lượng</th>
                                <th className="p-3">Đơn vị</th>
                                <th className="p-3">Ghi chú người yêu cầu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-primary-dark/10 text-primary-dark font-bold">
                              {pr.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-primary-bg/5">
                                  <td className="p-3 pl-4 flex items-center gap-2">
                                    <ItemIcon name={it.name} size="sm" className="scale-75 border" />
                                    <span className="font-bold text-primary-dark">{it.name}</span>
                                  </td>
                                  <td className="p-3 text-center font-mono font-bold text-primary-dark">{it.quantity}</td>
                                  <td className="p-3 font-mono text-primary-dark/60 uppercase">{it.unit}</td>
                                  <td className="p-3 text-primary-dark/50 text-[10px] font-medium italic">{it.notes || "---"}</td>
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

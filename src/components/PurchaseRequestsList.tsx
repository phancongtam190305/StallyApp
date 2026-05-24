import React, { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Send, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  History, 
  FileEdit,
  ArrowRight
} from "lucide-react";
import { PurchaseRequest, PurchaseRequestItem, PriorityLevel, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface PurchaseRequestsListProps {
  purchaseRequests: PurchaseRequest[];
  currentRole: UserRole;
  onCreatePr: (prData: { title: string; priority: PriorityLevel; requiredDate: string; items: PurchaseRequestItem[] }) => void;
  onSelectPrForSourcing: (pr: PurchaseRequest) => void;
  setActiveTab: (tab: string) => void;
}

export default function PurchaseRequestsList({ 
  purchaseRequests, 
  currentRole, 
  onCreatePr, 
  onSelectPrForSourcing,
  setActiveTab
}: PurchaseRequestsListProps) {
  
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [requiredDate, setRequiredDate] = useState("");
  const [items, setItems] = useState<PurchaseRequestItem[]>([
    { name: "", quantity: 10, unit: "kg", notes: "" }
  ]);
  
  const [errorText, setErrorText] = useState("");

  const handleAddItem = () => {
    setItems([...items, { name: "", quantity: 10, unit: "kg", notes: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseRequestItem, val: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? Number(val) : val
    };
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!title.trim()) {
      setErrorText("Tiêu đề yêu cầu mua hàng không được bỏ trống.");
      return;
    }

    const invalidItem = items.some(it => !it.name.trim() || it.quantity <= 0);
    if (invalidItem) {
      setErrorText("Mặt hàng phải có tên và số lượng hợp lệ.");
      return;
    }

    onCreatePr({
      title: title.trim(),
      priority,
      requiredDate: requiredDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items
    });

    // Reset Form
    setTitle("");
    setPriority("medium");
    setRequiredDate("");
    setItems([{ name: "", quantity: 10, unit: "kg", notes: "" }]);
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Title & Stats */}
      <div>
        <h2 className="text-xl font-extrabold font-display text-[#00535b] tracking-tight">Yêu cầu Mua sắm (PR)</h2>
        <p className="text-xs text-slate-500 mt-1">Quản lý và chuyển tiếp yêu cầu vật tư, thực phẩm dự trữ từ nhà bếp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creator Form (Requester / Chef focus) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-2xl executive-shadow h-fit">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-teal-600" /> Bản ghi yêu cầu mới
            </h3>
            <p className="text-[11px] text-slate-500">Khởi tạo phiếu vật tư gửi sơ tuyển nhà cung cấp.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorText && (
              <div className="bg-red-50 border border-red-150 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {/* Title / Description */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Tiêu đề yêu cầu mua</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Nguyên liệu nhà bếp cuối tuần"
                className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Row priority & date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Độ ưu tiên</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800"
                >
                  <option value="low">Thường (Low)</option>
                  <option value="medium">Trung bình (Medium)</option>
                  <option value="high">Khẩn cấp (High)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Ngày hạn nhận</label>
                <input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Items table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Danh mục cần mua</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[10px] text-teal-700 hover:text-teal-800 font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm dòng
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((it, index) => (
                  <div key={index} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 relative">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7 flex items-center gap-1.5">
                        <ItemIcon name={it.name} size="sm" className="scale-90 shadow-sm shrink-0 border-slate-200/30" />
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => handleItemChange(index, "name", e.target.value)}
                          placeholder="Tên nguyên liệu..."
                          className="w-full bg-white border border-slate-200 focus:outline-none rounded-lg p-1.5 text-xs text-slate-800"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          min="1"
                          placeholder="SL"
                          className="w-full bg-white border border-slate-200 focus:outline-none rounded-lg p-1.5 text-xs text-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          placeholder="Đơn vị"
                          className="w-full bg-white border border-slate-200 focus:outline-none rounded-lg p-1.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={it.notes}
                      onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                      placeholder="Ghi chú thêm (không bắt buộc)..."
                      className="w-full bg-white border border-slate-200 focus:outline-none rounded-lg p-1.5 text-[11px] text-slate-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              id="btn-create-pr"
              className="w-full bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Gửi Lên Ban Mua Sắm (PR)
            </button>
          </form>
        </div>

        {/* Existing PRs List (Interactive Sourcing steps) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-teal-600" /> Danh sách yêu cầu mua sắm ({purchaseRequests.length})
            </span>
          </div>

          <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
            {purchaseRequests.length === 0 ? (
              <div className="text-center py-16 p-6 bg-white border border-slate-200 rounded-2xl executive-shadow">
                <Clock className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
                <p className="text-slate-500 text-xs mt-3 font-semibold">Chưa phát sinh yêu cầu mua sắm nào.</p>
                <p className="text-[11px] text-slate-400 mt-1">Sử dụng bảng bên trái để khởi tạo nhanh.</p>
              </div>
            ) : (
              purchaseRequests.map((pr) => {
                const isSubmitted = pr.status === "submitted";
                const isApproved = pr.status === "approved";
                const isDraft = pr.status === "draft";
                const isHigh = pr.priority === "high";

                return (
                  <div key={pr.id} className="bg-white border border-slate-200 p-5 rounded-2xl executive-shadow space-y-4 relative overflow-hidden">
                    {/* Source label */}
                    <div className="absolute top-0 right-0">
                      <span className="text-[9px] bg-slate-50 text-slate-500 border-l border-b border-slate-200/80 px-2.5 py-1 font-mono font-bold rounded-bl">
                        Nguồn: {pr.source === "email" ? "📬 Email Auto" : "💻 Web Portal"}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono font-bold">
                            {pr.id.toUpperCase()}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                            isHigh ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-slate-50 border border-slate-200 text-slate-600"
                          }`}>
                            {pr.priority}
                          </span>
                          {isDraft && (
                            <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                              Nháp
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 mt-2">{pr.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Nhân viên đề xuất: <span className="text-slate-600 font-bold">{pr.requesterName}</span> ({pr.departmentName})
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div className="text-right">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          isApproved ? "bg-teal-50 border border-teal-200 text-teal-700 font-bold" : "bg-amber-50 border border-amber-200 text-amber-700 font-bold"
                        }`}>
                          {pr.status === "submitted" ? "Đang chào giá" : pr.status || "Chờ gửi"}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono mt-1.5">Hạn: {pr.requiredDate}</p>
                      </div>
                    </div>

                    {/* Items list */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 space-y-1.5">
                      <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Danh sách mặt hàng ({pr.items.length})</p>
                      <div className="divide-y divide-slate-200/60 max-h-32 overflow-y-auto">
                        {pr.items.map((it, idx) => (
                          <div key={idx} className="py-1.5 text-xs flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <ItemIcon name={it.name} size="sm" className="shadow-sm scale-75 border-slate-200/30" />
                              <span className="text-slate-600 font-medium">{it.name}</span>
                            </div>
                            <span className="text-slate-800 font-bold font-mono">
                              {it.quantity} {it.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flow controllers (Procurement role) */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400 font-medium">
                        Khởi tạo ngày: {new Date(pr.createdAt).toLocaleDateString("vi-VN")}
                      </div>

                      <div className="flex gap-2">
                        {isDraft && currentRole === "procurement" && (
                          <button
                            onClick={() => {
                              pr.status = "submitted";
                              onSelectPrForSourcing(pr);
                            }}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] p-2 px-3 rounded-lg font-bold cursor-pointer"
                          >
                            Xác thực nháp &amp; Gửi
                          </button>
                        )}
                        
                        {/* Match & Sourcing trigger button */}
                        {currentRole === "procurement" && (
                          <button
                            id="btn-sourcing-rfq"
                            onClick={() => {
                              onSelectPrForSourcing(pr);
                              setActiveTab("rfq");
                            }}
                            className="bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-[10px] p-2 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <span>Tiếp quản &amp; Khảo giá NCC (RFQ)</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


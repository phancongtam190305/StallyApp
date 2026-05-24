import React, { useState } from "react";
import { 
  Boxes, 
  History, 
  Truck, 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  Minus, 
  Plus, 
  X, 
  AlertCircle,
  Package,
  Calendar,
  RotateCcw,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { InventoryItem, StockMovement, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface WarehouseDashboardProps {
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  currentRole: UserRole;
  onReceiveGoods: (itemId: string, qty: number, sourcePo: string) => Promise<void> | void;
  onAdjustStock: (itemId: string, qty: number, movementType: "in" | "out" | "adjustment", notes: string) => Promise<void> | void;
  onCreatePrFromStock?: (item: InventoryItem) => void;
  setActiveTab?: (tab: string) => void;
}

interface IncomingShipment {
  id: string;
  item: InventoryItem;
  expectedQty: number;
  poCode: string;
  expectedDate: string;
  status: "delayed" | "today" | "future";
}

export default function WarehouseDashboard({
  inventory,
  stockMovements,
  currentRole,
  onReceiveGoods,
  onAdjustStock,
  onCreatePrFromStock,
  setActiveTab
}: WarehouseDashboardProps) {
  const [activeTabSub, setActiveTabSub] = useState<"incoming" | "history">("incoming");
  
  // Selected shipment for receipt modal
  const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);
  
  // Modal states
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [isDamaged, setIsDamaged] = useState<boolean>(false);
  const [clerkNotes, setClerkNotes] = useState<string>("");
  const [successAnimation, setSuccessAnimation] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"standard" | "discrepancy">("standard");

  // Derive incoming deliveries from inventory items having quantityOnOrder > 0
  const incomingItems = inventory.filter(item => item.quantityOnOrder > 0);
  
  const shipments: IncomingShipment[] = incomingItems.map((item, idx) => {
    // Determine a mock status and expected date for visual richness
    let status: "delayed" | "today" | "future" = "today";
    let dateStr = "";
    
    if (idx % 3 === 0) {
      status = "today";
      dateStr = "Hôm nay (Arriving Today)";
    } else if (idx % 3 === 1) {
      status = "delayed";
      dateStr = "Trễ hạn 2 ngày (Overdue)";
    } else {
      status = "future";
      dateStr = "Ngày mai (Expected Tomorrow)";
    }

    return {
      id: `shipment-${item.id}`,
      item,
      expectedQty: item.quantityOnOrder,
      poCode: `PO-2026-${1000 + idx}`,
      expectedDate: dateStr,
      status
    };
  });

  const openReceiptModal = (shipment: IncomingShipment) => {
    setSelectedShipment(shipment);
    setReceivedQty(shipment.expectedQty);
    setIsDamaged(false);
    setClerkNotes("");
    setSuccessAnimation(false);
    setModalMode("standard");
  };

  const closeReceiptModal = () => {
    if (!successAnimation) {
      setSelectedShipment(null);
    }
  };

  // Default Action: One-Tap Receive All
  const handleQuickReceiveAll = async (shipment: IncomingShipment) => {
    try {
      setSuccessAnimation(true);
      await onReceiveGoods(shipment.item.id, shipment.expectedQty, shipment.poCode);
      
      // Delay modal closing for success animation
      setTimeout(() => {
        setSuccessAnimation(false);
        setSelectedShipment(null);
      }, 1500);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi ghi nhận nhập kho.");
      setSuccessAnimation(false);
    }
  };

  // Discrepancy Action: Detailed Receipt Submit
  const handleDetailedReceiptSubmit = async () => {
    if (!selectedShipment) return;
    
    try {
      setSuccessAnimation(true);
      
      const isMismatch = receivedQty !== selectedShipment.expectedQty;
      const notes = clerkNotes || (isMismatch ? "Sai lệch số lượng thực tế" : "") + (isDamaged ? " - Phát hiện hàng hỏng" : "");
      
      if (isMismatch || isDamaged) {
        // Record receipt of the actual quantity
        await onReceiveGoods(selectedShipment.item.id, receivedQty, selectedShipment.poCode);
        
        // If there's damaged items or shortage, log an adjustment/exception note
        if (isDamaged || receivedQty < selectedShipment.expectedQty) {
          const shortage = selectedShipment.expectedQty - receivedQty;
          await onAdjustStock(
            selectedShipment.item.id,
            shortage > 0 ? shortage : Math.abs(shortage),
            "adjustment",
            `Báo cáo hỏng hóc từ Thủ kho: ${notes}`
          );
        }
      } else {
        // Perfect match
        await onReceiveGoods(selectedShipment.item.id, selectedShipment.expectedQty, selectedShipment.poCode);
      }
      
      setTimeout(() => {
        setSuccessAnimation(false);
        setSelectedShipment(null);
      }, 1500);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi ghi nhận nhập kho.");
      setSuccessAnimation(false);
    }
  };

  // Filter receipt logs from stock movements (Inward logs)
  const incomingMovements = stockMovements.filter(mov => mov.movementType === "in" || mov.referenceId?.includes("PO"));

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Mobile-Optimized Executive Top Bar */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#00535b] tracking-tight">Khu Vực Nhập Kho Thực Tế</h2>
            <p className="text-[11px] text-slate-500 font-medium">Đối soát chứng từ hàng về, thẩm định hư hao nguyên liệu bếp ăn.</p>
          </div>
        </div>

        {/* Dynamic sub-navigation */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTabSub("incoming")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTabSub === "incoming"
                ? "bg-white text-[#00535b] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Hàng sắp về ({shipments.length})
          </button>
          <button
            onClick={() => setActiveTabSub("history")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTabSub === "history"
                ? "bg-white text-[#00535b] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Nhật ký đã nhận ({incomingMovements.length})
          </button>
        </div>
      </div>

      {activeTabSub === "incoming" ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-teal-500/5 to-transparent border border-teal-100/50 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <span className="text-xs font-extrabold text-teal-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" /> Danh sách lô hàng thầu sắp cập bến
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Mobile Friendly View</span>
          </div>

          {shipments.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <Package className="w-12 h-12 text-slate-350 mx-auto animate-pulse" />
              <p className="text-slate-500 font-bold text-sm mt-4">Chưa có chuyến hàng PO nào sắp về</p>
              <p className="text-slate-400 text-xs mt-1">Khi các nhà cung cấp được duyệt thầu, thông tin giao hàng sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shipments.map((ship) => {
                const isDelayed = ship.status === "delayed";
                const isToday = ship.status === "today";
                
                return (
                  <div 
                    key={ship.id}
                    className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                      isDelayed 
                        ? "border-rose-100 hover:border-rose-250 bg-rose-50/5" 
                        : isToday 
                          ? "border-amber-100 hover:border-amber-250 bg-amber-50/5" 
                          : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Top Section */}
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <span className="text-[9px] bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded text-slate-650 font-mono font-bold">
                            {ship.poCode}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-800 mt-1">{ship.item.name}</h4>
                          <p className="text-[10px] font-mono text-slate-400">SKU: {ship.item.sku}</p>
                        </div>
                        
                        {/* Status Badge */}
                        <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                          isDelayed 
                            ? "bg-rose-100 text-rose-700 border border-rose-200 animate-pulse" 
                            : isToday 
                              ? "bg-amber-100 text-amber-800 border border-amber-250 animate-pulse" 
                              : "bg-slate-100 text-slate-650"
                        }`}>
                          {isDelayed ? "Trễ Hạn" : isToday ? "Hôm Nay" : "Sắp Tới"}
                        </span>
                      </div>

                      {/* Shipment specs */}
                      <div className="bg-slate-100/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-slate-455 font-bold uppercase">Expected Qty</p>
                          <p className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                            {ship.expectedQty} {ship.item.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-455 font-bold uppercase">Dự Kiến</p>
                          <p className="text-[11px] font-bold text-slate-650 mt-0.5 truncate">
                            {ship.expectedDate}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      {/* Detailed Checkin trigger */}
                      <button
                        onClick={() => openReceiptModal(ship)}
                        className="flex-1 bg-white hover:bg-slate-150 border border-slate-200 hover:border-slate-350 text-slate-700 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Kiểm lệch &amp; hỏng</span>
                      </button>

                      {/* One-Tap Mark Received Default Button */}
                      <button
                        onClick={() => handleQuickReceiveAll(ship)}
                        className="flex-1 bg-[#00535b] hover:bg-[#003d44] text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-450" />
                        <span>Nhận đủ toàn bộ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Receipt History view tab */
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#00535b] flex items-center gap-1.5">
              <History className="w-4 h-4 text-teal-600" /> Biên bản nhập kho gần nhất
            </h3>
            <p className="text-[11px] text-slate-500">Đối chiếu dữ liệu xuất/nhập chứng thực vật tư bếp.</p>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
            {incomingMovements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Chưa có dữ liệu nhập kho nào được ghi nhận.
              </div>
            ) : (
              incomingMovements.map((mov) => {
                const itemObj = inventory.find(i => i.id === mov.itemId);
                return (
                  <div key={mov.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono">
                          ĐÃ NHẬP KHO
                        </span>
                        {itemObj && <ItemIcon name={itemObj.name} size="sm" className="scale-75 shadow-sm" />}
                        <span className="font-bold text-slate-800 text-sm">{itemObj ? itemObj.name : "Nguyên liệu ẩn"}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Số hóa thầu: <span className="text-slate-500 font-mono font-bold">{mov.referenceId}</span> | Kiểm soát viên: {mov.createdBy}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-emerald-700 font-extrabold text-sm">
                        + {mov.quantity} {itemObj?.unit}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(mov.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Interactive Goods Receipt One-Tap Checkin Dialog/Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-[#091e22]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative animate-scale-up">
            
            {successAnimation ? (
              /* Success micro-animation loader view */
              <div className="p-8 py-16 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-500/20 text-emerald-600 flex items-center justify-center animate-bounce shadow-md">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">Hoàn Tất Ghi Nhận Thành Công!</h3>
                <p className="text-xs text-slate-500 font-semibold">Số liệu kho đã tự động hiệu chỉnh tăng thực tồn tương ứng.</p>
              </div>
            ) : (
              /* Core Receipt Modal content details */
              <>
                {/* Header */}
                <div className="bg-gradient-to-r from-[#00535b] to-[#003d44] text-white p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-teal-350" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Phiếu Nhận &amp; Thẩm Định Thực Tế</h3>
                  </div>
                  <button 
                    onClick={closeReceiptModal}
                    className="p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <X className="w-4 h-4 text-slate-200 hover:text-white" />
                  </button>
                </div>

                {/* Body details info */}
                <div className="p-5 space-y-4 text-slate-800">
                  <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                    <ItemIcon name={selectedShipment.item.name} size="md" className="shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-slate-800">{selectedShipment.item.name}</h4>
                      <p className="text-[9.5px] text-slate-455 font-mono">SKU: {selectedShipment.item.sku}</p>
                      <p className="text-[11px] text-[#00535b] font-bold mt-1.5 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> Thầu gốc: {selectedShipment.expectedQty} {selectedShipment.item.unit}
                      </p>
                    </div>
                  </div>

                  {modalMode === "standard" ? (
                    /* Standard fast check view option */
                    <div className="space-y-4">
                      <div className="p-3.5 bg-emerald-50/20 border border-emerald-100 rounded-xl text-center space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Mọi thông số kiểm hàng khớp 100%?</p>
                        <p className="text-sm font-black text-emerald-800 font-mono">{selectedShipment.expectedQty} {selectedShipment.item.unit} sạch đẹp</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {/* Open discrepancy button */}
                        <button
                          onClick={() => setModalMode("discrepancy")}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 text-xs font-black py-3 rounded-xl transition"
                        >
                          Phát hiện sai lệch
                        </button>
                        {/* Receive Perfect Match trigger */}
                        <button
                          onClick={() => handleQuickReceiveAll(selectedShipment)}
                          className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-black py-3 rounded-xl transition shadow-sm"
                        >
                          Nhận đủ 100%
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Detailed discrepancy adjustment inputs view */
                    <div className="space-y-4 animate-fade-slide-up">
                      {/* Numeric Adjust Stepper */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Số lượng thực nhận tại kho
                        </label>
                        <div className="flex items-center justify-between border border-slate-200 rounded-xl p-1 bg-slate-50">
                          <button
                            onClick={() => setReceivedQty(prev => Math.max(0, prev - 1))}
                            className="w-10 h-10 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 flex items-center justify-center font-bold text-slate-500 transition cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          
                          <div className="text-center">
                            <span className="text-base font-black font-mono text-slate-800">
                              {receivedQty}
                            </span>
                            <span className="text-xs text-slate-455 ml-1">{selectedShipment.item.unit}</span>
                          </div>

                          <button
                            onClick={() => setReceivedQty(prev => prev + 1)}
                            className="w-10 h-10 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 flex items-center justify-center font-bold text-slate-500 transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Damaged checkbox */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-rose-50/30 border border-rose-100 rounded-xl">
                        <input
                          type="checkbox"
                          id="damaged-check"
                          checked={isDamaged}
                          onChange={(e) => setIsDamaged(e.target.checked)}
                          className="w-4 h-4 accent-rose-650 cursor-pointer"
                        />
                        <label htmlFor="damaged-check" className="text-xs font-bold text-rose-800 cursor-pointer select-none">
                          Hàng bị dập hỏng / Lỗi thẩm thực (Damaged)
                        </label>
                      </div>

                      {/* Notes input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Lý do chênh lệch / Tình trạng
                        </label>
                        <input
                          type="text"
                          value={clerkNotes}
                          onChange={(e) => setClerkNotes(e.target.value)}
                          placeholder="Ví dụ: Giao thiếu 2 kg, 1 kg dập nát..."
                          className="w-full bg-white border border-slate-200 focus:outline-none focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setModalMode("standard")}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-black py-3 rounded-xl transition"
                        >
                          Quay lại
                        </button>
                        <button
                          onClick={handleDetailedReceiptSubmit}
                          className="flex-1 bg-[#00535b] hover:bg-[#003d44] text-white text-xs font-black py-3 rounded-xl transition shadow-md"
                        >
                          Ghi nhận sai lệch
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

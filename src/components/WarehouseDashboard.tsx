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
import { InventoryItem, PurchaseOrder, PurchaseOrderItem, StockMovement, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface WarehouseDashboardProps {
  inventory: InventoryItem[];
  purchaseOrders: PurchaseOrder[];
  stockMovements: StockMovement[];
  currentRole: UserRole;
  onReceiveGoods: (itemId: string, qty: number, sourcePo: string, itemName?: string) => Promise<void> | void;
  onAdjustStock: (itemId: string, qty: number, movementType: "in" | "out" | "adjustment", notes: string) => Promise<void> | void;
  onCreatePrFromStock?: (item: InventoryItem) => void;
  setActiveTab?: (tab: string) => void;
}

interface IncomingShipment {
  id: string;
  item: InventoryItem;
  poItem: PurchaseOrderItem;
  expectedQty: number;
  poCode: string;
  expectedDate: string;
  status: "delayed" | "today" | "future";
}

export default function WarehouseDashboard({
  inventory,
  purchaseOrders,
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

  const normalizeInventoryName = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-zA-Z0-9\s]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const getInventoryNameTokens = (name: string) => {
    const stopWords = new Set(["cao", "cap", "loai", "hang", "premium", "organic", "tuoi", "moi", "nhap", "khau"]);
    return normalizeInventoryName(name)
      .split(" ")
      .map(token => token.trim())
      .filter(token => token.length >= 2 && !stopWords.has(token));
  };

  const scoreInventoryMatch = (item: InventoryItem, poItem: PurchaseOrderItem) => {
    const itemName = normalizeInventoryName(item.name);
    const poName = normalizeInventoryName(poItem.name);
    if (!itemName || !poName) return 0;

    let score = 0;
    if (itemName === poName) score += 100;
    if (itemName.includes(poName) || poName.includes(itemName)) score += 70;

    const itemTokens = new Set(getInventoryNameTokens(item.name));
    const poTokens = getInventoryNameTokens(poItem.name);
    if (poTokens.length > 0) {
      const matchedTokens = poTokens.filter(token => itemTokens.has(token));
      score += (matchedTokens.length / poTokens.length) * 60;
    }

    if (item.unit.trim().toLowerCase() === poItem.unit.trim().toLowerCase()) {
      score += 15;
    }
    return score;
  };

  const findInventoryItemForPoItem = (poItem: PurchaseOrderItem) =>
    inventory
      .map(item => ({ item, score: scoreInventoryMatch(item, poItem) }))
      .filter(match => match.score >= 75)
      .sort((a, b) => b.score - a.score)[0]?.item;

  // Derive incoming deliveries from real confirmed/shipping POs.
  const incomingPoItems = purchaseOrders
    .filter(po => ["confirmed", "shipping"].includes(po.status))
    .flatMap(po => po.items.map((poItem, index) => ({ po, poItem, index })))
    .filter(({ poItem }) => poItem.quantity > 0);

  const shipments: IncomingShipment[] = incomingPoItems.map(({ po, poItem, index }, idx) => {
    const matchedItem = findInventoryItemForPoItem(poItem);
    const item: InventoryItem = matchedItem || {
      id: `po-line-${po.id}-${index}`,
      organizationId: po.organizationId,
      sku: `PO-${po.id.toUpperCase()}`,
      name: poItem.name,
      category: "PO Received",
      unit: poItem.unit,
      minStockLevel: 0,
      quantityAvailable: 0,
      quantityOnOrder: poItem.quantity,
      lastPurchasePrice: poItem.unitPrice,
      updatedAt: po.createdAt
    };

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
      id: `shipment-${po.id}-${index}`,
      item,
      poItem,
      expectedQty: poItem.quantity,
      poCode: po.id,
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

  const handleQuickReceiveAll = async (shipment: IncomingShipment) => {
    try {
      setSuccessAnimation(true);
      await onReceiveGoods(shipment.item.id, shipment.expectedQty, shipment.poCode, shipment.poItem.name);
      
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

  const handleDetailedReceiptSubmit = async () => {
    if (!selectedShipment) return;
    
    try {
      setSuccessAnimation(true);
      
      const isMismatch = receivedQty !== selectedShipment.expectedQty;
      const notes = clerkNotes || (isMismatch ? "Sai lệch số lượng thực tế" : "") + (isDamaged ? " - Phát hiện hàng hỏng" : "");
      
      if (isMismatch || isDamaged) {
        await onReceiveGoods(selectedShipment.item.id, receivedQty, selectedShipment.poCode, selectedShipment.poItem.name);
        
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
        await onReceiveGoods(selectedShipment.item.id, selectedShipment.expectedQty, selectedShipment.poCode, selectedShipment.poItem.name);
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

  const incomingMovements = stockMovements.filter(mov => mov.movementType === "in" || mov.referenceId?.includes("PO"));

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Mobile-Optimized Executive Top Bar */}
      <div className="bg-white border border-primary-dark p-5 rounded-3xl shadow-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-bg text-primary border border-primary-dark shadow-accent-glow rounded-2xl shrink-0">
            <Boxes className="w-6 h-6 text-primary-dark" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary-dark uppercase tracking-tight font-display">Khu Vực Tiếp Nhận Hàng</h2>
            <p className="text-xs text-primary-dark/80 font-bold">Đối soát PO thực phẩm cập bến, cân đối chênh lệch và lỗi hỏng.</p>
          </div>
        </div>

        {/* Playful Pill Toggle Switch */}
        <div className="flex bg-primary-bg p-1.5 rounded-full border border-primary-dark w-full sm:w-auto shadow-sm">
          <button
            onClick={() => setActiveTabSub("incoming")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all border ${
              activeTabSub === "incoming"
                ? "bg-accent-gold text-primary-dark border-primary-dark shadow-accent-glow"
                : "text-primary border-transparent hover:text-primary-dark"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Hàng sắp về ({shipments.length})
          </button>
          <button
            onClick={() => setActiveTabSub("history")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all border ${
              activeTabSub === "history"
                ? "bg-accent-gold text-primary-dark border-primary-dark shadow-accent-glow"
                : "text-primary border-transparent hover:text-primary-dark"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Nhật ký ({incomingMovements.length})
          </button>
        </div>
      </div>

      {activeTabSub === "incoming" ? (
        <div className="space-y-4">
          <div className="pb-2 border-b border-dashed border-primary/30 flex items-center justify-between">
            <span className="text-xs font-bold text-primary-dark flex items-center gap-1.5 uppercase tracking-wider">
              <span>📦</span> Danh sách lô hàng thầu chuẩn bị cập bến
            </span>
            <span className="text-[9px] bg-cream border border-primary-dark/30 text-primary-dark/70 font-mono font-bold px-2 py-0.5 rounded-md">Mobile Friendly</span>
          </div>

          {shipments.length === 0 ? (
            <div className="text-center py-20 bg-white border border-primary-dark rounded-3xl shadow-card">
              <Package className="w-12 h-12 text-primary-light mx-auto animate-pulse" />
              <p className="text-primary-dark font-bold text-sm mt-4 uppercase tracking-wider">Chưa có chuyến hàng thầu nào sắp về</p>
              <p className="text-primary-dark/80 text-xs mt-1 font-bold">Khi Ban mua sắm ký duyệt PO thầu, dữ liệu sẽ xuất hiện tự động tại đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {shipments.map((ship) => {
                const isDelayed = ship.status === "delayed";
                const isToday = ship.status === "today";
                
                return (
                  <div 
                    key={ship.id}
                    className={`bg-white border border-primary-dark rounded-3xl overflow-hidden transition-all flex flex-col justify-between border-l-8 ${
                      isDelayed 
                        ? "border-l-coral shadow-coral-glow animate-boom-pulse" 
                        : isToday 
                          ? "border-l-primary shadow-accent-glow" 
                          : "border-l-sky-blue shadow-sky-glow"
                    }`}
                  >
                    {/* Top Section */}
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[9px] bg-cream border border-primary-dark px-2 py-0.5 rounded text-primary-dark font-mono font-bold shadow-sm">
                            {ship.poCode}
                          </span>
                          <h4 className="text-sm font-bold text-primary-dark uppercase tracking-wider mt-2">{ship.item.name}</h4>
                          <p className="text-[9px] font-mono text-primary-dark/50 font-bold">SKU: {ship.item.sku}</p>
                        </div>
                        
                        {/* Status Badge */}
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase font-mono border ${
                          isDelayed 
                            ? "bg-coral-light/10 text-coral-dark border-coral" 
                            : isToday 
                              ? "bg-primary-bg text-primary-dark border-primary" 
                              : "bg-cream text-primary-dark/75 border-primary-dark/30"
                        }`}>
                          {isDelayed ? "🚨 Trễ Hạn" : isToday ? "⚡ Hôm Nay" : "⏳ Sắp Tới"}
                        </span>
                      </div>

                      {/* Shipment specs */}
                      <div className="bg-cream border border-primary-dark/30 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-primary-dark/60 font-bold uppercase tracking-wider">Số lượng đặt thầu</p>
                          <p className="text-sm font-bold text-primary-dark font-mono mt-0.5">
                            {ship.expectedQty} {ship.item.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-primary-dark/60 font-bold uppercase tracking-wider">Lịch cập bến</p>
                          <p className="text-[10px] font-bold text-primary-dark mt-0.5 truncate">
                            {ship.expectedDate}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="p-3.5 bg-primary-bg/20 border-t border-primary-dark flex items-center gap-2">
                      {/* Detailed Checkin trigger */}
                      <button
                        onClick={() => openReceiptModal(ship)}
                        className="flex-1 bg-white hover:bg-cream border border-primary-dark text-primary-dark font-bold text-xs py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <AlertTriangle className="w-4 h-4 text-coral" />
                        <span>Kiểm lệch &amp; Hỏng</span>
                      </button>

                      {/* One-Tap Mark Received Default Button */}
                      <button
                        onClick={() => handleQuickReceiveAll(ship)}
                        className="flex-1 bg-accent-gold hover:bg-accent-dark text-primary-dark font-bold text-xs py-2.5 rounded-full transition-all border border-primary-dark shadow-accent-glow transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4 text-primary-dark" />
                        <span>Khớp đủ 100%</span>
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
        <div className="bg-white border border-primary-dark p-6 rounded-3xl shadow-card space-y-4">
          <div className="pb-2 border-b border-dashed border-primary/20">
            <h3 className="text-sm font-bold text-primary-dark flex items-center gap-1.5 uppercase tracking-wider">
              <span>📋</span> Nhật Ký Biên Bản Nhập Kho Gần Nhất
            </h3>
          </div>

          <div className="divide-y divide-primary-dark/10 max-h-[500px] overflow-y-auto pr-1">
            {incomingMovements.length === 0 ? (
              <div className="text-center py-12 text-primary-dark/60 font-bold text-xs">
                Chưa có nhật ký nhập kho nào được ghi nhận.
              </div>
            ) : (
              incomingMovements.map((mov) => {
                const itemObj = inventory.find(i => i.id === mov.itemId);
                return (
                  <div key={mov.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs border-b border-primary-dark/10 last:border-b-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary-bg text-primary-dark border border-primary-dark font-bold px-2 py-0.5 rounded-md text-[9px] font-mono shadow-sm">
                          ĐÃ NHẬP KHO
                        </span>
                        {itemObj && <ItemIcon name={itemObj.name} size="sm" className="scale-75 border" />}
                        <span className="font-bold text-primary-dark text-sm">{itemObj ? itemObj.name : "Nguyên vật liệu ẩn"}</span>
                      </div>
                      <p className="text-[9.5px] text-primary-dark/60 font-bold">
                        Đơn thầu gốc: <span className="text-primary font-bold font-mono">{mov.referenceId}</span> | Thủ kho kiểm tra: {mov.createdBy}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-primary font-bold text-sm">
                        + {mov.quantity} {itemObj?.unit}
                      </p>
                      <p className="text-[9px] text-primary-dark/50 font-mono mt-0.5">{new Date(mov.createdAt).toLocaleString("vi-VN")}</p>
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
          <div className="bg-white border border-primary-dark w-full max-w-md rounded-3xl shadow-coral-glow overflow-hidden relative animate-scale-up">
            
            {successAnimation ? (
              <div className="p-8 py-16 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-bg border border-primary-dark text-primary-dark flex items-center justify-center animate-bounce shadow-accent-glow">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-base font-bold text-primary-dark uppercase tracking-wider">Ghi Nhận Thành Công!</h3>
                <p className="text-xs text-primary-dark/85 font-bold">Dữ liệu thực tồn kho bộ phận yêu cầu ăn đã được điều chỉnh cộng bù.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="bg-primary-dark text-white p-4.5 flex justify-between items-center border-b border-primary-dark">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4.5 h-4.5 text-accent-gold" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Biên Bản Nhập &amp; Thẩm Định</h3>
                  </div>
                  <button 
                    onClick={closeReceiptModal}
                    className="p-1 hover:bg-white/10 rounded-lg transition border border-transparent hover:border-white/10"
                  >
                    <X className="w-4.5 h-4.5 text-slate-200 hover:text-white" />
                  </button>
                </div>

                {/* Body details info */}
                <div className="p-5 space-y-4 text-slate-800">
                  <div className="flex items-start gap-3 bg-cream p-3.5 rounded-2xl border border-primary-dark shadow-sm">
                    <ItemIcon name={selectedShipment.item.name} size="md" className="shrink-0 border border-primary-dark shadow-sm" />
                    <div>
                      <h4 className="text-xs font-bold text-primary-dark uppercase tracking-wider">{selectedShipment.item.name}</h4>
                      <p className="text-[9px] text-primary-dark/60 font-mono font-bold">SKU: {selectedShipment.item.sku}</p>
                      <p className="text-[10px] text-primary-dark font-bold mt-2.5 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-primary" /> Lượng đặt thầu PO: {selectedShipment.expectedQty} {selectedShipment.item.unit}
                      </p>
                    </div>
                  </div>

                  {modalMode === "standard" ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-primary-bg/25 border border-primary rounded-2xl text-center space-y-1">
                        <p className="text-xs text-primary-dark/75 font-bold uppercase tracking-wider">Mọi hàng hóa khớp 100%?</p>
                        <p className="text-sm font-bold text-primary-dark font-mono">{selectedShipment.expectedQty} {selectedShipment.item.unit} hoàn hảo</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModalMode("discrepancy")}
                          className="flex-1 bg-cream hover:bg-[#fff0cb] border border-primary-dark text-primary-dark text-xs font-bold uppercase py-3 rounded-full shadow-sm transition transform active:scale-95 cursor-pointer"
                        >
                          Sai lệch thực tế
                        </button>
                        <button
                          onClick={() => handleQuickReceiveAll(selectedShipment)}
                          className="flex-1 bg-accent-gold hover:bg-accent-dark border border-primary-dark text-primary-dark text-xs font-bold uppercase py-3 rounded-full shadow-accent-glow transition transform active:scale-95 cursor-pointer"
                        >
                          Nhận đủ 100%
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-scale-up">
                      {/* Numeric Adjust Stepper (Flip7 Custom Rounded Square Design) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-primary-dark/80 font-bold uppercase tracking-widest block">
                          Số lượng thực nhận tại kho
                        </label>
                        <div className="flex items-center justify-between border border-primary-dark rounded-2xl p-1 bg-cream shadow-inner">
                          {/* Minus Button (Coral Themed) */}
                          <button
                            onClick={() => setReceivedQty(prev => Math.max(0, prev - 1))}
                            className="w-12 h-12 rounded-xl bg-coral-light/25 hover:bg-coral-light/45 border border-coral flex items-center justify-center font-bold text-coral-dark transition transform active:scale-90 cursor-pointer"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          
                          <div className="text-center">
                            <span className="text-lg font-bold font-mono text-primary-dark">
                              {receivedQty}
                            </span>
                            <span className="text-xs text-primary-dark/70 font-bold ml-1 uppercase">{selectedShipment.item.unit}</span>
                          </div>

                          {/* Plus Button (Teal Themed) */}
                          <button
                            onClick={() => setReceivedQty(prev => prev + 1)}
                            className="w-12 h-12 rounded-xl bg-primary-bg hover:bg-primary-light/20 border border-primary flex items-center justify-center font-bold text-primary-dark transition transform active:scale-90 cursor-pointer"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Damaged checkbox */}
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-coral-light/10 border border-coral rounded-2xl shadow-sm">
                        <input
                          type="checkbox"
                          id="damaged-check"
                          checked={isDamaged}
                          onChange={(e) => setIsDamaged(e.target.checked)}
                          className="w-4.5 h-4.5 accent-coral cursor-pointer border border-primary-dark"
                        />
                        <label htmlFor="damaged-check" className="text-xs font-bold text-coral-dark cursor-pointer select-none">
                          Hàng bị dập nát / Lỗi hỏng (Damaged)
                        </label>
                      </div>

                      {/* Notes input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-primary-dark/80 font-bold uppercase tracking-widest">
                          Ghi chú sự cố / Hao hụt
                        </label>
                        <input
                          type="text"
                          value={clerkNotes}
                          onChange={(e) => setClerkNotes(e.target.value)}
                          placeholder="Ví dụ: Giao thiếu 2 kg rau héo úa..."
                          className="w-full bg-cream border border-primary-dark/30 focus:border-primary-dark rounded-xl p-2.5 text-xs text-primary-dark font-bold focus:outline-none"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setModalMode("standard")}
                          className="flex-1 bg-white hover:bg-cream border border-primary-dark text-primary-dark text-xs font-bold uppercase py-3 rounded-full shadow-sm transition transform active:scale-95 cursor-pointer"
                        >
                          Quay lại
                        </button>
                        <button
                          onClick={handleDetailedReceiptSubmit}
                          className="flex-1 bg-coral hover:bg-coral-dark border border-primary-dark text-white text-xs font-bold uppercase py-3 rounded-full shadow-coral-glow transition transform active:scale-95 cursor-pointer"
                        >
                          Lập biên bản
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

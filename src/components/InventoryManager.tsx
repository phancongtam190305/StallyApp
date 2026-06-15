import React, { useState } from "react";
import { 
  Boxes, 
  History, 
  Settings2,
  PlusCircle,
  Truck
} from "lucide-react";
import { InventoryItem, StockMovement, UserRole } from "../types";
import ItemIcon from "./ItemIcon";

interface InventoryManagerProps {
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  currentRole: UserRole;
  onReceiveGoods: (itemId: string, qty: number, sourcePo: string) => void;
  onAdjustStock: (itemId: string, qty: number, movementType: "in" | "out" | "adjustment", notes: string) => void;
  onCreatePrFromStock?: (item: InventoryItem) => void;
}

export default function InventoryManager({
  inventory,
  stockMovements,
  currentRole,
  onReceiveGoods,
  onAdjustStock,
  onCreatePrFromStock
}: InventoryManagerProps) {

  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<string>("");
  const [adjustQty, setAdjustQty] = useState(10);
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjustNotes, setAdjustNotes] = useState("");

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) {
      alert("Vui lòng chọn sản phẩm cần điều chỉnh.");
      return;
    }
    if (adjustQty <= 0) {
      alert("Số lượng điều chỉnh kho phải lớn hơn 0.");
      return;
    }

    onAdjustStock(
      selectedItemForAdjust,
      adjustQty,
      adjustType === "in" ? "in" : "out",
      adjustNotes || "Điều chỉnh thủ công từ bảng quản lý"
    );

    // Reset Form
    setAdjustQty(10);
    setAdjustNotes("");
  };

  const handleReceiveGoodsSubmit = (itemId: string, maxQty: number) => {
    if (maxQty <= 0) return;
    onReceiveGoods(itemId, maxQty, "PO-AUTO-RELEASED");
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-normal font-display text-[#1A1A1A] tracking-tight">Cân đối Tồn kho (Stock)</h2>
        <p className="text-xs text-slate-500 mt-1">Quản lý số dư tồn thực tế, theo dõi đơn thầu thợ đang giao và kiểm kê luồng nhập xuất.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* INVENTORY TABLE - STOCK BALANCE (EPIC I) */}
        <div className="lg:col-span-8 lux-card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-150 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-accent-dark" /> Bảng cân đối tồn kho hiện tại
            </h3>
            <span className="text-[10px] bg-[#F7F5F0] border border-[#E6A756]/30 px-2 py-0.5 rounded font-mono font-bold text-accent-dark uppercase tracking-wider">Tồn kho realtime</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold bg-[#F7F5F0]">
                  <th className="p-3 pl-2">Vật tư / SKU</th>
                  <th className="p-3">Ngành hàng</th>
                  <th className="p-3 text-center">Ngưỡng tối thiểu</th>
                  <th className="p-3 text-center">Tồn khả dụng</th>
                  <th className="p-3 text-center">Hàng đang về</th>
                  <th className="p-3 text-right pr-2">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const isLow = item.quantityAvailable < item.minStockLevel;
                  const hasOrder = item.quantityOnOrder > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 pl-2 space-y-0.5">
                        <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                          {isLow && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Dưới định mức" />
                          )}
                          <ItemIcon name={item.name} size="sm" className="shadow-sm scale-90 border-slate-200/40" />
                          <span>{item.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-medium">{item.sku}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{item.category}</td>
                      <td className="p-3 text-center font-mono text-slate-500 font-bold">
                        {item.minStockLevel} {item.unit}
                      </td>
                      <td className={`p-3 text-center font-extrabold font-mono ${isLow ? "text-rose-700 bg-rose-50 rounded-xl" : "text-slate-800"}`}>
                        {item.quantityAvailable} {item.unit}
                      </td>
                      <td className="p-3 text-center font-mono text-accent-dark font-extrabold">
                        {item.quantityOnOrder > 0 ? (
                          <span className="bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50 animate-pulse text-[11px]">
                            + {item.quantityOnOrder} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right pr-2">
                        {hasOrder ? (
                          currentRole === "warehouse" ? (
                            <button
                              id="btn-receive-po"
                              onClick={() => handleReceiveGoodsSubmit(item.id, item.quantityOnOrder)}
                              className="bg-primary-dark hover:bg-[#000000] text-white text-[10px] p-2 leading-none rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1 ml-auto"
                            >
                              <Truck className="w-3.5 h-3.5" /> Xác nhận Nhập PO
                            </button>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 italic font-medium block">Hàng đang vận chuyển</span>
                          )
                        ) : isLow ? (
                          <div className="flex flex-col items-end gap-1">
                            {onCreatePrFromStock && (
                              <button
                                onClick={() => onCreatePrFromStock(item)}
                                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold p-1 px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 select-none"
                              >
                                Khởi tạo thầu bù kho
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[10px] font-medium">Bình ổn</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CONTROLS AREA - RECEIPT & MANUAL ADJUSTMENTS */}
        <div className="lg:col-span-4 space-y-5">
          {/* ADJUSTMENT FORM */}
          <div className="lux-card p-5 space-y-4">
            <div className="border-b border-slate-150 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-accent-dark" /> Cân đối kho thủ công
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Xử lý hao hụt vật tư thực tế tại bếp ăn.</p>
            </div>

            {currentRole === "warehouse" ? (
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Chọn sản phẩm</label>
                  <select
                    value={selectedItemForAdjust}
                    onChange={(e) => setSelectedItemForAdjust(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-850"
                  >
                    <option value="">-- Bấm chọn vật tư --</option>
                    {inventory.map(it => (
                      <option key={it.id} value={it.id}>{it.name} (Hợp lệ: {it.quantityAvailable})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Hình thức</label>
                    <select
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as "in" | "out")}
                      className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-850"
                    >
                      <option value="in">Cộng thêm (+ In)</option>
                      <option value="out">Trừ bớt (- Out)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Số lượng</label>
                    <input
                      type="number"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                      min="1"
                      className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2 text-xs text-slate-850"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Lý do điều chỉnh</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Ví dụ: Bếp hỏng, kiểm sẩy lạnh..."
                    className="w-full bg-white border border-slate-200 focus:outline-none focus:border-accent-gold rounded-xl p-2.5 text-xs text-slate-850 placeholder-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-adjust-inventory"
                  className="w-full lux-button justify-center"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Ghi biến động kho
                </button>
              </form>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-medium text-center rounded-xl leading-relaxed">
                Hệ quản lý đang ở chế độ xem. Vui lòng **Đăng xuất** và đăng nhập lại dưới vai trò **Thủ Kho** để tiến hành điều hòa cân đối dòng kho thực nghiệm.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STOCK MOVEMENTS CHRONOLOGY LEDGER (Nhật ký dòng kho) */}
      <div className="lux-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-150 pb-3">
          <History className="w-4 h-4 text-accent-dark" /> Nhật ký vòng biến động dòng kho
        </h3>
        
        <div className="max-h-64 overflow-y-auto pr-1">
          {stockMovements.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center font-medium">Chưa ghi nhận bất kỳ sự dịch kho nào.</p>
          ) : (
            <div className="space-y-2">
              {[...stockMovements].reverse().map((mov) => {
                const itemObj = inventory.find(i => i.id === mov.itemId);
                const isIn = mov.movementType === "in";
                const isOut = mov.movementType === "out";

                return (
                  <div key={mov.id} className="bg-[#F7F5F0]/70 p-3 rounded-xl border border-[#E6A756]/20 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${
                          isIn ? "bg-emerald-50 border border-emerald-200 text-emerald-700" :
                          isOut ? "bg-rose-50 border border-rose-200 text-rose-700" :
                          "bg-slate-150 text-slate-600"
                        }`}>
                          {mov.movementType === "in" ? "NHẬP KHO (+)" : mov.movementType === "out" ? "XUẤT KHO (-)" : "ĐIỀU CHỈNH"}
                        </span>
                        {itemObj && <ItemIcon name={itemObj.name} size="sm" className="shadow-sm scale-75 border-slate-200/40" />}
                        <span className="text-[11px] text-slate-700 font-extrabold">{itemObj ? itemObj.name : "Vật tư ẩn"}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Chứng từ: <span className="text-slate-500 font-mono font-bold">{mov.referenceId}</span> | Người duyệt: {mov.createdBy}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-bold font-mono ${isIn ? "text-emerald-700" : isOut ? "text-rose-700" : "text-accent-dark"}`}>
                        {isIn ? "+" : isOut ? "-" : ""} {mov.quantity} {itemObj?.unit}
                      </span>
                      <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">{new Date(mov.createdAt).toLocaleTimeString("vi-VN")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

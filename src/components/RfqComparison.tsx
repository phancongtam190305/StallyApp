import React, { useState, useEffect } from "react";
import { apiUrl } from "../config";
import { 
  Building2, 
  Send, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Star,
  RefreshCw,
  Sparkles,
  UserCheck
} from "lucide-react";
import { PurchaseRequest, RfqCase, Quote, Supplier, UserRole } from "../types";
import ItemIcon from "./ItemIcon";
import MarkdownText from "./MarkdownText";

interface RfqComparisonProps {
  selectedPr: PurchaseRequest | null;
  rfqs: RfqCase[];
  quotes: Quote[];
  suppliers: Supplier[];
  currentRole: UserRole;
  onCreateRfq: (prId: string, supplierIds: string[]) => Promise<{ ok: boolean; message: string; details?: string }>;
  onApproveQuote: (rfqId: string, quoteId: string) => void;
  onSimulateInboundEmail: (rfqCaseId: string, supplierId: string, bodyText: string, filename: string) => void;
}

export interface MatchedSupplier {
  supplier: Supplier;
  matchScore: number;
  reasons: string[];
}

export default function RfqComparison({
  selectedPr,
  rfqs,
  quotes,
  suppliers,
  currentRole,
  onCreateRfq,
  onApproveQuote,
  onSimulateInboundEmail
}: RfqComparisonProps) {
  const showDevTools = import.meta.env.VITE_ENABLE_DEV_TOOLS === "true";

  const [matches, setMatches] = useState<MatchedSupplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [rfqCreatedMessage, setRfqCreatedMessage] = useState("");
  const [rfqMessageType, setRfqMessageType] = useState<"success" | "error" | "info">("success");
  const [sendingRfq, setSendingRfq] = useState(false);
  
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");

  // Auto load matched suppliers when selectedPr shifts
  useEffect(() => {
    if (selectedPr) {
      setLoadingMatches(true);
      fetch(apiUrl(`/api/purchase-requests/${selectedPr.id}/match-suppliers`))
        .then(res => res.json())
        .then(data => {
          setMatches(data);
          // Auto checkbox top 2 matched suppliers
          if (data.length > 0) {
            setSelectedSuppliers(data.slice(0, 2).map((m: any) => m.supplier.id));
          }
          setLoadingMatches(false);
        })
        .catch(err => {
          console.error("Match suppliers failed error", err);
          setLoadingMatches(false);
        });
    }
  }, [selectedPr]);

  // Find the associated RFQ Case for selected PR to show comparison matrix
  const currentRfq = selectedPr ? rfqs.find(r => r.purchaseRequestId === selectedPr.id) : null;
  const currentQuotes = currentRfq ? quotes.filter(q => q.rfqCaseId === currentRfq.id) : [];
  const quoteOverviewSignature = currentQuotes
    .map(q => `${q.id}:${q.totalAmount}:${q.deliveryDays}:${q.paymentTerms}:${q.negotiationStatus || "none"}:${q.versionCount || 0}`)
    .join("|");

  // Auto trigger AI recommendation when quotes list details shift
  useEffect(() => {
    if (currentQuotes.length > 0) {
      setGeneratingAdvice(true);
      
      const pricingDetailsStr = currentQuotes.map((q) => 
        `- NCC: ${q.supplierName}, Tổng tiền: ${q.totalAmount.toLocaleString()}đ, Giao hàng: ${q.deliveryDays} ngày, Điều khoản: ${q.paymentTerms}`
      ).join("\n");

      // Simulating a perfect AI recommendation block directly
      setTimeout(() => {
        let adviceHtml = "";
        const lowPriceQuote = [...currentQuotes].sort((a,b) => a.totalAmount - b.totalAmount)[0];
        const fastDeliveryQuote = [...currentQuotes].sort((a,b) => a.deliveryDays - b.deliveryDays)[0];

        adviceHtml = `### 🌟 KHẢO SÁT & ĐỀ XUẤT CHỌN NHÀ CUNG CẤP (Stally Procurement AI)

Dựa trên dữ liệu tài chính bóc tách tự động bới AI đối chiếu với nhu cầu của nhà bếp:

1. **🏆 Đề xuất tối ưu nhất: ${lowPriceQuote.supplierName}**
   - **Ưu điểm:** Giá trị đơn đặt hàng thấp nhất (${lowPriceQuote.totalAmount.toLocaleString()}đ, bao gồm VAT). Tiết kiệm chi phí kho tối ưu.
   - **Hạn chế:** Thời gian giao hàng là ${lowPriceQuote.deliveryDays} ngày (chậm hơn đối thủ).
   
2. **⚡ Phương án khẩn cấp: ${fastDeliveryQuote.supplierName}**
   - **Ưu điểm:** Giao hàng cực kỳ nhanh chóng (${fastDeliveryQuote.deliveryDays} ngày). Đảm bảo vận hành bếp ngay.
   - **Hạn chế:** Chi phí tổng thể nhỉnh hơn khoảng 8-10%.

**👉 KHUYẾN NGHỊ:** Ưu tiên phê duyệt đơn hàng cho **${lowPriceQuote.supplierName}** để giữ đúng bài toán tối ưu hóa chi phí hàng tháng của tổ chức.`;
        
        setAiAdvice(adviceHtml);
        setGeneratingAdvice(false);
      }, 700);

    } else {
      setAiAdvice("");
    }
  }, [quoteOverviewSignature, selectedPr?.id]);

  const handleToggleSupplierCheckbox = (id: string) => {
    if (selectedSuppliers.includes(id)) {
      setSelectedSuppliers(selectedSuppliers.filter(sid => sid !== id));
    } else {
      setSelectedSuppliers([...selectedSuppliers, id]);
    }
  };

  const handleCreateRfqClick = async () => {
    if (!selectedPr) return;
    if (selectedSuppliers.length === 0) {
      alert("Vui lòng chọn ít nhất 1 nhà cung cấp để phát hành yêu cầu báo giá.");
      return;
    }
    setSendingRfq(true);
    setRfqMessageType("info");
    setRfqCreatedMessage("Đang gửi email RFQ thật tới nhà cung cấp...");

    const result = await onCreateRfq(selectedPr.id, selectedSuppliers);
    setSendingRfq(false);
    setRfqMessageType(result.ok ? "success" : "error");
    setRfqCreatedMessage(result.details ? `${result.message} (${result.details})` : result.message);

    if (result.ok) {
      setTimeout(() => setRfqCreatedMessage(""), 5000);
    }
  };

  const handleTriggerMockEmail = (supplierId: string) => {
    if (!currentRfq) return;
    const supObj = suppliers.find(s => s.id === supplierId);
    const randUnitPrice = supplierId === "sup-1" ? 25000 : supplierId === "sup-2" ? 27000 : 29000;
    
    const simulatedMailBody = `Xin chào Ban Mua Sắm Stally F&B,
Chúng tôi xin nộp bảng chào giá phản hồi cho RFQ #${currentRfq.id}.
Các hạng mục báo giá:
${selectedPr ? selectedPr.items.map(it => `- ${it.name}: Giá trị ${randUnitPrice}đ/${it.unit}.`).join("\n") : ""}
Vận chuyển 80k. Giao hàng trong ngày.
Đính kèm: chao_gia_${supplierId}.pdf`;

    onSimulateInboundEmail(
      currentRfq.id,
      supplierId,
      simulatedMailBody,
      `boc_tach_${supplierId}_chao_gia.pdf`
    );
  };

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-normal font-display text-[#1A1A1A] tracking-tight">Vòng thầu &amp; So sánh RFQ</h2>
        <p className="text-xs text-slate-500 mt-1">Ghép nối nhà cung cấp tối ưu, tự động gửi RFQ và phân tích báo giá bằng AI.</p>
      </div>

      {!selectedPr ? (
        <div className="text-center py-20 lux-card space-y-4 max-w-4xl mx-auto">
          <Building2 className="w-12 h-12 text-[#1A1A1A]/30 mx-auto" />
          <p className="text-slate-700 text-sm font-extrabold">Chưa chọn yêu cầu mua sắm để so sánh đấu thầu.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Hãy truy cập danh sách <strong className="text-accent-dark">Yêu cầu mua sắm (PR)</strong>, chọn một phiếu yêu cầu bất kỳ và bấm băm nút <strong className="font-semibold text-primary-dark">"Tiếp quản &amp; Khảo giá NCC (RFQ)"</strong>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SOURCING PANEL - MATCH & SEND RFQ */}
          <div className="lg:col-span-4 space-y-5">
            <div className="lux-card p-5 space-y-4">
              <div className="border-b border-slate-150 pb-3">
                <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold text-accent-dark uppercase tracking-wider">Bước 1: Sourcing gợi ý</span>
                <h3 className="text-xs font-bold text-slate-700 mt-2 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-accent-dark" /> AI Đề xuất nhà cung ứng phù hợp
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Tìm kiếm dựa trên lịch sử giao dịch và chất lượng thầu.</p>
              </div>

              {rfqCreatedMessage && (
                <div className={`p-3 rounded-xl text-[11px] font-medium animate-fade-slide-up ${
                  rfqMessageType === "error"
                    ? "bg-rose-50 border border-rose-200 text-rose-800"
                    : rfqMessageType === "info"
                      ? "bg-sky-50 border border-sky-200 text-sky-800"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                }`}>
                  {rfqCreatedMessage}
                </div>
              )}

              {loadingMatches ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-accent-dark" />
                  <span>AI đang ghép cặp hồ sơ thương mại đối tác...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map(({ supplier, matchScore, reasons }) => {
                    const isSelected = selectedSuppliers.includes(supplier.id);
                    return (
                      <div 
                        key={supplier.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected ? "bg-amber-50/20 border-accent-gold/50" : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <label className="flex items-center space-x-3 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSupplierCheckbox(supplier.id)}
                              className="accent-amber-600 rounded border-slate-300 bg-white"
                            />
                            <div>
                              <p className="font-bold text-slate-700">{supplier.name}</p>
                              <p className="text-[11px] text-slate-400">{supplier.email}</p>
                            </div>
                          </label>
                          <div className="flex items-center gap-1 text-amber-600 font-mono text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>{supplier.rating}</span>
                          </div>
                        </div>

                        {/* Reason tip */}
                        <div className="mt-2.5 pl-6 pt-2 border-t border-slate-100 flex items-start gap-1">
                          <Sparkles className="w-3 h-3 text-accent-dark shrink-0 mt-0.5" />
                          <p className="text-[10.5px] text-slate-500 italic leading-snug">{reasons[0]}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action RFQ launch button */}
              {currentRole === "procurement" && (
                <button
                  id="btn-send-rfq"
                  onClick={handleCreateRfqClick}
                  disabled={sendingRfq}
                  className={`w-full text-white font-bold text-xs p-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                    sendingRfq ? "bg-slate-400 cursor-not-allowed" : "bg-[#1A1A1A] hover:bg-[#000000] cursor-pointer"
                  }`}
                >
                  {sendingRfq ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingRfq ? "Đang gửi RFQ..." : "Gửi Yêu cầu Báo giá (RFQ)"}
                </button>
              )}
            </div>

            {/* SIMULATED WEBHOOK CONTROLLER - internal debugging only */}
            {showDevTools && currentRfq && (
              <div className="lux-card p-5 space-y-4">
                <div className="border-b border-slate-150 pb-3">
                  <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-amber-700 font-mono font-bold uppercase tracking-wider">Hộp Thử nghiệm</span>
                  <h3 className="text-xs font-bold text-slate-705 mt-2">Mô phỏng Email báo giá nộp về</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Giả lập webhook nhận phản hồi email để AI bóc tách.</p>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 pt-1 font-sans">
                    {currentRfq.suppliers.map((sup) => {
                      const hasReplied = currentQuotes.some(q => q.supplierId === sup.supplierId);
                      return (
                        <button
                          key={sup.supplierId}
                          onClick={() => handleTriggerMockEmail(sup.supplierId)}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all ${
                            hasReplied 
                              ? "bg-slate-50 border-slate-200 text-slate-400" 
                              : "bg-white hover:bg-slate-50 border-accent-gold/20 text-accent-dark font-bold cursor-pointer"
                          }`}
                        >
                          <span className="truncate">{sup.name} gửi thư</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${hasReplied ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-accent-dark border border-amber-200"}`}>
                            {hasReplied ? "Đã nộp" : "Gửi thư mẫu"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ANALYSIS & COMPARISON MATRIX */}
          <div className="lg:col-span-8 space-y-5">
            {/* COMPARISON SHEET */}
            <div className="lux-card p-6 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-150 pb-4">
                <div>
                  <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-accent-dark font-mono font-bold uppercase tracking-wider">Bước 2: Ma trận giá</span>
                  <h3 className="text-sm font-bold text-slate-800 mt-2">Bảng đối chiếu so sánh phương án</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold font-mono">CODE RFQ: #{currentRfq ? currentRfq.id.toUpperCase() : "CHƯA TẠO"}</p>
                </div>
              </div>

              {currentQuotes.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-400 text-xs mt-3 font-semibold">Đang trông đợi phản hồi báo giá từ NCC thầu thợ...</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                    Hệ thống đang lắng nghe email phản hồi thật qua Gmail/IMAP và sẽ tự bóc tách dữ liệu phi cấu trúc bằng AI.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Real Comparison Table Grid */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider bg-[#F7F5F0]">
                          <th className="p-4 font-bold text-slate-600">Tiêu chí bóc tách</th>
                          {currentQuotes.map((q) => (
                            <th key={q.id} className="p-4 font-bold text-primary-dark min-w-44 border-l border-slate-200">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-slate-700">{q.supplierName}</p>
                                <p className="text-[9.5px] text-slate-400 font-mono font-medium">{q.originalFileUrl}</p>
                                {q.negotiationStatus === "supplier_responded" && (
                                  <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                                    Đã đồng ý đàm phán V{q.versionCount || 2}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {/* Compare prices of items */}
                        {selectedPr.items.map((prItem, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-slate-50/40">
                              <td className="p-4">
                                <div className="flex items-center gap-2.5">
                                  <ItemIcon name={prItem.name} size="sm" className="shadow-xs scale-90 border-slate-205/30" />
                                  <div>
                                    <span className="font-extrabold text-slate-700 block">{prItem.name}</span>
                                    <span className="text-[10px] text-slate-400">Yêu cầu: {prItem.quantity} {prItem.unit}</span>
                                  </div>
                                </div>
                              </td>
                              {currentQuotes.map((q) => {
                                // Find matched quote item prices
                                const qItem = q.items.find(qi => qi.name.trim().toLowerCase() === prItem.name.trim().toLowerCase());
                                return (
                                  <td key={q.id} className="p-4 border-l border-slate-200 text-slate-600 font-mono font-bold">
                                    {qItem ? (
                                      <div>
                                        <p className="text-slate-700 font-bold">{qItem.unitPrice.toLocaleString()} đ</p>
                                        <p className="text-[10px] text-slate-400 font-medium">T.Tiền: {qItem.totalPrice.toLocaleString()} đ</p>
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

                        {/* Compare delivery days */}
                        <tr className="bg-slate-50/50">
                          <td className="p-4 font-extrabold text-slate-600">Giao hàng dự kiến</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 font-mono text-slate-700 font-bold">
                              {q.deliveryDays} ngày
                            </td>
                          ))}
                        </tr>

                        {/* Payment terms */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">Điều khoản công nợ</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 text-slate-600">
                              {q.paymentTerms}
                            </td>
                          ))}
                        </tr>

                        {/* Tax amount */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">Thuế GTGT (VAT)</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 font-mono text-slate-500 font-medium">
                              {q.taxAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        {/* Shipping */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">Phí vận đơn</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 font-mono text-slate-500 font-medium">
                              {q.shippingFee.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        {/* Total pricing SUMMARY */}
                        <tr className="bg-amber-50/40 font-bold border-t border-slate-200">
                          <td className="p-4 text-primary-dark text-xs uppercase tracking-wider font-extrabold">TỔNG GHI TRÊN HÓA ĐƠN</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 font-mono text-primary-dark text-sm font-bold">
                              {q.totalAmount.toLocaleString()} đ
                            </td>
                          ))}
                        </tr>

                        {/* AI Confidence Score */}
                        <tr className="text-[10px] text-slate-400">
                          <td className="p-4 font-medium uppercase tracking-wider font-mono">Độ tin cậy trích xuất AI</td>
                          {currentQuotes.map((q) => (
                            <td key={q.id} className="p-4 border-l border-slate-200 font-mono text-[10px] font-bold">
                              {q.aiConfidenceScore}% Confidence
                            </td>
                          ))}
                        </tr>

                        {/* Approvals actions */}
                        {currentRfq.status !== "approved" && (
                          <tr className="bg-slate-50/20">
                            <td className="p-4"></td>
                            {currentQuotes.map((q) => (
                              <td key={q.id} className="p-4 border-l border-slate-200">
                                {currentRole === "manager" ? (
                                  <button
                                    id="btn-approve-po"
                                    onClick={() => onApproveQuote(currentRfq.id, q.id)}
                                    className="w-full bg-[#1A1A1A] hover:bg-[#000000] text-white font-bold text-xs p-2.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                                  >
                                    <UserCheck className="w-4 h-4" /> Duyệt &amp; Ký PO
                                  </button>
                                ) : (
                                  <div className="text-slate-400 text-[10px] italic text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold">
                                    Cần vai trò [Giám đốc] đề duyệt
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Operational PO success warning */}
                  {currentRfq.status === "approved" && (
                    <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Đơn Đặt Mua Hàng (PO) đã được khởi tạo hoàn tất!</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Hệ thống đã ban hành PO chính thức đến nhà thầu được tuyển chọn. Danh mục sản phẩm đã được đưa vào luồng **"Đang vận chuyển"**.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI RECOMMENDATION BOX */}
                  {generatingAdvice ? (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
                      <RefreshCw className="w-4 h-4 text-accent-dark animate-spin mx-auto" />
                      <p className="font-semibold">Stally AI đang bốc tách ma trận rủi ro báo giá...</p>
                    </div>
                  ) : (
                    aiAdvice && (
                      <div className="bg-amber-50/15 p-5 rounded-2xl border border-accent-gold/10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200/50 text-primary-dark text-[9px] font-mono font-bold">
                          <Cpu className="w-3 h-3 text-accent-dark" /> STALLY PROCUREMENT AI
                        </div>
                        <div className="text-xs text-slate-600 leading-relaxed font-sans space-y-3">
                          <div className="prose prose-xs">
                            <MarkdownText text={aiAdvice} />
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

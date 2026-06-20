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
  UserCheck,
  SlidersHorizontal,
  Clock,
  ShieldAlert,
  Coins
} from "lucide-react";
import { PurchaseRequest, RfqCase, Quote, Supplier, UserRole } from "../types";
import { getQuoteRiskFlags, quoteNeedsHumanReview } from "../quoteRisk";
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
  onOpenPurchaseRequests: () => void;
  t: (key: any) => string;
  locale: "vi" | "en";
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
  onSimulateInboundEmail,
  onOpenPurchaseRequests,
  t,
  locale
}: RfqComparisonProps) {
  const showDevTools = import.meta.env.VITE_ENABLE_DEV_TOOLS === "true";

  const translateRiskFlag = (flag: string): string => {
    if (flag.includes("dưới ngưỡng")) {
      const scoreMatch = flag.match(/cậy (\d+)\/100/);
      const score = scoreMatch ? scoreMatch[1] : "0";
      return t("riskConfidenceUnderThreshold").replace("{score}", score);
    }
    if (flag.includes("Tổng tiền không hợp lệ")) return t("riskInvalidTotalAmount");
    if (flag.includes("Tổng tiền quá nhỏ")) return t("riskTotalAmountTooSmall");
    if (flag.includes("Thiếu điều khoản")) return t("riskMissingPaymentTerms");
    if (flag.includes("thiếu đơn giá")) return t("riskMissingUnitPrice");
    return flag;
  };

  const [matches, setMatches] = useState<MatchedSupplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [rfqCreatedMessage, setRfqCreatedMessage] = useState("");
  const [rfqMessageType, setRfqMessageType] = useState<"success" | "error" | "info">("success");
  const [sendingRfq, setSendingRfq] = useState(false);
  
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");

  // Ranking & filtering states
  type RankingMode = "best_value" | "cheapest" | "fastest" | "reliable" | "least_risk" | "custom";
  const [rankingMode, setRankingMode] = useState<RankingMode>("best_value");
  const [customWeights, setCustomWeights] = useState({
    price: 0.40,
    delivery: 0.25,
    reliability: 0.20,
    payment: 0.10,
    risk: 0.30
  });

  // Modal confirm states
  const [showApprovalConfirmModal, setShowApprovalConfirmModal] = useState(false);
  const [pendingApprovalQuote, setPendingApprovalQuote] = useState<Quote | null>(null);

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
  const riskyQuoteCount = currentQuotes.filter(quoteNeedsHumanReview).length;
  const quoteOverviewSignature = currentQuotes
    .map(q => `${q.id}:${q.totalAmount}:${q.deliveryDays}:${q.paymentTerms}:${q.negotiationStatus || "none"}:${q.versionCount || 0}`)
    .join("|");

  // Helper to compute payment terms score (deferred/net terms are better than prepaid/COD)
  const getPaymentTermScore = (terms: string): number => {
    const t = terms?.toLowerCase() || "";
    if (t.includes("90") || t.includes("90 ngày")) return 1.0;
    if (t.includes("60") || t.includes("60 ngày")) return 0.9;
    if (t.includes("45") || t.includes("45 ngày")) return 0.8;
    if (t.includes("30") || t.includes("30 ngày")) return 0.7;
    if (t.includes("15") || t.includes("15 ngày")) return 0.5;
    if (t.includes("trả chậm") || t.includes("công nợ")) return 0.6;
    if (t.includes("cod") || t.includes("giao hàng trả ngay") || t.includes("nhận hàng thanh toán")) return 0.3;
    if (t.includes("trả trước") || t.includes("thanh toán trước") || t.includes("100% trước")) return 0.1;
    return 0.4; // default baseline score
  };

  // Pre-calculate min/max bounds for scaling active quotes
  const validQuotes = currentQuotes.filter(q => q.totalAmount !== null && q.totalAmount !== undefined && q.totalAmount > 0);
  const minPrice = validQuotes.length > 0 ? Math.min(...validQuotes.map(q => q.totalAmount)) : 0;
  const maxPrice = validQuotes.length > 0 ? Math.max(...validQuotes.map(q => q.totalAmount)) : 0;
  
  const minDelivery = validQuotes.length > 0 ? Math.min(...validQuotes.map(q => q.deliveryDays || 0)) : 0;
  const maxDelivery = validQuotes.length > 0 ? Math.max(...validQuotes.map(q => q.deliveryDays || 0)) : 0;

  // Multi-attribute utility score for ranking
  const calculateFinalScore = (q: Quote, weights: typeof customWeights) => {
    if (q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0) return -999;
    
    const pScore = maxPrice === minPrice ? 1.0 : (maxPrice - q.totalAmount) / (maxPrice - minPrice);
    const dScore = maxDelivery === minDelivery ? 1.0 : (maxDelivery - q.deliveryDays) / (maxDelivery - minDelivery);
    const sup = suppliers.find(s => s.id === q.supplierId);
    const rating = sup ? sup.rating : 3;
    const rScore = ((q.aiConfidenceScore / 100) + (rating / 5)) / 2;
    const payScore = getPaymentTermScore(q.paymentTerms);
    const flags = getQuoteRiskFlags(q);
    const rPenalty = flags.length;
    
    let score = (pScore * weights.price) + 
                (dScore * weights.delivery) + 
                (rScore * weights.reliability) + 
                (payScore * weights.payment) - 
                (rPenalty * weights.risk);

    // Apply severe penalty if serious risk exists to keep it from being "best recommendation"
    const hasSeriousRisk = q.aiConfidenceScore < 50 || q.totalAmount <= 0 || flags.some(f => f.includes("không hợp lệ") || f.includes("bằng 0") || f.includes("thiếu đơn giá"));
    if (hasSeriousRisk) {
      score -= 5.0;
    }

    return score;
  };

  // Find best recommended quote (highest best_value score, filtering out serious risks)
  const defaultWeights = { price: 0.40, delivery: 0.25, reliability: 0.20, payment: 0.10, risk: 0.30 };
  const bestValueQuote = validQuotes.length > 0 
    ? [...validQuotes]
        .map(q => ({ q, score: calculateFinalScore(q, defaultWeights) }))
        .filter((item) => {
          const flags = getQuoteRiskFlags(item.q);
          const hasSeriousRisk = item.q.aiConfidenceScore < 50 || item.q.totalAmount <= 0 || flags.some(f => f.includes("không hợp lệ") || f.includes("bằng 0") || f.includes("thiếu đơn giá"));
          return !hasSeriousRisk;
        })
        .sort((a, b) => b.score - a.score)[0]?.q
    : null;

  const cheapestQuote = validQuotes.length > 0 ? [...validQuotes].sort((a, b) => a.totalAmount - b.totalAmount)[0] : null;
  const fastestQuote = validQuotes.length > 0 ? [...validQuotes].sort((a, b) => a.deliveryDays - b.deliveryDays)[0] : null;

  // Retrieve badges based on quote metrics
  const getQuoteBadges = (q: Quote) => {
    const badges: { text: string; colorClass: string }[] = [];
    const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0 || q.items.length === 0;
    
    if (isMissing) {
      badges.push({ text: "Thiếu dữ liệu", colorClass: "bg-rose-50 text-rose-750 border-rose-200" });
      return badges;
    }

    const flags = getQuoteRiskFlags(q);

    if (bestValueQuote && q.id === bestValueQuote.id) {
      badges.push({ text: "Tối ưu nhất", colorClass: "bg-amber-50 text-amber-800 border-amber-300 font-extrabold shadow-xs" });
    }
    if (cheapestQuote && q.id === cheapestQuote.id) {
      badges.push({ text: "Rẻ nhất", colorClass: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold" });
    }
    if (fastestQuote && q.id === fastestQuote.id) {
      badges.push({ text: "Giao nhanh nhất", colorClass: "bg-sky-50 text-sky-850 border-sky-300 font-semibold" });
    }
    if (q.aiConfidenceScore < 65) {
      badges.push({ text: "Độ tin cậy thấp", colorClass: "bg-orange-50 text-orange-700 border-orange-200" });
    }
    if (flags.some(f => f.includes("Tổng tiền") || f.includes("thiếu đơn giá") || f.includes("Tổng tiền không hợp lệ"))) {
      badges.push({ text: "Cần kiểm tra giá", colorClass: "bg-red-50 text-red-750 border-red-200 animate-pulse" });
    }
    if (flags.length === 0) {
      badges.push({ text: "Ít rủi ro", colorClass: "bg-teal-50 text-teal-700 border-teal-200" });
    }
    return badges;
  };

  // Perform sorting based on active mode
  const sortedQuotes = [...currentQuotes].sort((a, b) => {
    const aMissing = a.totalAmount === null || a.totalAmount === undefined || a.totalAmount <= 0 || a.items.length === 0;
    const bMissing = b.totalAmount === null || b.totalAmount === undefined || b.totalAmount <= 0 || b.items.length === 0;
    if (aMissing && !bMissing) return 1;
    if (!aMissing && bMissing) return -1;
    if (aMissing && bMissing) return 0;

    switch (rankingMode) {
      case "cheapest":
        return a.totalAmount - b.totalAmount;
      case "fastest":
        return a.deliveryDays - b.deliveryDays;
      case "reliable": {
        const aSup = suppliers.find(s => s.id === a.supplierId);
        const bSup = suppliers.find(s => s.id === b.supplierId);
        const aRel = ((a.aiConfidenceScore / 100) + ((aSup ? aSup.rating : 3) / 5)) / 2;
        const bRel = ((b.aiConfidenceScore / 100) + ((bSup ? bSup.rating : 3) / 5)) / 2;
        return bRel - aRel;
      }
      case "least_risk": {
        const aFlags = getQuoteRiskFlags(a).length;
        const bFlags = getQuoteRiskFlags(b).length;
        if (aFlags !== bFlags) {
          return aFlags - bFlags;
        }
        return a.totalAmount - b.totalAmount;
      }
      case "best_value": {
        const defaultWeights = { price: 0.40, delivery: 0.25, reliability: 0.20, payment: 0.10, risk: 0.30 };
        return calculateFinalScore(b, defaultWeights) - calculateFinalScore(a, defaultWeights);
      }
      case "custom": {
        return calculateFinalScore(b, customWeights) - calculateFinalScore(a, customWeights);
      }
      default:
        return 0;
    }
  });

  // Auto trigger AI recommendation when quotes list details shift
  useEffect(() => {
    if (currentQuotes.length > 0) {
      setGeneratingAdvice(true);

      // Simulating a perfect AI recommendation block directly
      setTimeout(() => {
        let adviceHtml = "";
        const reviewableQuotes = currentQuotes.filter(q => !quoteNeedsHumanReview(q));
        const lowPriceQuote = [...reviewableQuotes].sort((a,b) => a.totalAmount - b.totalAmount)[0];
        const fastDeliveryQuote = [...reviewableQuotes].sort((a,b) => a.deliveryDays - b.deliveryDays)[0];

        if (!lowPriceQuote || !fastDeliveryQuote) {
          setAiAdvice(`### CHƯA CÓ ĐỀ XUẤT TỐI ƯU TỰ ĐỘNG

Tất cả báo giá hiện có đang có red-flag hoặc thiếu dữ liệu quan trọng. Hệ thống không đưa các báo giá này vào phân tích tối ưu tự động.

**Hành động cần làm:** Người mua cần đối chiếu email/file gốc, xác nhận thủ công nếu báo giá hợp lệ, rồi mới trình duyệt PO.`);
          setGeneratingAdvice(false);
          return;
        }

        const amountLow = lowPriceQuote.totalAmount.toLocaleString();
        const daysLow = lowPriceQuote.deliveryDays;
        const daysFast = fastDeliveryQuote.deliveryDays;

        adviceHtml = `### ${t("aiAdviceTitle")}

${t("aiAdviceHeader")}

1. **${t("aiAdviceOption1Title").replace("{supplier}", lowPriceQuote.supplierName)}**
   - **${locale === "en" ? "Pros" : "Ưu điểm"}:** ${t("aiAdviceOption1Pros").replace("{amount}", amountLow)}
   - **${locale === "en" ? "Cons" : "Hạn chế"}:** ${t("aiAdviceOption1Cons").replace("{days}", String(daysLow))}
   
2. **${t("aiAdviceOption2Title").replace("{supplier}", fastDeliveryQuote.supplierName)}**
   - **${locale === "en" ? "Pros" : "Ưu điểm"}:** ${t("aiAdviceOption2Pros").replace("{days}", String(daysFast))}
   - **${locale === "en" ? "Cons" : "Hạn chế"}:** ${t("aiAdviceOption2Cons")}

**${locale === "en" ? "Recommendation" : "Khuyến nghị"}:** ${t("aiAdviceRecommendation").replace("{supplier}", lowPriceQuote.supplierName)}`;
        
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
      alert(t("errSelectAtLeastOneSupplier"));
      return;
    }
    setSendingRfq(true);
    setRfqMessageType("info");
    setRfqCreatedMessage(t("sendingRfqEmailProgress"));

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
    
    const simulatedMailBody = locale === "en"
      ? `Dear Stally F&B Procurement team,
We are submitting our quotation in response to RFQ #${currentRfq.id}.
Quoted items:
${selectedPr ? selectedPr.items.map(it => `- ${it.name}: Price ${randUnitPrice}đ/${it.unit}.`).join("\n") : ""}
Shipping 80k. Delivery today.
Attachment: quote_${supplierId}.pdf`
      : `Xin chào Ban Mua Sắm Stally F&B,
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
      <div className="enterprise-section p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent-dark font-extrabold">{t("rfqTitle")}</p>
          <h2 className="text-2xl font-extrabold font-display text-[#1A1A1A] tracking-tight">{t("rfqCompareTitle")}</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {t("rfqCompareDesc")}
          </p>
        </div>
        <span className="text-[10px] px-3 py-1.5 rounded-xl border border-coral/25 bg-coral-light/10 text-coral-dark font-bold uppercase tracking-wider">
          {t("aiConfidenceWarning")}
        </span>
      </div>
      <div className="sr-only">
        <h2 className="text-3xl font-normal font-display text-[#1A1A1A] tracking-tight">{t("rfqCompareTitle")}</h2>
        <p className="text-xs text-slate-500 mt-1">{t("rfqCompareDesc")}</p>
      </div>

      {!selectedPr ? (
        <div className="text-center py-16 lux-card space-y-5 max-w-4xl mx-auto px-6">
          <div className="space-y-2">
            <p className="text-slate-800 text-base font-extrabold">{t("prSelectTitle")}</p>
            <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
              {t("prDemoFlowText")}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPurchaseRequests}
            className="inline-flex items-center justify-center gap-2 bg-[#111827] hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition"
          >
            {t("prOpenListBtn")}
          </button>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.18em]">
            {t("auditTrailLabel")}
          </p>
          <Building2 className="hidden w-12 h-12 text-[#1A1A1A]/30 mx-auto" />
          <p className="sr-only">Chưa chọn yêu cầu mua sắm để so sánh đấu thầu.</p>
          <p className="sr-only">
            Hãy truy cập danh sách <strong className="text-accent-dark">Yêu cầu mua sắm (PR)</strong>, chọn một phiếu yêu cầu bất kỳ và bấm nút <strong className="font-semibold text-primary-dark">"Tiếp quản &amp; Khảo giá NCC (RFQ)"</strong>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SOURCING PANEL - MATCH & SEND RFQ */}
          <div className="lg:col-span-4 space-y-5">
            <div className="lux-card p-5 space-y-4">
              <div className="border-b border-slate-150 pb-3">
                <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold text-accent-dark uppercase tracking-wider">{t("step1SourcingTitle")}</span>
                <h3 className="text-xs font-bold text-slate-700 mt-2 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-accent-dark" /> {t("aiMatchingTitle")}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">{t("sourcingDescription")}</p>
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
                  <span>{t("aiMatchingProgress")}</span>
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
                  {sendingRfq ? t("sendingRfqProgress") : t("sendingRfqText")}
                </button>
              )}
            </div>

            {/* SIMULATED WEBHOOK CONTROLLER - internal debugging only */}
            {showDevTools && currentRfq && (
              <div className="lux-card p-5 space-y-4">
                <div className="border-b border-slate-150 pb-3">
                  <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-amber-700 font-mono font-bold uppercase tracking-wider">{t("sandboxTitle")}</span>
                  <h3 className="text-xs font-bold text-slate-705 mt-2">{t("mockInboundEmailTitle")}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">{t("mockWebhookDesc")}</p>
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
                  <span className="text-[9px] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-accent-dark font-mono font-bold uppercase tracking-wider">{t("step2MatrixTitle")}</span>
                  <h3 className="text-sm font-bold text-slate-800 mt-2"> {t("comparisonSheetTitle")}</h3>
                  {riskyQuoteCount > 0 && (
                    <p className="text-[11px] text-coral-dark font-bold mt-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t("riskyQuotesAlert").replace("{count}", String(riskyQuoteCount))}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold font-mono">{t("rfqCodeLabel").replace("{code}", currentRfq ? currentRfq.id.toUpperCase() : t("rfqCodeNotCreated"))}</p>
                </div>
              </div>

              {currentQuotes.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-400 text-xs mt-3 font-semibold">{t("awaitingQuotesText")}</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                    {t("awaitingQuotesDesc")}
                  </p>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-slide-up">
                  {/* Segmented Control Filters */}
                  <div className="bg-[#F7F5F0] p-1.5 rounded-2xl border border-slate-205">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
                      {[
                        { id: "best_value", label: "Đề xuất tốt nhất", icon: Sparkles },
                        { id: "cheapest", label: "Giá rẻ nhất", icon: Coins },
                        { id: "fastest", label: "Giao nhanh nhất", icon: Clock },
                        { id: "reliable", label: "Tin cậy nhất", icon: Star },
                        { id: "least_risk", label: "Ít rủi ro nhất", icon: ShieldAlert },
                        { id: "custom", label: "Tùy chỉnh", icon: SlidersHorizontal }
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = rankingMode === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setRankingMode(item.id as RankingMode)}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#1A1A1A] text-white shadow-sm"
                                : "text-slate-650 hover:bg-slate-200/50 hover:text-slate-900"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic weights slider panel for custom mode */}
                  {rankingMode === "custom" && (
                    <div className="p-5 rounded-2xl bg-[#F7F5F0]/25 border border-slate-200 shadow-sm space-y-4 animate-fade-slide-up">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="w-4 h-4 text-accent-dark" />
                          <h4 className="text-xs font-bold text-slate-700">Trọng số xếp hạng tùy chọn</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomWeights({
                            price: 0.40,
                            delivery: 0.25,
                            reliability: 0.20,
                            payment: 0.10,
                            risk: 0.30
                          })}
                          className="text-[10px] text-slate-500 hover:text-[#1A1A1A] transition-all font-mono font-bold uppercase tracking-wider"
                        >
                          Đặt lại mặc định
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        {[
                          { id: "price", label: "Giá rẻ", value: customWeights.price, min: 0, max: 1, step: 0.05, color: "accent-emerald-600" },
                          { id: "delivery", label: "Giao nhanh", value: customWeights.delivery, min: 0, max: 1, step: 0.05, color: "accent-sky-600" },
                          { id: "reliability", label: "Độ tin cậy", value: customWeights.reliability, min: 0, max: 1, step: 0.05, color: "accent-amber-600" },
                          { id: "payment", label: "Hạn nợ", value: customWeights.payment, min: 0, max: 1, step: 0.05, color: "accent-indigo-600" },
                          { id: "risk", label: "Trừ điểm rủi ro", value: customWeights.risk, min: 0, max: 1, step: 0.05, color: "accent-rose-600" }
                        ].map((slider) => (
                          <div key={slider.id} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-500">
                              <span>{slider.label}</span>
                              <span className="font-mono text-primary-dark">{Math.round(slider.value * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={slider.min}
                              max={slider.max}
                              step={slider.step}
                              value={slider.value}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setCustomWeights(prev => ({
                                  ...prev,
                                  [slider.id]: val
                                }));
                              }}
                              className={`w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer ${slider.color}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real Comparison Table Grid */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider bg-[#F7F5F0]">
                          <th className="p-4 font-bold text-slate-600">{t("criteriaHeader")}</th>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0 || q.items.length === 0;
                            return (
                              <th key={q.id} className={`p-4 font-bold text-primary-dark min-w-44 border-l border-slate-200 ${isMissing ? "bg-rose-50/10" : ""}`}>
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-slate-700">{q.supplierName}</p>
                                  <p className="text-[9.5px] text-slate-400 font-mono font-medium">{q.originalFileUrl}</p>
                                  
                                  {/* Badges for Ranking Explanations */}
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {getQuoteBadges(q).map((badge, bIdx) => (
                                      <span key={bIdx} className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-wider ${badge.colorClass}`}>
                                        {badge.text}
                                      </span>
                                    ))}
                                  </div>

                                  {q.negotiationStatus === "supplier_responded" && (
                                    <span className="inline-flex mt-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                                      {t("negotiationAgreedBadge").replace("{version}", String(q.versionCount || 2))}
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
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
                                    <span className="text-[10px] text-slate-400">{t("itemsRequestLabel").replace("{qty}", String(prItem.quantity)).replace("{unit}", prItem.unit)}</span>
                                  </div>
                                </div>
                              </td>
                              {sortedQuotes.map((q) => {
                                const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0 || q.items.length === 0;
                                if (isMissing) {
                                  return (
                                    <td key={q.id} className="p-4 border-l border-slate-200 text-slate-400 font-sans italic bg-rose-50/5">
                                      {t("missingItemInfo")}
                                    </td>
                                  );
                                }
                                // Find matched quote item prices
                                const qItem = q.items.find(qi => qi.name.trim().toLowerCase() === prItem.name.trim().toLowerCase());
                                return (
                                  <td key={q.id} className="p-4 border-l border-slate-200 text-slate-600 font-mono font-bold">
                                    {qItem ? (
                                      <div>
                                        <p className="text-slate-700 font-bold">{qItem.unitPrice.toLocaleString()} đ</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{locale === "en" ? "Total" : "T.Tiền"}: {qItem.totalPrice.toLocaleString()} đ</p>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-sans italic font-normal">{t("noQuoteSubmitted")}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Compare delivery days */}
                        <tr className="bg-slate-50/50">
                          <td className="p-4 font-extrabold text-slate-600">{t("expectedDeliveryLabel")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            return (
                              <td key={q.id} className={`p-4 border-l border-slate-200 font-mono text-slate-700 font-bold ${isMissing ? "bg-rose-50/5 text-slate-400 font-normal italic" : ""}`}>
                                {isMissing ? t("notAvailableYet") : t("deliveryDaysLabel").replace("{days}", String(q.deliveryDays))}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Payment terms */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">{t("paymentTermsLabel")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            return (
                              <td key={q.id} className={`p-4 border-l border-slate-200 text-slate-600 ${isMissing ? "bg-rose-50/5 text-slate-400 italic" : ""}`}>
                                {isMissing ? t("notAvailableYet") : q.paymentTerms}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Tax amount */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">{t("vatLabel")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            return (
                              <td key={q.id} className={`p-4 border-l border-slate-200 font-mono text-slate-500 font-medium ${isMissing ? "bg-rose-50/5 text-slate-450 italic" : ""}`}>
                                {isMissing ? t("notAvailableYet") : `${q.taxAmount.toLocaleString()} đ`}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Shipping */}
                        <tr>
                          <td className="p-4 font-extrabold text-slate-600">{t("shippingFeeLabel")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            return (
                              <td key={q.id} className={`p-4 border-l border-slate-200 font-mono text-slate-500 font-medium ${isMissing ? "bg-rose-50/5 text-slate-450 italic" : ""}`}>
                                {isMissing ? t("notAvailableYet") : `${q.shippingFee.toLocaleString()} đ`}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Total pricing SUMMARY */}
                        <tr className="bg-amber-50/40 font-bold border-t border-slate-200">
                          <td className="p-4 text-primary-dark text-xs uppercase tracking-wider font-extrabold">{t("totalInvoiceSummary")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            return (
                              <td key={q.id} className={`p-4 border-l border-slate-200 font-mono text-primary-dark text-sm font-bold ${isMissing ? "bg-rose-50/5 text-rose-650 italic font-normal" : ""}`}>
                                {isMissing ? t("extractionError") : `${q.totalAmount.toLocaleString()} đ`}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Compare AI Confidence Score */}
                        <tr className="text-[10px] text-slate-400">
                          <td className="p-4 font-medium uppercase tracking-wider font-mono">{t("aiConfidenceAndRisk")}</td>
                          {sortedQuotes.map((q) => {
                            const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                            if (isMissing) {
                              return (
                                <td key={q.id} className="p-4 border-l border-slate-200 text-[10px] font-bold bg-rose-50/5">
                                  <div className="text-rose-650 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>{t("extractionFailedMissingData")}</span>
                                  </div>
                                  <p className="mt-1 text-[9px] text-slate-455 font-sans font-normal leading-normal">
                                    {t("extractionFailedMissingDataDesc")}
                                  </p>
                                </td>
                              );
                            }
                            const flags = getQuoteRiskFlags(q);
                            return (
                              <td key={q.id} className="p-4 border-l border-slate-200 text-[10px] font-bold">
                                <div className="font-mono text-primary-dark">{q.aiConfidenceScore}% Confidence</div>
                                {flags.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-coral-dark font-sans">
                                    {flags.map(flag => (
                                      <li key={flag} className="flex items-start gap-1">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>{flag}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="mt-1 inline-flex text-emerald-700 font-sans">{t("auditPassedText")}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Approvals actions */}
                        {currentRfq.status !== "approved" && (
                          <tr className="bg-slate-50/20">
                            <td className="p-4"></td>
                            {sortedQuotes.map((q) => {
                              const isMissing = q.totalAmount === null || q.totalAmount === undefined || q.totalAmount <= 0;
                              return (
                                <td key={q.id} className="p-4 border-l border-slate-200">
                                  {currentRole === "manager" ? (
                                    <button
                                      id="btn-approve-po"
                                      onClick={() => {
                                        const flags = getQuoteRiskFlags(q);
                                        if (flags.length > 0) {
                                          setPendingApprovalQuote(q);
                                          setShowApprovalConfirmModal(true);
                                        } else {
                                          onApproveQuote(currentRfq.id, q.id);
                                        }
                                      }}
                                      disabled={isMissing}
                                      className="w-full bg-[#1A1A1A] hover:bg-[#000000] text-white font-bold text-xs p-2.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm disabled:bg-slate-250 disabled:text-slate-450 disabled:cursor-not-allowed"
                                    >
                                      <UserCheck className="w-4 h-4" /> {t("approveAndSignPoBtn")}
                                    </button>
                                  ) : (
                                    <div className="text-slate-400 text-[10px] italic text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold">
                                      {t("requiresManagerApproval")}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
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
                        <h4 className="text-xs font-bold text-slate-800">{t("poCompletedTitle")}</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {t("poCompletedDesc")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI RECOMMENDATION BOX */}
                  {generatingAdvice ? (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
                      <RefreshCw className="w-4 h-4 text-accent-dark animate-spin mx-auto" />
                      <p className="font-semibold">{t("aiAnalyzingQuote")}</p>
                    </div>
                  ) : (
                    aiAdvice && (
                      <div className="bg-amber-50/15 p-5 rounded-2xl border border-accent-gold/10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200/50 text-primary-dark text-[9px] font-mono font-bold">
                          <Cpu className="w-3 h-3 text-accent-dark" /> {t("stallyAiProcurementHeader")}
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

      {/* Confirmation Modal for Approving Risky Quotes */}
      {showApprovalConfirmModal && pendingApprovalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-zoom-in">
            <div className="bg-coral-light/10 border-b border-coral/20 p-5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-650 shadow-xs">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Cảnh báo rủi ro báo giá</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Báo giá của {pendingApprovalQuote.supplierName} có một số điểm cần lưu ý.</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-650 leading-relaxed font-medium">
                Hệ thống phát hiện các cảnh báo rủi ro sau đây trên báo giá này. Bạn có chắc chắn vẫn muốn tiếp tục phê duyệt và ký PO không?
              </p>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4">
                <ul className="space-y-2">
                  {getQuoteRiskFlags(pendingApprovalQuote).map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-rose-800 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[10.5px] text-slate-400 italic">
                * Việc phê duyệt sẽ lập tức khởi tạo Đơn Đặt Hàng (PO) gửi trực tiếp tới nhà cung cấp. Hành động này sẽ được ghi nhận vào nhật ký kiểm toán (Audit Trail) của hệ thống.
              </p>
            </div>

            <div className="bg-[#F7F5F0] px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalConfirmModal(false);
                  setPendingApprovalQuote(null);
                }}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-650 rounded-xl transition-all cursor-pointer"
              >
                Hủy yêu cầu
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentRfq && pendingApprovalQuote) {
                    onApproveQuote(currentRfq.id, pendingApprovalQuote.id);
                  }
                  setShowApprovalConfirmModal(false);
                  setPendingApprovalQuote(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Xác nhận phê duyệt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

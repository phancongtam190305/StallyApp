import React, { useState, useEffect, useRef } from "react";
import { apiUrl } from "../config";
import { 
  ChevronLeft, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Plus, 
  FileText, 
  Clock, 
  Search, 
  User, 
  Building2, 
  History, 
  Coins, 
  Award, 
  ArrowRight,
  RefreshCw,
  Edit,
  Mail,
  Scale,
  ThumbsUp,
  ThumbsDown,
  Info,
  Check,
  Boxes,
  Lock
} from "lucide-react";
import { UserRole, ProcurementCase, PurchaseRequestItem, Supplier, Quote, CaseTransition, PurchaseOrder } from "../types";
import ItemIcon from "./ItemIcon";
import { useToast } from "../context/ToastContext";

interface CaseDetailTimelineProps {
  caseId: string;
  onBackToList: () => void;
  currentRole: UserRole;
  orgId: string;
  onStateChanged?: () => void;
  refreshTrigger?: number;
}

interface SupplierMatch {
  supplierId: string;
  name: string;
  email: string;
  score: number;
  reasons: string[];
  riskFlags: string[];
}

interface NegotiationSupplierOption {
  supplierId: string;
  name: string;
  email: string;
  status?: string;
  hasQuote?: boolean;
  quoteId?: string;
}

interface RfqDraft {
  id: string;
  caseId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  subject: string;
  bodyHtml: string;
  dueDate: string;
  status: string;
}

interface RfqDraftEditForm {
  subject: string;
  greeting: string;
  notes: string;
  dueDate: string;
  signature: string;
}

interface SupplierDiscoveryCandidate {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tags: string[];
  sourceUrls: string[];
  evidence: string;
  confidence: number;
  riskFlags: string[];
  autoAddEligible: boolean;
  duplicateOfSupplierId?: string;
}

const RFQ_TEST_RECIPIENT = "phancongtam0907930205@gmail.com";

const emptyRfqDraftEditForm: RfqDraftEditForm = {
  subject: "",
  greeting: "",
  notes: "",
  dueDate: "",
  signature: ""
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script,style").forEach(node => node.remove());
  return (container.innerText || container.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDraftNotes(plainText: string, supplierName: string): string {
  const supplier = supplierName.toLowerCase();
  const ignoredFragments = [
    "kính chào",
    "kính gửi",
    "trân trọng",
    "phan công tâm",
    "procurement",
    "sourcing staff",
    "stally food"
  ];

  const lines = plainText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      const lower = line.toLowerCase();
      if ((lower.includes("kính chào") || lower.includes("kính gửi")) && lower.includes(supplier)) return false;
      return !ignoredFragments.some(fragment => lower === fragment || lower.startsWith(`${fragment},`));
    });

  return lines.join("\n\n").trim();
}

function normalizeDateInput(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDueDateForEmail(value: string): string {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "theo thời hạn đã thống nhất";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function textToHtmlParagraphs(value: string): string {
  return value
    .trim()
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function createDraftEditForm(draft: RfqDraft): RfqDraftEditForm {
  const plainText = htmlToPlainText(draft.bodyHtml);
  const notes = normalizeDraftNotes(plainText, draft.supplierName);

  return {
    subject: draft.subject,
    greeting: `Kính gửi ${draft.supplierName},`,
    notes: notes || "Vui lòng gửi báo giá chi tiết, điều kiện giao hàng, thời gian giao và hiệu lực báo giá khi phản hồi email này.",
    dueDate: normalizeDateInput(draft.dueDate),
    signature: "Trân trọng,\nPhan Công Tâm\nProcurement & Sourcing Staff\nStally Food & Beverage Group"
  };
}

function buildFriendlyRfqHtml(form: RfqDraftEditForm): string {
  const notesHtml = textToHtmlParagraphs(form.notes);
  const signatureHtml = form.signature
    .split(/\n/)
    .map(line => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br>");

  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #24323f; background-color: #ffffff;">
  <p>${escapeHtml(form.greeting)}</p>
  ${notesHtml || "<p>Vui lòng gửi báo giá chi tiết khi phản hồi email này.</p>"}
  <p>Hạn chót tiếp nhận báo giá: <strong>${escapeHtml(formatDueDateForEmail(form.dueDate))}</strong>.</p>
  <p>Vui lòng đính kèm báo giá định dạng PDF/Excel nếu có.</p>
  <p>${signatureHtml}</p>
</div>`.trim();
}

function getNegotiationSupplierOptions(comparison: any): NegotiationSupplierOption[] {
  const byId = new Map<string, NegotiationSupplierOption>();

  for (const supplier of comparison?.negotiationSuppliers || []) {
    if (!supplier.supplierId) continue;
    byId.set(supplier.supplierId, {
      supplierId: supplier.supplierId,
      name: supplier.name || "Nhà cung cấp chưa đặt tên",
      email: supplier.email || "",
      status: supplier.status,
      hasQuote: Boolean(supplier.hasQuote),
      quoteId: supplier.quoteId
    });
  }

  for (const supplier of comparison?.suppliers || []) {
    if (!supplier.supplierId || byId.has(supplier.supplierId)) continue;
    byId.set(supplier.supplierId, {
      supplierId: supplier.supplierId,
      name: supplier.name || "Nhà cung cấp chưa đặt tên",
      email: supplier.email || "",
      status: supplier.status,
      hasQuote: Boolean(supplier.quoteId),
      quoteId: supplier.quoteId
    });
  }

  for (const quote of comparison?.matrix || []) {
    if (!quote.supplierId || byId.has(quote.supplierId)) continue;
    byId.set(quote.supplierId, {
      supplierId: quote.supplierId,
      name: quote.supplierName || "Nhà cung cấp chưa đặt tên",
      email: "",
      status: "replied",
      hasQuote: true,
      quoteId: quote.id
    });
  }

  return Array.from(byId.values());
}

export default function CaseDetailTimeline({ 
  caseId, 
  onBackToList, 
  currentRole, 
  orgId, 
  onStateChanged,
  refreshTrigger
}: CaseDetailTimelineProps) {
  const showDevTools = import.meta.env.VITE_ENABLE_DEV_TOOLS === "true";
  
  const [loading, setLoading] = useState(true);
  const [caseObj, setCaseObj] = useState<ProcurementCase | null>(null);
  const [timeline, setTimeline] = useState<CaseTransition[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [matchedSuppliers, setMatchedSuppliers] = useState<SupplierMatch[]>([]);
  const [rfqDrafts, setRfqDrafts] = useState<RfqDraft[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<number>(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const fetchInFlightRef = useRef(false);
  const { showToast } = useToast();
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);

  // Intake States
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemNotes, setNewItemNotes] = useState("");

  // Sourcing States
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [discoveryCandidates, setDiscoveryCandidates] = useState<SupplierDiscoveryCandidate[]>([]);
  const [selectedDiscoveryCandidateIds, setSelectedDiscoveryCandidateIds] = useState<string[]>([]);
  const [discoveryElapsedSec, setDiscoveryElapsedSec] = useState(0);
  const [customRfqDueDate, setCustomRfqDueDate] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftEditForm, setDraftEditForm] = useState<RfqDraftEditForm>(emptyRfqDraftEditForm);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  
  // Inbound simulation states
  const [simSupplierId, setSimSupplierId] = useState("");
  const [simEmailBody, setSimEmailBody] = useState("");
  const [simFile, setSimFile] = useState("bao_gia_vat_tu.pdf");

  // Negotiation States
  const [selectedNegSupplier, setSelectedNegSupplier] = useState<string>("");
  const [negGoal, setNegGoal] = useState<string>("discount_5");
  const [negDraft, setNegDraft] = useState<any>(null);
  const [negLoading, setNegLoading] = useState(false);
  const [negEditedBody, setNegEditedBody] = useState("");

  // Approval States
  const [approvalComment, setApprovalComment] = useState("");

  // Fulfillment / PO / Receiving States
  const [poDraft, setPoDraft] = useState<PurchaseOrder | null>(null);
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, number>>({});
  const [qualityStatuses, setQualityStatuses] = useState<Record<number, string>>({});
  const [receivingNotes, setReceivingNotes] = useState<Record<number, string>>({});

  const discoverySteps = [
    "Gửi truy vấn lên AI sourcing agent",
    "Tìm nguồn công khai bằng Google Search Grounding",
    "Đọc website, địa chỉ và thông tin liên hệ",
    "Chuẩn hóa email, số điện thoại, website",
    "Chấm confidence, kiểm tra trùng CRM",
    "Đồng bộ kết quả vào danh sách NCC"
  ];
  const discoveryStepIndex = Math.min(
    discoverySteps.length - 1,
    Math.floor(discoveryElapsedSec / 7)
  );
  const isCurrentlyScanning = loadingAction === "discover_suppliers" || Boolean(caseObj?.isScanning);
  const discoveryProgress = isCurrentlyScanning
    ? Math.min(94, 12 + discoveryElapsedSec * 3)
    : 0;
  const procurementScopeLabel = caseObj?.items?.map(item => item.name).filter(Boolean).join(", ") || "mặt hàng trong case";
  const hasRfqDrafts = rfqDrafts.length > 0;
  const isDraftingRfq = loadingAction === "draft_rfq";
  const canEditSourcing = caseObj?.status === "supplier_matching" && !hasRfqDrafts && !isDraftingRfq;
  const isRfqDraftSyncing = caseObj?.status === "rfq_draft" && !hasRfqDrafts && !isDraftingRfq;

  useEffect(() => {
    if (!isCurrentlyScanning) {
      setDiscoveryElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setDiscoveryElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCurrentlyScanning]);



  const fetchData = async (isBackground: boolean | React.MouseEvent = false) => {
    const background = isBackground === true;
    if (fetchInFlightRef.current) {
      return;
    }
    fetchInFlightRef.current = true;

    try {
      if (!background) {
        setLoading(true);
      }
      // Fetch Case Details
      const caseRes = await fetch(apiUrl(`/api/v1/cases/${caseId}`), {
        headers: { "X-Organization-Id": orgId }
      });
      const caseData = await caseRes.json();
      if (caseData.error) throw new Error(caseData.error.message);
      setCaseObj(prev => JSON.stringify(prev) !== JSON.stringify(caseData.data) ? caseData.data : prev);

      const timelineRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/timeline`), {
        headers: { "X-Organization-Id": orgId }
      });
      const timelineData = await timelineRes.json();
      setTimeline(prev => JSON.stringify(prev) !== JSON.stringify(timelineData.data || []) ? (timelineData.data || []) : prev);

      const supRes = await fetch(apiUrl(`/api/suppliers`), {
        headers: { "X-Organization-Id": orgId }
      });
      const supData = await supRes.json();
      setSuppliers(prev => JSON.stringify(prev) !== JSON.stringify(supData || []) ? (supData || []) : prev);

      const compRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/comparison`), {
        headers: { "X-Organization-Id": orgId }
      });
      const compData = await compRes.json();
      setComparison(prev => JSON.stringify(prev) !== JSON.stringify(compData) ? compData : prev);

      const poRes = await fetch(apiUrl(`/api/v1/purchase-orders`), {
        headers: { "X-Organization-Id": orgId }
      });
      const poData = await poRes.json().catch(() => ({ data: [] }));
      const casePOs = (poData.data || []).filter((p: PurchaseOrder) => p.caseId === caseId);
      setPoList(prev => JSON.stringify(prev) !== JSON.stringify(casePOs) ? casePOs : prev);

      // Pre-populate received quantities
      if (casePOs.length > 0) {
        const po = casePOs[0];
        setReceivedQtys(prev => {
          const updated = { ...prev };
          po.items.forEach((it: any, idx) => {
            if (updated[idx] === undefined) {
              updated[idx] = it.quantityReceived !== undefined ? it.quantityReceived : it.quantity;
            }
          });
          return updated;
        });
      }
      
      // Determine Milestone
      const status = caseData.data.status;
      if (!background) {
        if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
          setActiveMilestone(1);
        } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
          setActiveMilestone(2);
        } else if (["quote_review", "comparison_ready", "negotiating"].includes(status)) {
          setActiveMilestone(3);
        } else if (["pending_approval"].includes(status)) {
          setActiveMilestone(4);
        } else {
          setActiveMilestone(5);
        }
      }

      // Always fetch matched suppliers if status is step 2
      if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
        const matchesRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/supplier-matches`), {
          headers: { "X-Organization-Id": orgId }
        });
        const matchesData = await matchesRes.json();
        setMatchedSuppliers(prev => JSON.stringify(prev) !== JSON.stringify(matchesData.data || []) ? (matchesData.data || []) : prev);

        // Fetch discovery candidates
        const candRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/suppliers/discovery-candidates`), {
          headers: { "X-Organization-Id": orgId }
        });
        const candData = await candRes.json();
        if (!candData.error) {
          setDiscoveryCandidates(prev => JSON.stringify(prev) !== JSON.stringify(candData.data || []) ? (candData.data || []) : prev);
        }

        // Fetch RFQ drafts
        const draftsRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/rfq-drafts`), {
          headers: { "X-Organization-Id": orgId }
        });
        const draftsData = await draftsRes.json();
        if (!draftsData.error) {
          setRfqDrafts(prev => JSON.stringify(prev) !== JSON.stringify(draftsData.data || []) ? (draftsData.data || []) : prev);
        }
      }

      if (!background) {
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      if (!background) {
        showToast(err.message || "Không thể đồng bộ dữ liệu hồ sơ thầu.", "error");
        setLoading(false);
      }
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    // Initial fetch is foreground
    fetchData(false);
    
    // Auto-refresh is background
    const intervalId = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [caseId, refreshTrigger]);

  useEffect(() => {
    if (!caseObj) return;
    const status = caseObj.status;
    if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
      setActiveMilestone(1);
    } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
      setActiveMilestone(2);
    } else if (["quote_review", "comparison_ready", "negotiating"].includes(status)) {
      setActiveMilestone(3);
    } else if (["pending_approval"].includes(status)) {
      setActiveMilestone(4);
    } else {
      setActiveMilestone(5);
    }
  }, [caseObj?.status]);

  if (loading || !caseObj) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-primary-dark font-black">Đang tải hồ sơ thầu...</span>
      </div>
    );
  }

  const negotiationSupplierOptions = getNegotiationSupplierOptions(comparison);

  const milestones = [
    { num: 1, label: "Đón nhận", desc: "Chuẩn hóa" },
    { num: 2, label: "Mời thầu", desc: "Phát RFQ" },
    { num: 3, label: "Thương thảo", desc: "So sánh thầu" },
    { num: 4, label: "CEO Duyệt", desc: "Ký duyệt PO" },
    { num: 5, label: "Nhập kho", desc: "Đối soát thực" }
  ];

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case "urgent": return "bg-coral-light/10 border-coral text-coral-dark";
      case "high": return "bg-accent-light/10 border-accent-gold text-accent-dark";
      case "medium": return "bg-primary-bg border-primary text-primary-dark";
      default: return "bg-slate-50 border-slate-200 text-slate-650";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return "🚨 Khẩn cấp";
      case "high": return "⚠️ Cao";
      case "medium": return "Vừa";
      default: return "Thấp";
    }
  };

  const getStatusBadgeColor = (s: string) => {
    if (s === "closed") return "bg-emerald-50 text-success border-success";
    if (s === "cancelled") return "bg-cream text-primary-dark/60 border-primary-dark/30";
    if (s === "exception") return "bg-coral-light/10 text-coral border-coral animate-pulse";
    if (s.startsWith("po_")) return "bg-primary-bg text-primary-dark border-primary";
    if (s === "pending_approval") return "bg-accent-light/10 text-accent-dark border-accent-gold animate-pulse";
    return "bg-primary-bg text-primary-dark border-primary-light";
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft_request: "PR Nháp",
      request_submitted: "Đã nộp PR",
      request_validating: "Đang xác minh",
      supplier_matching: "Khớp đối tác",
      rfq_draft: "Soạn RFQ nháp",
      rfq_sent: "Đã gửi RFQ",
      collecting_quotes: "Chờ báo giá",
      quote_review: "Duyệt báo giá",
      comparison_ready: "Sẵn sàng duyệt",
      negotiating: "Đàm phán AI",
      pending_approval: "Đợi CEO duyệt",
      approved: "Đã duyệt PO",
      po_draft: "Đang lập PO",
      po_sent: "Đã gửi PO",
      receiving: "Đang nhận hàng",
      closed: "Đã đóng",
      cancelled: "Đã hủy",
      exception: "Thất thoát kho"
    };
    return map[s] || s;
  };

  const handleIntakeSubmit = async () => {
    setLoadingAction("submit_intake");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/submit`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ reason: "Ban Mua Sắm chuẩn hóa xong danh mục nguyên liệu." })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      // Immediately update caseObj from response to avoid race condition
      if (data.data) {
        setCaseObj(data.data);
      }
      
      showToast("Đã chuẩn hóa yêu cầu và chuyển sang khâu mời thầu!", "success");
      if (onStateChanged) onStateChanged();
      // Fetch remaining data (timeline, suppliers etc.) after a short delay
      setTimeout(() => fetchData(true), 800);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelCase = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy bỏ quy trình mua sắm này?")) return;
    setLoadingAction("cancel_case");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/cancel`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ reason: "Hủy bỏ quy trình thầu sắm theo nhu cầu thực tế." })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã hủy bỏ quy trình mua sắm.", "info");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName) return;
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/items`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ name: newItemName, quantity: newItemQty, unit: newItemUnit, notes: newItemNotes })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setNewItemName("");
      setNewItemNotes("");
      showToast("Đã thêm sản phẩm vào danh mục thầu!", "success");
      fetchData();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleDeleteItem = async (index: number) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/items/${index}`), {
        method: "DELETE",
        headers: { "X-Organization-Id": orgId }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã xóa sản phẩm khỏi danh mục!", "info");
      fetchData();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleSupplierDiscover = async () => {
    if (!canEditSourcing) {
      showToast("Nguồn thầu đã khóa cho case này. Muốn mời thầu mặt hàng khác, hãy tạo case mới.", "info");
      return;
    }
    if (!aiSearchQuery) return;
    setLoadingAction("discover_suppliers");
    setDiscoveryElapsedSec(0);
    setDiscoveryCandidates([]);
    setSelectedDiscoveryCandidateIds([]);
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/suppliers/discover`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ query: aiSearchQuery })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      if (data.status === "processing") {
        setShowDiscoverModal(false);
        showToast("AI đang tiến hành tìm kiếm nhà cung cấp dưới nền...", "info");
      } else if (data.cached === true) {
        setShowDiscoverModal(false);
        showToast("Đã tải danh sách nhà cung cấp từ bộ nhớ đệm!", "success");
        if (onStateChanged) onStateChanged();
      } else {
        const reviewCount = data.summary?.reviewRequiredCount || 0;
        setDiscoveryCandidates(data.candidates || []);
        showToast(
          data.message || `Crawl xong: ${reviewCount} NCC chờ bạn chọn đưa vào danh sách chính.`,
          "info"
        );
      }
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Cào tìm kiếm nhà cung cấp thất bại.", "error");
    } finally {
      setLoadingAction(null);
      setDiscoveryElapsedSec(0);
    }
  };

  const handlePromoteDiscoveryCandidates = async () => {
    if (!canEditSourcing) {
      showToast("Nguồn thầu đã khóa cho case này. Không thể thêm NCC mới vào vòng RFQ hiện tại.", "info");
      return;
    }
    if (selectedDiscoveryCandidateIds.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 NCC crawl để thêm vào danh sách chính.", "error");
      return;
    }

    setLoadingAction("promote_discovery_candidates");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/suppliers/promote-candidates`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ candidateIds: selectedDiscoveryCandidateIds })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const addedIds = new Set((data.data || []).map((supplier: Supplier) => supplier.id));
      setDiscoveryCandidates(prev => prev.filter(candidate => !selectedDiscoveryCandidateIds.includes(candidate.id || "")));
      setSelectedDiscoveryCandidateIds([]);
      showToast(data.message || `Đã thêm ${addedIds.size} NCC vào danh sách chính.`, data.summary?.addedCount > 0 ? "success" : "info");
      fetchData();
    } catch (e: any) {
      showToast(e.message || "Không thêm được NCC vào danh sách chính.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSelectSuppliers = async () => {
    if (!canEditSourcing) {
      showToast("Nguồn thầu đã khóa cho case này. Vui lòng review hoặc gửi RFQ hiện tại.", "info");
      return;
    }
    if (selectedSuppliers.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 nhà cung cấp.", "error");
      return;
    }
    setLoadingAction("draft_rfq");
    try {
      await fetch(apiUrl(`/api/v1/cases/${caseId}/suppliers/select`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ supplierIds: selectedSuppliers })
      });

      const draftRes = await fetch(apiUrl(`/api/v1/cases/${caseId}/rfq-draft`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ supplierIds: selectedSuppliers, dueDate: customRfqDueDate })
      });
      const draftData = await draftRes.json();
      setRfqDrafts(draftData.data || []);
      showToast("AI đã tự động soạn thư mời thầu nháp chuyên biệt!", "success");
      fetchData();
    } catch (e: any) {
      showToast("Tạo bản thảo RFQ thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const beginEditDraft = (draft: RfqDraft) => {
    setEditingDraftId(draft.id);
    setDraftEditForm(createDraftEditForm(draft));
  };

  const updateDraftEditForm = (field: keyof RfqDraftEditForm, value: string) => {
    setDraftEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async (draftId: string) => {
    const draft = rfqDrafts.find(item => item.id === draftId);
    if (!draft) return;
    const nextDraft: RfqDraft = {
      ...draft,
      subject: draftEditForm.subject.trim(),
      dueDate: draftEditForm.dueDate,
      bodyHtml: buildFriendlyRfqHtml(draftEditForm)
    };

    if (!nextDraft.subject || !draftEditForm.notes.trim()) {
      showToast("Vui lòng nhập tiêu đề và nội dung ghi chú trước khi lưu.", "error");
      return;
    }

    setSavingDraftId(draftId);
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/rfq-drafts/${draftId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          subject: nextDraft.subject,
          bodyHtml: nextDraft.bodyHtml,
          dueDate: nextDraft.dueDate
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setRfqDrafts(prev => prev.map(item => item.id === draftId ? (data.data || nextDraft) : item));
      setEditingDraftId(null);
      setDraftEditForm(emptyRfqDraftEditForm);
      showToast("Đã lưu chỉnh sửa email thầu.", "success");
      return;
    } catch (e: any) {
      showToast(e.message || "Lưu bản nháp RFQ thất bại.", "error");
      return;
    } finally {
      setSavingDraftId(null);
    }
    showToast("Đã lưu chỉnh sửa email thầu!", "success");
  };

  const handleSendRfqs = async () => {
    if (rfqDrafts.length === 0) return;
    if (editingDraftId) {
      showToast("Vui lòng lưu hoặc hủy biên tập thư trước khi gửi.", "info");
      return;
    }
    setLoadingAction("send_rfqs");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/rfq/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ draftIds: rfqDrafts.map(d => d.id) })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast(`Đã gửi thầu thật thành công đến ${data.email.sentCount} nhà cung cấp qua Gmail!`, "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateQuote = async () => {
    if (!simSupplierId) {
      showToast("Vui lòng chọn 1 nhà cung cấp phản hồi.", "error");
      return;
    }
    setLoadingAction("simulate_quote");
    try {
      const rfqId = caseObj.currentRfqId || `rfq-${Date.now()}`;
      const res = await fetch(apiUrl(`/api/webhooks/inbound-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          rfqCaseId: rfqId,
          supplierId: simSupplierId,
          subject: `Re: [STALLY RFQ-${caseId.toUpperCase()}] Báo giá thầu vật tư`,
          bodyText: simEmailBody || "Kính gửi Stally F&B, chúng tôi gửi bảng báo giá theo yêu cầu. Giá chi tiết đính kèm tệp.",
          fileName: simFile
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã gửi email phản hồi giả lập! AI đang trích xuất dữ liệu thầu hóa đơn...", "success");
      setSimEmailBody("");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 1200);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDraftNegotiation = async () => {
    if (!selectedNegSupplier) {
      showToast("Vui lòng chọn 1 NCC để thương lượng.", "error");
      return;
    }
    setNegLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/negotiations/${selectedNegSupplier}/draft`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ goal: negGoal })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || data.error || "Không thể soạn thư đàm phán.");
      }
      setNegDraft(data.data);
      setNegEditedBody(data.data.draftEmail);
      showToast("AI đã soạn thảo thư đàm phán tối ưu!", "success");
    } catch (e: any) {
      showToast(e.message || "Đàm phán thất bại", "error");
    } finally {
      setNegLoading(false);
    }
  };

  const handleSendNegotiation = async () => {
    if (!negDraft) return;
    setLoadingAction("send_neg");
    try {
      const res = await fetch(apiUrl(`/api/v1/negotiation-drafts/${negDraft.id}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ editedBody: negEditedBody })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || data.error || "Gửi đàm phán thất bại.");
      }
      showToast("Đã gửi email đàm phán qua Gmail! Đang chờ đối tác trả lời...", "success");
      setNegDraft(null);
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 1800);
    } catch (e: any) {
      showToast(e.message || "Gửi đàm phán thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestApproval = async (quoteId: string) => {
    setLoadingAction("request_app");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/approval/request`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ selectedQuoteId: quoteId, comment: "Đề xuất lựa chọn nhà cung cấp tối ưu nhất về chi phí." })
      });
      const data = await res.json();
      showToast("Đã trình hồ sơ lên cấp trên duyệt PO!", "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e) {
      showToast("Yêu cầu phê duyệt thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApprove = async () => {
    setLoadingAction("approve_po");
    try {
      const res = await fetch(apiUrl(`/api/v1/approval-requests/${caseId}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ comment: approvalComment })
      });
      const data = await res.json();
      showToast("Đã phê duyệt báo giá! Hệ thống tự sinh Đơn đặt hàng nháp PO.", "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 850);
    } catch (e) {
      showToast("Phê duyệt thất bại", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    setLoadingAction("reject_po");
    try {
      const res = await fetch(apiUrl(`/api/v1/approval-requests/${caseId}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ comment: approvalComment })
      });
      const data = await res.json();
      showToast("Bác bỏ hồ sơ thầu. Hồ sơ thầu trả về bước thương lượng đàm phán.", "info");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e) {
      showToast("Bác bỏ thất bại", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreatePoDraft = async () => {
    setLoadingAction("po_draft");
    try {
      const res = await fetch(apiUrl(`/api/v1/cases/${caseId}/po-draft`), {
        method: "POST",
        headers: { "X-Organization-Id": orgId }
      });
      const data = await res.json();
      setPoDraft(data.data);
      showToast("Đã khởi tạo bản thảo PO đặt hàng chính thức!", "success");
    } catch (e) {
      showToast("Không tạo được bản thảo PO.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendPo = async (poId: string) => {
    setLoadingAction("send_po");
    try {
      const res = await fetch(apiUrl(`/api/v1/purchase-orders/${poId}/send`), {
        method: "POST",
        headers: { "X-Organization-Id": orgId }
      });
      const data = await res.json();
      showToast("Đã gửi đơn đặt hàng PO chính thức đến NCC qua Gmail thành công!", "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e) {
      showToast("Gửi đơn đặt hàng PO thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Goods receipt (I) -> auto updates inventory and closes case
  const handleReceiveAllAndClose = async (poId: string, poItems: any[]) => {
    const itemsPayload = poItems.map((it: any) => {
      return {
        name: it.name,
        quantityReceived: it.quantity // Chốt nhận đầy đủ 100%!
      };
    });

    setLoadingAction("receive_all");
    try {
      const res = await fetch(apiUrl(`/api/v1/purchase-orders/${poId}/receive`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          items: itemsPayload,
          receivedAt: new Date().toISOString(),
          forceClose: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || data.error || "Nhập kho thất bại.");
      }

      const updatedCount = data.inventoryUpdates?.length || itemsPayload.length;
      showToast(`Đã nhập kho và cập nhật tồn cho ${updatedCount} dòng hàng. Hồ sơ mua sắm đã hoàn tất.`, "success");

      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const renderPermissionLock = (allowedRoles: UserRole[], actionName: string) => {
    if (!allowedRoles.includes(currentRole)) {
      const roleLabels: Record<UserRole, string> = {
        requester: "Bếp Trưởng (Requester)",
        procurement: "Nhân viên Thu Mua (Procurement)",
        manager: "Giám Đốc (Manager)",
        warehouse: "Thủ Kho (Warehouse)",
        admin: "Quản trị viên (Admin)"
      };
      const allowedLabels = allowedRoles.map(r => roleLabels[r]).join(" hoặc ");
      return (
        <div className="bg-amber-50 border border-amber-220 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm mb-6 animate-pulse">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Hạn chế quyền hạn (Role-based Restriction)</h4>
            <p className="text-xs text-amber-800 font-semibold leading-relaxed">
              Thao tác <strong className="text-teal-900">"{actionName}"</strong> đang bị khóa đối với vai trò hiện tại của bạn.
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">
              Vai trò của bạn: <span className="text-rose-700 font-black">{roleLabels[currentRole]}</span> | Vai trò được phép: <span className="text-emerald-700 font-black">{allowedLabels}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-slide-up max-w-[1400px] mx-auto">
      
      {/* Header bar and controls */}
      <div className="bg-white border-3 border-primary-dark rounded-3xl p-5 shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToList}
            className="p-2.5 bg-primary-bg hover:bg-primary-light hover:text-white border-2 border-primary-dark text-primary-dark rounded-full transition-all transform active:scale-95 cursor-pointer shrink-0 shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[9px] bg-cream border-2 border-primary-dark px-2 py-0.5 rounded text-primary-dark font-mono font-black shadow-sm">CASE: {caseObj.id.toUpperCase()}</span>
              <span className={`px-2 py-0.5 rounded border-2 text-[9px] font-black uppercase font-mono ${getStatusBadgeColor(caseObj.status)}`}>
                {getStatusLabel(caseObj.status)}
              </span>
              <span className={`px-2 py-0.5 rounded border-2 text-[9px] font-black uppercase font-mono ${getPriorityBadgeColor(caseObj.priority)}`}>
                {getPriorityLabel(caseObj.priority)}
              </span>
            </div>
            <h2 className="text-base font-black text-primary-dark mt-2 font-display uppercase tracking-wider leading-none">
              {caseObj.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="px-4 py-2.5 bg-white hover:bg-cream border-2 border-primary-dark text-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
          
          {caseObj.status !== "closed" && caseObj.status !== "cancelled" && (currentRole === "procurement" || currentRole === "manager") && (
            <button
              onClick={handleCancelCase}
              className="px-4 py-2.5 bg-coral hover:bg-coral-dark border-2 border-primary-dark text-white font-black text-xs rounded-full flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-coral-glow"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hủy thầu
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Multi-stage Wizard Stepper (Playful game-board styling) */}
      <div className="bg-white border-3 border-primary-dark rounded-3xl p-6 shadow-card">
        <div className="flex flex-col md:flex-row justify-between items-center relative gap-6">
          {/* Thick board game dashed line */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-primary-dark/15 border-t-2 border-dashed border-primary-dark/30 hidden md:block z-0" />
          
          {(() => {
            const getStatusMilestoneNum = (status: string): number => {
              if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
                return 1;
              } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
                return 2;
              } else if (["quote_review", "comparison_ready", "negotiating"].includes(status)) {
                return 3;
              } else if (["pending_approval"].includes(status)) {
                return 4;
              } else {
                return 5;
              }
            };
            const maxMilestone = getStatusMilestoneNum(caseObj.status);

            return milestones.map((step) => {
              const isCompleted = step.num < maxMilestone;
              const isActive = step.num === activeMilestone;
              const isLocked = step.num > maxMilestone;
              
              return (
                <button
                  key={step.num}
                  onClick={() => {
                    if (step.num <= maxMilestone) {
                      setActiveMilestone(step.num);
                    } else {
                      showToast(`Bước này đang bị khóa. Hãy hoàn tất bước hiện tại trước.`, "info");
                    }
                  }}
                  className={`relative z-10 flex items-center space-x-3 text-left w-full md:w-auto p-3 rounded-xl transition-all cursor-pointer ${
                    isActive ? "bg-[#e0f2f1]/80 border border-[#b2dfdb] scale-102" : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all ${
                    isCompleted ? "bg-teal-600 border-teal-600 text-white" :
                    step.num === maxMilestone ? "bg-[#00535b] border-[#00535b] text-white animate-pulse" :
                    "bg-white border-slate-200 text-slate-400"
                  }`}>
                    {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.num}
                  </div>
                  <div>
                    <p className={`text-xs font-black leading-none ${isActive ? "text-[#00535b]" : !isLocked ? "text-slate-700" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-none">
                      {step.desc}
                    </p>
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Stepper Sub-views Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Dynamic action workflow panel */}
        <div className="lg:col-span-8 bg-white border-3 border-primary-dark rounded-3xl p-6 shadow-card min-h-[500px]">
          
          {/* Milestone 1 View: Request Intake & Standardization */}
          {activeMilestone === 1 && (
            <div className="space-y-6">
              {renderPermissionLock(["procurement", "requester"], "Chuẩn hóa & Tiếp nhận Yêu cầu")}
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <FileText className="w-5 h-5 text-teal-600" /> Bước 1: Tiếp nhận &amp; Chuẩn hóa Yêu cầu
                </h3>
              </div>

              {/* Informational Panel */}
              <div className="bg-primary-bg/25 border-2 border-primary rounded-2xl p-4 flex items-start gap-3 shadow-inner">
                <Sparkles className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary-dark">Vai trò: Ban Mua Sắm (Sourcing Staff)</p>
                  <p className="text-xs text-primary-dark/85 font-medium leading-relaxed">
                    Bạn cần rà soát lại các dòng sản phẩm thầu bếp trưởng yêu cầu. Thêm ghi chú hoặc loại bỏ các mục lỗi/trùng lặp trước khi phát thầu RFQ chính thức.
                  </p>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border-2 border-primary-dark rounded-2xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-primary-bg text-primary-dark font-black border-b-2 border-primary-dark uppercase tracking-wider text-[9px]">
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">Tên sản phẩm</th>
                      <th className="p-3.5 text-center">Số lượng</th>
                      <th className="p-3.5">Đơn vị</th>
                      <th className="p-3.5">Ghi chú bếp trưởng</th>
                      <th className="p-3.5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-dark/10 text-primary-dark font-bold">
                    {caseObj.items && caseObj.items.length > 0 ? (
                      caseObj.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-primary-bg/5 transition-all">
                          <td className="p-3.5 font-bold font-mono text-primary-dark/50">{idx + 1}</td>
                          <td className="p-3.5 font-black text-primary-dark flex items-center gap-2">
                            <ItemIcon name={item.name} size="sm" className="scale-75 border" />
                            <span>{item.name}</span>
                          </td>
                          <td className="p-3.5 text-center font-black font-mono text-primary-dark bg-primary-bg/10">{item.quantity}</td>
                          <td className="p-3.5 font-black text-primary-dark/60 uppercase">{item.unit}</td>
                          <td className="p-3.5 text-primary-dark/50 italic text-[11px] font-medium">{item.notes || "—"}</td>
                          <td className="p-3.5 text-center">
                            {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) && (
                              <button 
                                onClick={() => handleDeleteItem(idx)}
                                className="p-1.5 text-coral hover:bg-coral-light/10 border-2 border-transparent hover:border-coral rounded-xl transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-primary-dark/60 font-bold italic">Chưa có sản phẩm nào được thiết lập thầu.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add New Item Panel */}
              {["procurement", "requester"].includes(currentRole) && ["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-black text-slate-700">Thêm sản phẩm mới chuẩn hóa:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input 
                      type="text" 
                      placeholder="Tên nguyên liệu... (Ví dụ: Gạo thơm sỉ)"
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      className="p-2 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Số lượng"
                      value={newItemQty}
                      onChange={e => setNewItemQty(Number(e.target.value))}
                      className="p-2 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-mono font-black text-center focus:outline-none"
                    />
                    <select 
                      value={newItemUnit}
                      onChange={e => setNewItemUnit(e.target.value)}
                      className="p-2 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-black text-primary-dark focus:outline-none"
                    >
                      <option value="kg">kg</option>
                      <option value="chai">chai (5L)</option>
                      <option value="bao">bao</option>
                      <option value="hộp">hộp</option>
                      <option value="đv">đơn vị</option>
                    </select>
                    <button
                      onClick={handleAddItem}
                      className="p-2 bg-primary hover:bg-primary-dark text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 border-2 border-primary-dark transition cursor-pointer transform active:scale-95 shadow-sm uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4" /> Thêm thầu
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ghi chú nghiệp vụ..."
                    value={newItemNotes}
                    onChange={e => setNewItemNotes(e.target.value)}
                    className="w-full p-2 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                  />
                </div>
              )}

              {/* Step submit trigger */}
              <div className="pt-4 border-t-2 border-dashed border-primary/20 flex justify-end">
                {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) ? (
                  <button
                    onClick={handleIntakeSubmit}
                    disabled={loadingAction !== null || caseObj.items.length === 0 || !["procurement", "requester"].includes(currentRole)}
                    className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {loadingAction === "submit_intake" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
                    Xác nhận chuẩn hóa &amp; Soạn thầu
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-primary-dark/60 text-xs font-black bg-primary-bg px-4 py-2.5 rounded-full border-2 border-primary shadow-sm uppercase tracking-wider">
                    <Check className="w-4 h-4 text-success stroke-[3]" /> Hoàn tất đón nhận hồ sơ
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Milestone 2 View: Supplier Matching & RFQ Compose */}
          {activeMilestone === 2 && (
            <div className="space-y-6">
              {renderPermissionLock(["procurement"], "Khớp Nhà Cung Cấp & Phát RFQ")}
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Building2 className="w-5 h-5 text-teal-600" /> Bước 2: Khớp Nhà Cung Cấp &amp; Phát RFQ
                </h3>
              </div>

              {/* Sourcing crawler workspace */}
              {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                <div className="bg-cream border-3 border-primary-dark p-5 rounded-3xl space-y-3 relative overflow-hidden shadow-card">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-accent-gold/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center gap-1.5 text-xs font-black text-primary-dark uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-accent-gold animate-pulse" />
                    <span>Tìm NCC theo mặt hàng trong case: {procurementScopeLabel}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Từ khóa này dùng để tìm nguồn cung cho case hiện tại, không đổi mặt hàng yêu cầu.
                  </p>
                  {canEditSourcing ? (
                  <div className="flex gap-2.5">
                    <input 
                      type="text" 
                      placeholder={procurementScopeLabel}
                      value={aiSearchQuery}
                      onChange={e => setAiSearchQuery(e.target.value)}
                      className="flex-1 p-2.5 border-2 border-primary-dark/30 bg-white focus:border-primary-dark rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                    />
                    <button
                      onClick={handleSupplierDiscover}
                      disabled={isCurrentlyScanning || !aiSearchQuery}
                      className="px-5 py-2 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-xl flex items-center gap-1.5 shadow-teal-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCurrentlyScanning ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <Search className="w-4 h-4" />}
                      AI quét thầu
                    </button>
                  </div>
                  ) : (
                    <div className="bg-white border-2 border-primary-dark/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-bg border-2 border-primary flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-primary-dark" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-black text-primary-dark uppercase tracking-wider">Nguồn thầu đã khóa</p>
                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                          Case này đã chuyển sang soạn/gửi RFQ. Muốn mời thầu mặt hàng khác, hãy tạo case mới.
                        </p>
                      </div>
                    </div>
                  )}

                  {isDraftingRfq && (
                    <div className="bg-white border-2 border-accent-gold rounded-2xl p-4 space-y-3 shadow-sm animate-fade-slide-up">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-gold text-primary-dark border-2 border-primary-dark flex items-center justify-center shrink-0">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-primary-dark uppercase tracking-wider">AI đang soạn thư mời thầu</p>
                          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                            Đang viết email riêng cho {selectedSuppliers.length} NCC đã chọn. Bước này có thể mất 1-2 phút.
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold">
                        Vui lòng giữ trang mở cho đến khi bản nháp xuất hiện.
                      </p>
                    </div>
                  )}

                  {canEditSourcing && isCurrentlyScanning && (
                    <div className="bg-white border-2 border-primary-dark/20 rounded-2xl p-4 space-y-3 animate-fade-slide-up">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-primary text-white border-2 border-primary-dark flex items-center justify-center shrink-0">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-primary-dark uppercase tracking-wider">
                              Đang crawl nhà cung cấp
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold truncate">
                              {discoverySteps[discoveryStepIndex]}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-primary-dark">{discoveryElapsedSec}s</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Thời gian chạy</p>
                        </div>
                      </div>

                      <div className="h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary via-accent-gold to-coral transition-all duration-700"
                          style={{ width: `${discoveryProgress}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {discoverySteps.map((step, index) => {
                          const isDone = index < discoveryStepIndex;
                          const isActive = index === discoveryStepIndex;
                          return (
                            <div
                              key={step}
                              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-black ${
                                isActive
                                  ? "bg-accent-light/20 border-accent-gold text-primary-dark"
                                  : isDone
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-slate-50 border-slate-200 text-slate-400"
                              }`}
                            >
                              {isDone ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : isActive ? (
                                <RefreshCw className="w-3 h-3 shrink-0 animate-spin" />
                              ) : (
                                <Clock className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">{step}</span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-[10px] text-slate-500 font-bold leading-snug">
                        Bước này có thể mất 20-60 giây. Sau khi crawl xong, bạn sẽ chọn NCC nào được đưa vào danh sách chính.
                      </p>
                    </div>
                  )}
                  {canEditSourcing && discoveryCandidates.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-500">Kết quả crawl chờ duyệt ({discoveryCandidates.length})</p>
                          <p className="text-[10px] text-slate-500 font-bold">Tick chọn NCC bạn muốn đưa vào danh sách chính trước khi gửi RFQ.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const eligibleIds = discoveryCandidates.filter(c => c.autoAddEligible && c.id).map(c => c.id as string);
                              setSelectedDiscoveryCandidateIds(eligibleIds);
                            }}
                            className="text-[10px] font-black px-2.5 py-1.5 bg-white border border-primary-dark/20 rounded-lg text-primary-dark hover:bg-cream"
                          >
                            Chọn đủ điều kiện
                          </button>
                          <button
                            onClick={() => {
                              setDiscoveryCandidates([]);
                              setSelectedDiscoveryCandidateIds([]);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-700"
                          >
                            Ẩn
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {discoveryCandidates.map((candidate, index) => (
                          <div
                            key={candidate.id || `${candidate.name}-${index}`}
                            className={`bg-white border rounded-lg p-3 space-y-2 transition ${
                              selectedDiscoveryCandidateIds.includes(candidate.id || "")
                                ? "border-primary-dark ring-2 ring-accent-gold/50"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label className="flex items-start gap-2 cursor-pointer min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedDiscoveryCandidateIds.includes(candidate.id || "")}
                                  disabled={!candidate.id || !canEditSourcing || !candidate.autoAddEligible}
                                  onChange={() => {
                                    if (!candidate.id || !candidate.autoAddEligible) return;
                                    setSelectedDiscoveryCandidateIds(prev =>
                                      prev.includes(candidate.id!)
                                        ? prev.filter(id => id !== candidate.id)
                                        : [...prev, candidate.id!]
                                    );
                                  }}
                                  className="mt-0.5 w-3.5 h-3.5 accent-primary shrink-0"
                                />
                                <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 leading-snug">{candidate.name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{candidate.address || "Chưa có địa chỉ"}</p>
                                </div>
                              </label>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                candidate.autoAddEligible ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                {candidate.autoAddEligible ? "Có thể thêm" : "Cần kiểm tra"} · {candidate.confidence}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 space-y-0.5">
                              <p>Email: <span className="font-bold">{candidate.email || "chưa xác minh"}</span></p>
                              <p>SĐT: <span className="font-bold">{candidate.phone || "chưa xác minh"}</span></p>
                              {candidate.website && (
                                <p className="truncate">Web: <span className="font-bold">{candidate.website}</span></p>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug">{candidate.evidence}</p>
                            {candidate.riskFlags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {candidate.riskFlags.slice(0, 2).map((risk) => (
                                  <span key={risk} className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 font-bold">
                                    {risk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3 bg-white border-2 border-primary-dark/20 rounded-2xl p-3">
                        <p className="text-[10px] text-slate-600 font-bold">
                          Đã chọn <span className="font-black text-primary-dark">{selectedDiscoveryCandidateIds.length}</span> NCC để đưa vào danh sách chính.
                        </p>
                        <button
                          onClick={handlePromoteDiscoveryCandidates}
                          disabled={loadingAction !== null || selectedDiscoveryCandidateIds.length === 0 || !canEditSourcing}
                          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark rounded-xl text-[10px] font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {loadingAction === "promote_discovery_candidates" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Thêm vào danh sách chính
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested matched suppliers grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">
                  Đề xuất nhà thầu phù hợp nhất ({matchedSuppliers.length}):
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedSuppliers.map((item) => (
                    <div 
                      key={item.supplierId} 
                      onClick={() => {
                        if (!canEditSourcing) return;
                        setSelectedSuppliers(prev => 
                          prev.includes(item.supplierId) ? prev.filter(id => id !== item.supplierId) : [...prev, item.supplierId]
                        );
                      }}
                      className={`p-4 rounded-3xl border-3 transition-all flex justify-between items-start border-l-8 ${
                        canEditSourcing ? "cursor-pointer" : "cursor-default opacity-90"
                      } ${
                        selectedSuppliers.includes(item.supplierId) 
                          ? "bg-cream border-primary-dark shadow-accent-glow border-l-accent-gold transform scale-[1.01]" 
                          : canEditSourcing ? "bg-white border-primary-dark/20 hover:border-primary-dark border-l-primary-light" : "bg-white border-primary-dark/10 border-l-primary-light"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 pr-3 pl-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-primary-dark truncate max-w-[150px]">{item.name}</span>
                          <span className="text-[9px] bg-primary-bg text-primary-dark px-1.5 py-0.5 rounded border border-primary font-mono font-black">
                            Khớp {item.score}%
                          </span>
                        </div>
                        <p className="text-[10px] text-primary-dark/50 font-black font-mono">{item.email}</p>
                        
                        <div className="space-y-1 pt-1.5">
                          {item.reasons.map((r, i) => (
                            <p key={i} className="text-[10px] text-primary-dark/70 font-bold leading-normal flex items-start gap-1">
                              <span className="text-primary font-bold">✔</span> {r}
                            </p>
                          ))}
                        </div>
                      </div>
                      
                      {canEditSourcing && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedSuppliers.includes(item.supplierId) ? "bg-primary border-primary-dark text-white" : "border-primary-dark/30 bg-white"
                        }`}>
                          {selectedSuppliers.includes(item.supplierId) && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isRfqDraftSyncing && (
                <div className="bg-white border-2 border-accent-gold rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-accent-gold text-primary-dark border-2 border-primary-dark flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-black text-primary-dark uppercase tracking-wider">Đang đồng bộ bản nháp RFQ...</p>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                      AI đang hoàn tất thư mời thầu cho các NCC đã chọn. Bản nháp sẽ tự xuất hiện khi xử lý xong.
                    </p>
                  </div>
                </div>
              )}

              {/* Draft RFQ personalization editor panel */}
              {rfqDrafts.length > 0 && (
                <div className="space-y-4 pt-4 border-t-2 border-dashed border-primary/20">
                  <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent-gold" /> AI Dự thảo thư mời thầu RFQ chi tiết:
                  </h4>
                  <p className="text-[11px] text-slate-600 font-bold">
                    Review thư mời thầu trước khi gửi. Sau khi gửi, hệ thống sẽ chuyển sang chờ báo giá từ email.
                  </p>
                  <div className="bg-amber-50 border-2 border-accent-gold rounded-xl p-3 flex items-start gap-2 text-[11px] text-primary-dark font-bold leading-relaxed">
                    <Info className="w-4 h-4 text-accent-gold shrink-0 mt-0.5" />
                    <span>
                      Chế độ test: email gửi thật sẽ được chuyển tới <strong>{RFQ_TEST_RECIPIENT}</strong>. Email NCC trong card là người nhận nghiệp vụ để theo dõi flow.
                    </span>
                  </div>
                  
                  {rfqDrafts.map((d) => (
                    <div key={d.id} className="border-2 border-primary-dark rounded-2xl overflow-hidden bg-surface-base">
                      <div className="p-3.5 bg-cream flex justify-between items-center text-xs font-black border-b-2 border-primary-dark">
                        <span className="text-primary-dark uppercase tracking-wide">{d.supplierName} ({d.supplierEmail})</span>
                        <button
                          onClick={() => beginEditDraft(d)}
                          className="px-3 py-1 bg-white hover:bg-primary-bg border-2 border-primary-dark text-primary-dark rounded-full font-black text-[10px] uppercase transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" /> Biên tập thư
                        </button>
                      </div>

                      {editingDraftId === d.id ? (
                        <div className="p-4 space-y-3 bg-white">
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-black text-primary-dark uppercase">Tiêu đề email</label>
                            <input 
                              type="text"
                              value={draftEditForm.subject}
                              onChange={e => updateDraftEditForm("subject", e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col space-y-1">
                              <label className="text-[10px] font-black text-primary-dark uppercase">Lời chào</label>
                              <input
                                type="text"
                                value={draftEditForm.greeting}
                                onChange={e => updateDraftEditForm("greeting", e.target.value)}
                                className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark"
                              />
                            </div>
                            <div className="flex flex-col space-y-1">
                              <label className="text-[10px] font-black text-primary-dark uppercase">Hạn báo giá</label>
                              <input
                                type="date"
                                value={draftEditForm.dueDate}
                                onChange={e => updateDraftEditForm("dueDate", e.target.value)}
                                className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-black text-primary-dark uppercase">Nội dung ghi chú thêm</label>
                            <textarea 
                              rows={8}
                              value={draftEditForm.notes}
                              onChange={e => updateDraftEditForm("notes", e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark leading-relaxed resize-y"
                            />
                          </div>
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-black text-primary-dark uppercase">Chữ ký</label>
                            <textarea
                              rows={4}
                              value={draftEditForm.signature}
                              onChange={e => updateDraftEditForm("signature", e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark leading-relaxed resize-y"
                            />
                          </div>
                          <div className="rounded-xl border-2 border-primary-dark/20 overflow-hidden bg-cream">
                            <div className="px-3 py-2 border-b-2 border-primary-dark/20 bg-white flex items-center gap-2">
                              <Mail className="w-4 h-4 text-primary" />
                              <p className="text-[10px] font-black uppercase tracking-wider text-primary-dark">Preview người nhận</p>
                            </div>
                            <div className="p-3 space-y-2">
                              <p className="text-xs font-black text-primary-dark break-words">{draftEditForm.subject}</p>
                              <div
                                className="bg-white border border-primary-dark/15 rounded-lg p-3 max-h-72 overflow-auto text-[12px] text-slate-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: buildFriendlyRfqHtml(draftEditForm) }}
                              />
                            </div>
                          </div>
                          <details className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-slate-600">
                              HTML nâng cao
                            </summary>
                            <textarea
                              readOnly
                              rows={7}
                              value={buildFriendlyRfqHtml(draftEditForm)}
                              className="mt-2 w-full p-2.5 border border-slate-200 bg-white rounded-lg text-[11px] font-mono text-slate-600 resize-y"
                            />
                          </details>
                          <div className="flex justify-end gap-2.5 text-xs">
                            <button
                              onClick={() => {
                                setEditingDraftId(null);
                                setDraftEditForm(emptyRfqDraftEditForm);
                              }}
                              disabled={savingDraftId === d.id}
                              className="px-4 py-1.5 bg-white hover:bg-slate-50 border-2 border-primary-dark text-primary-dark rounded-full font-black cursor-pointer uppercase disabled:opacity-50"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={() => handleSaveDraft(d.id)}
                              disabled={savingDraftId === d.id}
                              className="px-4 py-1.5 bg-primary text-white border-2 border-primary-dark rounded-full font-black cursor-pointer uppercase disabled:opacity-50"
                            >
                              {savingDraftId === d.id ? "Đang lưu..." : "Lưu thầu"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-white space-y-3">
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-primary-dark/60 uppercase tracking-wider">Tiêu đề email</p>
                              <p className="text-xs font-black text-primary-dark break-words">{d.subject}</p>
                            </div>
                          </div>
                          <div
                            className="p-4 bg-cream border-2 border-primary-dark/20 rounded-xl text-[12px] text-slate-700 font-medium overflow-auto max-h-72 leading-relaxed font-sans"
                            dangerouslySetInnerHTML={{ __html: d.bodyHtml }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* RFQ Sender triggers */}
              <div className="pt-4 border-t-2 border-dashed border-primary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-[10px] text-primary-dark/60 font-black uppercase tracking-wider">
                  {caseObj.status === "collecting_quotes" || caseObj.status === "rfq_sent" ? (
                    <span className="flex items-center gap-1.5 text-[#27AE60] bg-emerald-50 border-2 border-success px-3.5 py-2 rounded-full shadow-sm">
                      <Clock className="w-4 h-4 animate-spin" /> Đang nghe hòm thư phản hồi báo giá tự động...
                    </span>
                  ) : hasRfqDrafts ? "Review thư mời thầu trước khi gửi." : isRfqDraftSyncing ? "Đang đồng bộ bản nháp RFQ..." : "Vui lòng chọn NCC và nhấn phát thầu."}
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                    <>
                      {rfqDrafts.length === 0 ? (
                        <button
                          onClick={handleSelectSuppliers}
                          disabled={loadingAction !== null || currentRole !== "procurement" || !canEditSourcing}
                          className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingAction === "draft_rfq" || isRfqDraftSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {isRfqDraftSyncing ? "Đang đồng bộ RFQ" : "AI Soạn thư thầu"}
                        </button>
                      ) : (
                        <button
                          onClick={handleSendRfqs}
                          disabled={loadingAction !== null || currentRole !== "procurement" || editingDraftId !== null || savingDraftId !== null}
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer animate-bounce disabled:opacity-50"
                        >
                          {loadingAction === "send_rfqs" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Gửi thầu Gmail chính thức
                        </button>
                      )}
                    </>
                  )}

                  {["collecting_quotes", "rfq_sent"].includes(caseObj.status) && (
                    <button
                      onClick={() => {
                        showToast("Đã quét hòm thư đồng bộ.", "info");
                        fetchData();
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-cream border-2 border-primary-dark text-primary-dark font-black text-xs rounded-full transition transform active:scale-95 cursor-pointer uppercase tracking-wider shadow-sm"
                    >
                      Đồng bộ hòm thư thầu 📩
                    </button>
                  )}
                </div>
              </div>

              {/* Simulator Section for internal debugging only */}
              {showDevTools && ["collecting_quotes", "rfq_sent"].includes(caseObj.status) && (
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4.5 h-4.5 text-accent-gold animate-spin-slow" />
                    <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">Giả lập nhà cung cấp phản hồi thầu</h4>
                  </div>
                  <p className="text-xs text-primary-dark/85 font-medium leading-relaxed">
                    Để chạy demo khép kín, bạn có thể chọn một NCC giả lập nộp file báo giá. Hệ thống sẽ bóc tách dữ liệu AI OCR lập tức và lập bảng so sánh thầu!
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[9px] font-black text-primary-dark uppercase tracking-wider">NCC phản hồi thầu:</label>
                      <select 
                        value={simSupplierId}
                        onChange={e => setSimSupplierId(e.target.value)}
                        className="p-2.5 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                      >
                        <option value="">-- Chọn NCC nộp thầu --</option>
                        {matchedSuppliers.map(s => (
                          <option key={s.supplierId} value={s.supplierId}>{s.name} ({s.email})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[9px] font-black text-primary-dark uppercase tracking-wider">Tên file đính kèm (Báo giá PDF/Excel):</label>
                      <input 
                        type="text" 
                        value={simFile}
                        onChange={e => setSimFile(e.target.value)}
                        className="p-2.5 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-black font-mono text-primary-dark"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[9px] font-black text-primary-dark uppercase tracking-wider">Nội dung thư phản hồi:</label>
                    <textarea 
                      rows={3}
                      placeholder="Chào Stally F&B, chúng tôi phản hồi báo giá thầu chi tiết kèm theo..."
                      value={simEmailBody}
                      onChange={e => setSimEmailBody(e.target.value)}
                      className="p-2.5 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSimulateQuote}
                      disabled={loadingAction !== null || currentRole !== "procurement"}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {loadingAction === "simulate_quote" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Giả lập nộp thầu (Simulate Webhook)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestone 3 View: Side-by-side Matrix and AI Negotiation */}
          {activeMilestone === 3 && (
            <div className="space-y-6">
              {renderPermissionLock(["procurement"], "Đối Chiếu Báo Giá & AI Negotiation")}
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Scale className="w-5 h-5 text-teal-600" /> Bước 3: So sánh &amp; Thương lượng giá (AI Negotiation)
                </h3>
              </div>

              {comparison && comparison.matrix && comparison.matrix.length > 0 ? (
                <div className="space-y-6">
                  {/* AI Sourcing recommendation card (Gold glow) */}
                  <div className="bg-cream border-3 border-primary-dark p-5 rounded-3xl shadow-accent-glow">
                    <p className="text-[9px] font-black text-primary-dark uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Award className="w-4.5 h-4.5 text-accent-dark animate-bounce" /> Đề xuất lựa chọn tốt nhất từ AI Sourcing
                    </p>
                    <p className="text-xs text-primary-dark font-bold mt-2.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: comparison.summary.recommendationReason }} />
                  </div>

                  <div className="border-2 border-primary-dark rounded-2xl overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-primary-bg border-b-2 border-primary-dark font-black text-[9px] text-primary-dark uppercase tracking-wider">
                          <th className="p-3.5">Hồ sơ thầu</th>
                          {comparison.matrix.map((q: Quote) => (
                            <th key={q.id} className="p-3.5 border-l-2 border-primary-dark/20 relative min-w-[200px]">
                              <div className="space-y-1">
                                <p className="font-black text-primary-dark text-xs uppercase tracking-wide">{q.supplierName}</p>
                                <p className="text-[9px] font-mono text-primary-dark/50">ID: {q.id}</p>
                                {q.id === comparison.summary.lowestTotalQuoteId && (
                                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-accent-gold border border-primary-dark text-[8px] text-primary-dark font-black uppercase tracking-wider shadow-sm">Tối ưu nhất</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-dark/10 text-primary-dark font-bold">
                        <tr className="bg-cream/20">
                          <td className="p-3.5 bg-primary-bg/10">Tổng thanh toán thầu</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20 font-black text-xs text-primary-dark">
                              {formatVND(q.totalAmount)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 bg-primary-bg/10">Lịch giao hàng dự kiến</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20 font-black text-primary font-mono">
                              {q.deliveryDays} ngày
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 bg-primary-bg/10">Điều khoản công nợ</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20 text-primary-dark/75">
                              {q.paymentTerms}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 bg-primary-bg/10">Độ tin cậy trích xuất OCR</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20 font-mono font-black text-teal-600">
                              ⭐ {q.aiConfidenceScore}/100
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 bg-primary-bg/10">Trạng thái</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20">
                              <span className={`px-2 py-0.5 rounded-full border-2 text-[8px] font-black uppercase font-mono ${
                                q.status === "selected" ? "bg-emerald-50 border-success text-success" :
                                q.status === "rejected" ? "bg-coral-light/10 border-coral text-coral-dark" :
                                "bg-accent-light/10 border-accent-gold text-accent-dark"
                              }`}>
                                {q.status === "extracted" ? "Mới nhận" : q.status === "selected" ? "Được chọn" : "Đã loại"}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr className="bg-primary-bg/5">
                          <td className="p-3.5 bg-primary-bg/10">Thao tác</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3.5 border-l-2 border-primary-dark/20">
                              {caseObj.status !== "pending_approval" && caseObj.status !== "approved" && caseObj.status !== "closed" ? (
                                <button
                                  onClick={() => handleRequestApproval(q.id)}
                                  disabled={currentRole !== "procurement"}
                                  className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] rounded transition cursor-pointer text-center disabled:opacity-50"
                                >
                                  Trình duyệt PO
                                </button>
                              ) : (
                                <span className="text-primary-dark/50 italic text-[9px] font-black">Đã chọn duyệt</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* AI Negotiation Workspace (Playful Card) */}
                  {caseObj.status !== "closed" && (
                    <div className="bg-cream border-3 border-primary-dark p-5 rounded-3xl shadow-card space-y-4">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4.5 h-4.5 text-accent-dark animate-pulse" />
                        <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">AI Negotiation Hub – Đàm phán giảm giá thông minh</h4>
                      </div>
                      <p className="text-xs text-primary-dark/85 font-medium leading-relaxed">
                        Bạn chưa ưng ý mức giá của nhà thầu? Chọn NCC và đặt mục tiêu. Trợ lý AI sẽ lập tức soạn thảo email Gmail thương thảo chuyên sâu. Đối tác khi phản hồi giảm giá, hệ thống sẽ tự động cập nhật bảng so sánh!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[9px] font-black text-primary-dark uppercase tracking-wider">NCC đàm phán:</label>
                          <select
                            value={selectedNegSupplier}
                            onChange={e => setSelectedNegSupplier(e.target.value)}
                            className="p-2.5 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                          >
                            <option value="">-- Chọn nhà cung cấp --</option>
                            {negotiationSupplierOptions.map((supplier) => (
                              <option key={supplier.supplierId} value={supplier.supplierId}>
                                {supplier.name}{supplier.hasQuote ? " - đã có báo giá" : " - chờ báo giá"}
                              </option>
                            ))}
                          </select>
                          {negotiationSupplierOptions.length === 0 && (
                            <p className="text-[10px] font-bold text-coral-dark">
                              Chưa có NCC hợp lệ trong RFQ để thương lượng. Hãy gửi RFQ hoặc kiểm tra lại danh sách NCC.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[9px] font-black text-primary-dark uppercase tracking-wider">Mục tiêu thương lượng:</label>
                          <select
                            value={negGoal}
                            onChange={e => setNegGoal(e.target.value)}
                            className="p-2.5 border-2 border-primary-dark/30 bg-white rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                          >
                            <option value="discount_5">Yêu cầu chiết khấu thêm 5% giá trị</option>
                            <option value="faster_delivery">Yêu cầu rút ngắn thời gian giao hàng</option>
                            <option value="longer_terms">Yêu cầu kéo dài chu kỳ công nợ</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleDraftNegotiation}
                          disabled={negLoading || !selectedNegSupplier || negotiationSupplierOptions.length === 0 || currentRole !== "procurement"}
                          className="px-4 py-2.5 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {negLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AI soạn thư đàm phán
                        </button>
                      </div>

                      {negDraft && (
                        <div className="border-2 border-primary-dark rounded-2xl bg-white p-4 space-y-3 shadow-md animate-scale-up">
                          <div className="flex flex-col space-y-1.5">
                            <label className="text-[9px] font-black text-primary-dark uppercase">Bản thảo email đàm phán nháp:</label>
                            <textarea 
                              rows={5}
                              value={negEditedBody}
                              onChange={e => setNegEditedBody(e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark leading-relaxed focus:outline-none"
                            />
                          </div>
                          <div className="flex justify-end gap-2.5">
                            <button onClick={() => setNegDraft(null)} className="px-4 py-1.5 bg-white hover:bg-slate-55 border-2 border-primary-dark text-primary-dark rounded-full font-black text-xs uppercase cursor-pointer">Hủy</button>
                            <button
                              onClick={handleSendNegotiation}
                              disabled={loadingAction !== null || currentRole !== "procurement"}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {loadingAction === "send_neg" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Gửi email Gmail
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-coral animate-bounce" />
                  <h4 className="text-sm font-black text-primary-dark uppercase tracking-wider">Chưa nhận được báo giá thầu nào!</h4>
                  <p className="text-xs text-primary-dark/85 font-medium max-w-sm leading-relaxed">
                    Vui lòng bấm sang Bước 2 và sử dụng "Cổng giả lập đối tác nộp báo giá" để gửi dữ liệu thầu giả lập, AI sẽ phân tích ngay lập tức.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Milestone 4 View: Manager Approval Queue */}
          {activeMilestone === 4 && (
            <div className="space-y-6">
              {renderPermissionLock(["manager"], "Giám Đốc Phê Duyệt Hồ Sơ Thầu")}
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Award className="w-5 h-5 text-teal-600" /> Bước 4: Giám Đốc Phê Duyệt Hồ Sơ Thầu (CEO Review)
                </h3>
              </div>

              {comparison && comparison.matrix && comparison.matrix.length > 0 ? (
                <div className="space-y-6">
                  {/* Selected Quote Summary Card */}
                  <div className="bg-cream border-2 border-primary-dark p-5 rounded-2xl space-y-3 shadow-md border-l-8 border-l-accent-gold">
                    <h4 className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Hồ sơ thầu được đề xuất ký PO:</h4>
                    
                    {comparison.matrix.filter((q: Quote) => q.status === "selected" || q.id === caseObj.selectedQuoteId).map((q: Quote) => (
                      <div key={q.id} className="bg-white border-2 border-primary-dark p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                        <div className="space-y-1">
                          <p className="font-black text-sm text-primary-dark uppercase tracking-wide">{q.supplierName}</p>
                          <p className="text-[9px] text-primary-dark/50 font-black font-mono">Báo giá: {q.id} | Thời gian giao: {q.deliveryDays} ngày</p>
                          <p className="text-xs text-primary-dark font-bold mt-1.5">
                            Thanh toán: <span className="text-primary font-black uppercase font-mono">{q.paymentTerms}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-primary-dark/50 uppercase leading-none">Tổng giá trị PO thầu:</p>
                          <p className="text-base font-black text-primary-dark font-mono mt-1.5">{formatVND(q.totalAmount)}</p>
                          <span className="text-[9px] bg-primary-bg text-primary border border-primary font-mono font-black px-2 py-0.5 rounded-md mt-1 block w-fit ml-auto shadow-sm">
                            Đã đàm phán 10%
                          </span>
                        </div>
                      </div>
                    ))}

                    {comparison.matrix.filter((q: Quote) => q.status === "selected" || q.id === caseObj.selectedQuoteId).length === 0 && (
                      <p className="text-xs text-primary-dark/50 italic font-black">Chưa có NCC nào được chọn đề xuất. Hãy quay lại Bước 3 để đề xuất.</p>
                    )}
                  </div>

                  {/* Comment box and controls */}
                  {caseObj.status === "pending_approval" ? (
                    <div className="bg-surface-base border-2 border-primary-dark p-5 rounded-2xl space-y-4 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-4.5 h-4.5 text-accent-dark animate-pulse" />
                        <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">Quyết định phê duyệt của Giám Đốc (CEO)</h4>
                      </div>
                      
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-primary-dark uppercase tracking-widest">Ý kiến phê duyệt hoặc lý do bác bỏ thầu:</label>
                        <textarea 
                          rows={3}
                          placeholder="Duyệt đơn vị này do tổng chi phí tốt nhất và giao nhận nhanh..."
                          value={approvalComment}
                          onChange={e => setApprovalComment(e.target.value)}
                          className="p-2.5 border-2 border-primary-dark/30 bg-cream focus:border-primary-dark rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-3 flex-wrap">
                        <button
                          onClick={handleReject}
                          disabled={loadingAction !== null || currentRole !== "manager"}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {loadingAction === "reject_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                          Bác bỏ &amp; Đàm phán lại
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={loadingAction !== null || currentRole !== "manager"}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer disabled:opacity-50"
                        >
                          {loadingAction === "approve_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                          Ký duyệt phê duyệt đơn PO
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center bg-cream border-2 border-primary-dark p-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                      <span className="text-primary-dark/70">Trạng thái phê duyệt:</span>
                      {["approved", "po_draft", "po_sent", "receiving", "closed"].includes(caseObj.status) ? (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="w-4.5 h-4.5 text-success stroke-[3]" /> Đã được Giám Đốc phê duyệt ký PO!
                        </span>
                      ) : (
                        <span className="text-primary-dark/50 italic">Đang đợi đề xuất thầu sắm trình lên...</span>
                      )}
                    </div>
                  )}

                  {/* Create PO Draft control */}
                  {caseObj.status === "approved" && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleCreatePoDraft}
                        disabled={loadingAction !== null}
                        className="px-5 py-3 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 shadow-accent-glow transition transform active:scale-95 cursor-pointer animate-pulse uppercase tracking-wider"
                      >
                        {loadingAction === "po_draft" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary-dark" />}
                        Tạo Đơn đặt hàng nháp PO
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-coral" />
                  <h4 className="text-sm font-black text-primary-dark uppercase">Không tìm thấy hồ sơ báo giá!</h4>
                </div>
              )}
            </div>
          )}

          {/* Milestone 5 View: PO Issuance, Goods Receipt and Close */}
          {activeMilestone === 5 && (
            <div className="space-y-6 animate-fade-slide-up">
              <div className="pb-2 border-b-3 border-dashed border-primary/20">
                <h3 className="text-base font-black text-primary-dark flex items-center gap-2 font-display uppercase tracking-wider">
                  <Boxes className="w-5 h-5 text-primary-light" /> Bước 5: Đơn Đặt Hàng PO &amp; Ghi Nhận Nhập Kho
                </h3>
              </div>

              {poList.length > 0 ? (
                <div className="space-y-6">
                  {poList.map((po) => (
                    <div key={po.id} className="border-3 border-primary-dark rounded-3xl overflow-hidden bg-white p-5 space-y-4 shadow-card">
                      <div className="flex justify-between items-start border-b-2 border-dashed border-primary/20 pb-3 flex-wrap gap-2">
                        <div className="space-y-1">
                          <p className="text-[9px] bg-cream border-2 border-primary-dark px-2 py-0.5 rounded text-primary-dark font-mono font-black shadow-sm">PO CODE: {po.id.toUpperCase()}</p>
                          <h4 className="font-black text-sm text-primary-dark uppercase tracking-wider mt-2">Nhà cung ứng: {po.supplierName}</h4>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-0.5 rounded-full border-2 text-[8px] font-black uppercase font-mono ${
                            po.status === "confirmed" ? "bg-emerald-50 border-success text-success" : "bg-accent-light/10 border-accent-gold text-accent-dark"
                          }`}>
                            {po.status === "confirmed" ? "Đã phát thầu" : "Nháp"}
                          </span>
                          <p className="text-sm font-black text-primary-dark font-mono mt-1">{formatVND(po.totalAmount)}</p>
                        </div>
                      </div>

                      {/* PO Items List with Goods receipt fields */}
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Chi tiết sản phẩm đặt hàng (PO):</p>
                        
                        <div className="space-y-2.5">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex justify-between items-center gap-4">
                              <div className="space-y-0.5 flex-1 pr-4">
                                <p className="font-black text-xs text-slate-900">{it.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold font-mono">Số lượng đặt: {it.quantity} {it.unit} | Đơn giá: {formatVND(it.unitPrice)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-mono font-bold text-slate-750">{formatVND(it.quantity * it.unitPrice)}</p>
                                {caseObj.status === "closed" ? (
                                  <span className="text-[10px] font-black text-emerald-700 mt-1 flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 animate-pulse" /> Đã nhập {it.quantity} {it.unit}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-teal-600/80 mt-1 block">Chờ nhập kho</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PO Draft Trigger */}
                      {po.status === "issued" && (
                        <div className="flex justify-end pt-3">
                          <button
                            onClick={() => handleSendPo(po.id)}
                            disabled={loadingAction !== null || currentRole !== "procurement"}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            {loadingAction === "send_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Gửi thầu PO chính thức
                          </button>
                        </div>
                      )}

                      {po.status === "issued" && currentRole !== "procurement" && (
                        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-850 font-bold mt-3.5 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>Chỉ Nhân viên Thu Mua mới có quyền gửi đơn PO đặt hàng.</span>
                        </div>
                      )}

                      {/* PO Received / Check-in and Close Trigger */}
                      {po.status === "confirmed" && caseObj.status !== "closed" && (
                        <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                          <button
                            onClick={() => handleReceiveAllAndClose(po.id, po.items)}
                            disabled={loadingAction === "receive_all" || currentRole !== "warehouse"}
                            className="w-full sm:w-auto px-6 py-3 bg-[#006d77] hover:bg-[#00535b] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loadingAction === "receive_all" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />}
                            Xác nhận Kiểm Kho &amp; Hoàn Tất Nhập Kho (1-Click)
                          </button>
                        </div>
                      )}

                      {po.status === "confirmed" && caseObj.status !== "closed" && currentRole !== "warehouse" && (
                        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-850 font-bold mt-4 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>Chỉ Thủ Kho mới có quyền xác nhận thực nhận và nhập kho.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-cream border-2 border-primary-dark p-5 rounded-2xl space-y-3 shadow-md">
                  <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">Chưa tạo đơn đặt hàng PO chính thức:</h4>
                  <p className="text-xs text-primary-dark/85 font-medium">
                    CEO đã duyệt phê duyệt thầu? Hãy click khởi tạo Bản thảo PO thầu để chính thức tạo đơn hàng gửi nhà thầu.
                  </p>
                  
                  {caseObj.status === "po_draft" || caseObj.status === "approved" ? (
                    <>
                      <button
                        onClick={handleCreatePoDraft}
                        disabled={loadingAction !== null || currentRole !== "procurement"}
                        className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {loadingAction === "po_draft" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Khởi tạo bản thảo Đơn PO
                      </button>
                      
                      {currentRole !== "procurement" && (
                        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-850 font-bold mt-2 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>Chỉ Nhân viên Thu Mua mới có quyền khởi tạo bản thảo Đơn PO.</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-primary-dark/50 italic font-black">Chờ duyệt thầu của Giám đốc ở Bước 4...</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Step Timeline History logs and status details */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Metadata Card */}
          <div className="bg-white border-3 border-primary-dark rounded-3xl p-5 shadow-card space-y-4">
            <h3 className="text-xs font-black text-primary-dark uppercase tracking-wider font-display pb-2 border-b-2 border-dashed border-primary/20">Thông tin nguồn phát:</h3>
            
            <div className="space-y-3 text-xs text-primary-dark font-bold">
              <div className="flex justify-between items-center pb-2 border-b border-primary-dark/10">
                <span className="text-primary-dark/65 font-medium">Phòng ban đề xuất:</span>
                <span className="text-primary-dark uppercase font-black">{caseObj.departmentName || "Bộ phận Bếp"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-primary-dark/10">
                <span className="text-primary-dark/65 font-medium">Người đề xuất:</span>
                <span className="text-primary-dark font-black">{caseObj.requesterName || "Bếp Trưởng Bình"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-primary-dark/10">
                <span className="text-primary-dark/65 font-medium">Khởi tạo tự động:</span>
                <span className="text-primary uppercase font-black font-mono">{caseObj.createdFrom}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-primary-dark/10">
                <span className="text-primary-dark/65 font-medium">Hạn giao hàng bếp:</span>
                <span className="text-coral font-mono font-black">{caseObj.requiredDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-primary-dark/65 font-medium">Ngày lập:</span>
                <span className="text-primary-dark font-mono font-black">{new Date(caseObj.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </div>

          {/* Audit event timeline transition logs (retro board game lines) */}
          <div className="bg-white border-3 border-primary-dark rounded-3xl p-5 shadow-card space-y-4">
            <h3 className="text-xs font-black text-primary-dark uppercase tracking-wider font-display pb-2 border-b-2 border-dashed border-primary/20 flex items-center gap-1.5">
              <History className="w-4.5 h-4.5 text-primary" /> Nhật ký chuyển đổi Case thầu
            </h3>

            <div className="space-y-4 relative pl-4.5 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-1 before:bg-primary-dark/15 before:border-l-2 before:border-dashed before:border-primary-dark/25">
              {timeline.slice().reverse().map((t) => (
                <div key={t.id} className="relative space-y-1 pl-1">
                  {/* Playful board game circular dot */}
                  <div className="absolute -left-[24.5px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-primary-dark shadow-sm" />
                  
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-primary-dark font-black uppercase tracking-wide">{getStatusLabel(t.toStatus)}</span>
                    <span className="text-primary-dark/50 font-mono font-bold">{new Date(t.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <p className="text-[10px] text-primary-dark/80 leading-relaxed font-bold">
                    {t.reason}
                  </p>

                  <div className="flex items-center gap-1 mt-1 text-[8.5px] text-primary-dark/45 font-black uppercase tracking-widest font-mono">
                    <User className="w-3 h-3" />
                    <span>{t.actorRole} ({t.actorId})</span>
                  </div>
                </div>
              ))}
              
              {timeline.length === 0 && (
                <p className="text-[9.5px] text-primary-dark/50 font-bold italic text-center py-4">Chưa có nhật ký ghi chép thầu.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

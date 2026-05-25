import React, { useState, useEffect } from "react";
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

interface CaseDetailTimelineProps {
  caseId: string;
  onBackToList: () => void;
  currentRole: UserRole;
  orgId: string;
  onStateChanged?: () => void;
}

interface SupplierMatch {
  supplierId: string;
  name: string;
  email: string;
  score: number;
  reasons: string[];
  riskFlags: string[];
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

export default function CaseDetailTimeline({ 
  caseId, 
  onBackToList, 
  currentRole, 
  orgId, 
  onStateChanged 
}: CaseDetailTimelineProps) {
  
  const [loading, setLoading] = useState(true);
  const [caseObj, setCaseObj] = useState<ProcurementCase | null>(null);
  const [timeline, setTimeline] = useState<CaseTransition[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [matchedSuppliers, setMatchedSuppliers] = useState<SupplierMatch[]>([]);
  const [rfqDrafts, setRfqDrafts] = useState<RfqDraft[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<number>(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Intake States
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemNotes, setNewItemNotes] = useState("");

  // Sourcing States
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [customRfqDueDate, setCustomRfqDueDate] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  
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

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const caseRes = await fetch(`/api/v1/cases/${caseId}`, {
        headers: { "X-Organization-Id": orgId }
      });
      const caseData = await caseRes.json();
      if (caseData.error) throw new Error(caseData.error.message);
      setCaseObj(caseData.data);

      const timelineRes = await fetch(`/api/v1/cases/${caseId}/timeline`, {
        headers: { "X-Organization-Id": orgId }
      });
      const timelineData = await timelineRes.json();
      setTimeline(timelineData.data || []);

      const supRes = await fetch(`/api/suppliers`, {
        headers: { "X-Organization-Id": orgId }
      });
      const supData = await supRes.json();
      setSuppliers(supData || []);

      const compRes = await fetch(`/api/v1/cases/${caseId}/comparison`, {
        headers: { "X-Organization-Id": orgId }
      });
      const compData = await compRes.json();
      setComparison(compData);

      const poRes = await fetch(`/api/v1/purchase-orders`, {
        headers: { "X-Organization-Id": orgId }
      });
      const poData = await poRes.json().catch(() => ({ data: [] }));
      const casePOs = (poData.data || []).filter((p: PurchaseOrder) => p.caseId === caseId);
      setPoList(casePOs);
      
      const status = caseData.data.status;
      if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
        setActiveMilestone(1);
      } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
        setActiveMilestone(2);
        const matchesRes = await fetch(`/api/v1/cases/${caseId}/supplier-matches`, {
          method: "POST",
          headers: { "X-Organization-Id": orgId }
        });
        const matchesData = await matchesRes.json();
        setMatchedSuppliers(matchesData.data || []);
      } else if (["quote_review", "comparison_ready", "negotiating"].includes(status)) {
        setActiveMilestone(3);
      } else if (["pending_approval", "approved", "po_draft"].includes(status)) {
        setActiveMilestone(4);
      } else {
        setActiveMilestone(5);
      }

      setLoading(false);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Không thể đồng bộ dữ liệu hồ sơ thầu.", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  useEffect(() => {
    if (!caseObj) return;
    const status = caseObj.status;
    if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
      setActiveMilestone(1);
    } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
      setActiveMilestone(2);
    } else if (["quote_review", "comparison_ready", "negotiating"].includes(status)) {
      setActiveMilestone(3);
    } else if (["pending_approval", "approved", "po_draft"].includes(status)) {
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
      const res = await fetch(`/api/v1/cases/${caseId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ reason: "Ban Mua Sắm chuẩn hóa xong danh mục nguyên liệu." })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã chuẩn hóa yêu cầu và chuyển sang khâu mời thầu!", "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
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
      const res = await fetch(`/api/v1/cases/${caseId}/cancel`, {
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
      const res = await fetch(`/api/v1/cases/${caseId}/items`, {
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
      const res = await fetch(`/api/v1/cases/${caseId}/items/${index}`, {
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
    if (!aiSearchQuery) return;
    setLoadingAction("discover_suppliers");
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/suppliers/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ query: aiSearchQuery })
      });
      const data = await res.json();
      showToast(data.message || "Cào tìm kiếm trực tuyến thành công!", "success");
      fetchData();
    } catch (e: any) {
      showToast("Cào tìm kiếm nhà cung cấp thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSelectSuppliers = async () => {
    if (selectedSuppliers.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 nhà cung cấp.", "error");
      return;
    }
    setLoadingAction("draft_rfq");
    try {
      await fetch(`/api/v1/cases/${caseId}/suppliers/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ supplierIds: selectedSuppliers })
      });

      const draftRes = await fetch(`/api/v1/cases/${caseId}/rfq-draft`, {
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

  const handleSaveDraft = (draftId: string) => {
    setRfqDrafts(prev => prev.map(d => d.id === draftId ? { ...d, subject: editedSubject, bodyHtml: editedBody } : d));
    setEditingDraftId(null);
    showToast("Đã lưu chỉnh sửa email thầu!", "success");
  };

  const handleSendRfqs = async () => {
    if (rfqDrafts.length === 0) return;
    setLoadingAction("send_rfqs");
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/rfq/send`, {
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
      const res = await fetch(`/api/webhooks/inbound-email`, {
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
      const res = await fetch(`/api/v1/cases/${caseId}/negotiations/${selectedNegSupplier}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ goal: negGoal })
      });
      const data = await res.json();
      setNegDraft(data.data);
      setNegEditedBody(data.data.draftEmail);
      showToast("AI đã soạn thảo thư đàm phán tối ưu!", "success");
    } catch (e) {
      showToast("Đàm phán thất bại", "error");
    } finally {
      setNegLoading(false);
    }
  };

  const handleSendNegotiation = async () => {
    if (!negDraft) return;
    setLoadingAction("send_neg");
    try {
      const res = await fetch(`/api/v1/negotiation-drafts/${negDraft.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ editedBody: negEditedBody })
      });
      const data = await res.json();
      showToast("Đã gửi email đàm phán qua Gmail! Đang chờ đối tác trả lời v2...", "success");
      setNegDraft(null);
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 1800);
    } catch (e) {
      showToast("Gửi đàm phán thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestApproval = async (quoteId: string) => {
    setLoadingAction("request_app");
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/approval/request`, {
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
      const res = await fetch(`/api/v1/approval-requests/${caseId}/approve`, {
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
      const res = await fetch(`/api/v1/approval-requests/${caseId}/reject`, {
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
      const res = await fetch(`/api/v1/cases/${caseId}/po-draft`, {
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
      const res = await fetch(`/api/v1/purchase-orders/${poId}/send`, {
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

  const handleReceiveGoodsItem = async (itemId: string, itemIdx: number, poId: string) => {
    const qty = receivedQtys[itemIdx] || 0;

    if (qty <= 0) {
      showToast("Vui lòng nhập số lượng nhận hợp lệ.", "error");
      return;
    }

    setLoadingAction(`receive_${itemIdx}`);
    try {
      const poItemName = poList[0]?.items[itemIdx]?.name;
      const invItem = suppliers.length > 0 ? (await (await fetch("/api/state", { headers: { "X-Organization-Id": orgId } })).json()).inventory.find((i: any) => i.name.toLowerCase() === poItemName.toLowerCase()) : null;
      
      if (!invItem) {
        throw new Error("Không tìm thấy sản phẩm tương ứng trong danh mục Kho để nhập hàng.");
      }

      const res = await fetch(`/api/inventory/receive-goods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({
          itemId: invItem.id,
          quantityReceived: qty,
          referenceId: poId,
          createdBy: "Thủ Kho Stally"
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast(`Đã nhận thành công ${qty} ${invItem.unit} ${poItemName} vào kho hàng!`, "success");
      
      const allReceived = poList[0]?.items.every((it: any, idx: number) => {
        if (idx === itemIdx) return true;
        return (receivedQtys[idx] || 0) >= it.quantity;
      });

      if (allReceived && qty >= poList[0]?.items[itemIdx]?.quantity) {
        await fetch(`/api/v1/cases/${caseId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
          body: JSON.stringify({ reason: "Thủ kho nhận hàng đầy đủ. Quy trình đóng thầu hoàn tất." })
        });
        showToast("Quy trình mua sắm thầu khép kín đã hoàn tất thành công và được Đóng lại!", "success");
      }

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
          
          {caseObj.status !== "closed" && caseObj.status !== "cancelled" && (
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
          
          {milestones.map((step) => {
            const isCompleted = step.num < activeMilestone;
            const isActive = step.num === activeMilestone;
            
            return (
              <button
                key={step.num}
                onClick={() => {
                  if (step.num <= activeMilestone) {
                    setActiveMilestone(step.num);
                  } else {
                    showToast(`Khóa. Hãy hoàn tất bước hiện tại trước.`, "info");
                  }
                }}
                className={`relative z-10 flex items-center space-x-3 text-left w-full md:w-auto p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  isActive ? "bg-accent-gold border-primary-dark shadow-accent-glow scale-[1.03]" : "bg-white border-transparent hover:bg-primary-bg/15"
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 border-2 transition-all ${
                  isCompleted ? "bg-primary border-primary-dark text-white" :
                  isActive ? "bg-[#FFF8E7] border-primary-dark text-primary-dark animate-pulse shadow-sm" :
                  "bg-white border-primary-dark/30 text-primary-dark/55"
                }`}>
                  {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.num}
                </div>
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-wider leading-none ${isActive ? "text-primary-dark" : isCompleted ? "text-primary-dark/85" : "text-primary-dark/45"}`}>
                    {step.label}
                  </p>
                  <p className="text-[8px] font-black text-primary-dark/50 uppercase tracking-widest mt-1.5 leading-none">
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stepper Sub-views Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Dynamic action workflow panel */}
        <div className="lg:col-span-8 bg-white border-3 border-primary-dark rounded-3xl p-6 shadow-card min-h-[500px]">
          
          {/* Milestone 1 View: Request Intake & Standardization */}
          {activeMilestone === 1 && (
            <div className="space-y-6 animate-fade-slide-up">
              <div className="pb-2 border-b-3 border-dashed border-primary/20">
                <h3 className="text-base font-black text-primary-dark flex items-center gap-2 font-display uppercase tracking-wider">
                  <FileText className="w-5 h-5 text-primary-light" /> Bước 1: Tiếp nhận &amp; Xác minh yêu cầu
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
              {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) && (
                <div className="bg-cream border-2 border-primary-dark p-4 rounded-2xl space-y-3 shadow-md">
                  <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider">Thêm mặt hàng mới để chuẩn hóa:</h4>
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
                    disabled={loadingAction !== null || caseObj.items.length === 0}
                    className="px-5 py-3 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-2 shadow-accent-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
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
            <div className="space-y-6 animate-fade-slide-up">
              <div className="pb-2 border-b-3 border-dashed border-primary/20">
                <h3 className="text-base font-black text-primary-dark flex items-center gap-2 font-display uppercase tracking-wider">
                  <Building2 className="w-5 h-5 text-primary-light" /> Bước 2: Khớp Nhà Cung Cấp &amp; Phát RFQ
                </h3>
              </div>

              {/* Sourcing crawler workspace */}
              {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                <div className="bg-cream border-3 border-primary-dark p-5 rounded-3xl space-y-3 relative overflow-hidden shadow-card">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-accent-gold/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center gap-1.5 text-xs font-black text-primary-dark uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-accent-gold animate-pulse" />
                    <span>Google Search Grounding Sourcing Crawler</span>
                  </div>
                  <p className="text-xs text-primary-dark/85 font-medium leading-relaxed">
                    Thiếu nhà cung cấp phù hợp trong danh bạ? Nhập mặt hàng, AI của Stally sẽ cào thông tin định vị địa lý, email và báo giá sỉ thực tế trên Google để giới thiệu đối tác mới!
                  </p>
                  <div className="flex gap-2.5">
                    <input 
                      type="text" 
                      placeholder="Tìm NCC sỉ... (Ví dụ: Đại lý bán sỉ cá hồi tươi ngon)"
                      value={aiSearchQuery}
                      onChange={e => setAiSearchQuery(e.target.value)}
                      className="flex-1 p-2.5 border-2 border-primary-dark/30 bg-white focus:border-primary-dark rounded-xl text-xs font-bold text-primary-dark focus:outline-none"
                    />
                    <button
                      onClick={handleSupplierDiscover}
                      disabled={loadingAction !== null || !aiSearchQuery}
                      className="px-5 py-2 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-xl flex items-center gap-1.5 shadow-teal-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
                    >
                      {loadingAction === "discover_suppliers" ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <Search className="w-4 h-4" />}
                      AI quét thầu
                    </button>
                  </div>
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
                        if (!["supplier_matching", "rfq_draft"].includes(caseObj.status)) return;
                        setSelectedSuppliers(prev => 
                          prev.includes(item.supplierId) ? prev.filter(id => id !== item.supplierId) : [...prev, item.supplierId]
                        );
                      }}
                      className={`p-4 rounded-3xl border-3 transition-all flex justify-between items-start cursor-pointer border-l-8 ${
                        selectedSuppliers.includes(item.supplierId) 
                          ? "bg-cream border-primary-dark shadow-accent-glow border-l-accent-gold transform scale-[1.01]" 
                          : "bg-white border-primary-dark/20 hover:border-primary-dark border-l-primary-light"
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
                      
                      {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
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

              {/* Draft RFQ personalization editor panel */}
              {rfqDrafts.length > 0 && (
                <div className="space-y-4 pt-4 border-t-2 border-dashed border-primary/20">
                  <h4 className="text-xs font-black text-primary-dark uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent-gold" /> AI Dự thảo thư mời thầu RFQ chi tiết:
                  </h4>
                  
                  {rfqDrafts.map((d) => (
                    <div key={d.id} className="border-2 border-primary-dark rounded-2xl overflow-hidden bg-surface-base">
                      <div className="p-3.5 bg-cream flex justify-between items-center text-xs font-black border-b-2 border-primary-dark">
                        <span className="text-primary-dark uppercase tracking-wide">{d.supplierName} ({d.supplierEmail})</span>
                        <button
                          onClick={() => {
                            setEditingDraftId(d.id);
                            setEditedSubject(d.subject);
                            setEditedBody(d.bodyHtml);
                          }}
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
                              value={editedSubject}
                              onChange={e => setEditedSubject(e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold text-primary-dark"
                            />
                          </div>
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-black text-primary-dark uppercase">Nội dung thư thầu (HTML)</label>
                            <textarea 
                              rows={8}
                              value={editedBody}
                              onChange={e => setEditedBody(e.target.value)}
                              className="p-2.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-bold font-mono text-primary-dark"
                            />
                          </div>
                          <div className="flex justify-end gap-2.5 text-xs">
                            <button onClick={() => setEditingDraftId(null)} className="px-4 py-1.5 bg-white hover:bg-slate-55 border-2 border-primary-dark text-primary-dark rounded-full font-black cursor-pointer uppercase">Hủy</button>
                            <button onClick={() => handleSaveDraft(d.id)} className="px-4 py-1.5 bg-primary text-white border-2 border-primary-dark rounded-full font-black cursor-pointer uppercase">Lưu thầu</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-white space-y-2">
                          <p className="text-xs font-black text-primary-dark">Tiêu đề: {d.subject}</p>
                          <div 
                            className="p-3 bg-cream border-2 border-primary-dark/20 rounded-xl text-[11px] text-primary-dark font-medium overflow-auto max-h-40 leading-relaxed font-sans"
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
                  ) : "Vui lòng chọn NCC và nhấn phát thầu."}
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                    <>
                      {rfqDrafts.length === 0 ? (
                        <button
                          onClick={handleSelectSuppliers}
                          disabled={loadingAction !== null}
                          className="w-full sm:w-auto px-5 py-3 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center justify-center gap-2 shadow-accent-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
                        >
                          {loadingAction === "draft_rfq" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          AI Soạn thư thầu
                        </button>
                      ) : (
                        <button
                          onClick={handleSendRfqs}
                          disabled={loadingAction !== null}
                          className="w-full sm:w-auto px-5 py-3 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-full flex items-center justify-center gap-2 shadow-teal-glow transition transform active:scale-95 cursor-pointer animate-pulse uppercase tracking-wider"
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

              {/* Simulator Section for Demo purposes (Cream/dashed card) */}
              {["collecting_quotes", "rfq_sent"].includes(caseObj.status) && (
                <div className="bg-cream border-3 border-dashed border-primary-dark/30 p-5 rounded-3xl space-y-4 shadow-sm">
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
                      disabled={loadingAction !== null}
                      className="px-5 py-2.5 bg-coral hover:bg-coral-dark border-2 border-primary-dark text-white font-black text-xs rounded-full flex items-center gap-1.5 shadow-coral-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
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
            <div className="space-y-6 animate-fade-slide-up">
              <div className="pb-2 border-b-3 border-dashed border-primary/20">
                <h3 className="text-base font-black text-primary-dark flex items-center gap-2 font-display uppercase tracking-wider">
                  <Scale className="w-5 h-5 text-primary-light" /> Bước 3: So sánh &amp; Thương lượng giá (AI Negotiation)
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
                                  className="w-full py-1.5 bg-accent-gold hover:bg-accent-dark border-2 border-primary-dark text-primary-dark font-black text-[9px] rounded-full uppercase transition transform active:scale-95 shadow-sm cursor-pointer text-center"
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
                            {comparison.matrix.map((q: Quote) => (
                              <option key={q.supplierId} value={q.supplierId}>{q.supplierName}</option>
                            ))}
                          </select>
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
                          disabled={negLoading || !selectedNegSupplier}
                          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 shadow-teal-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
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
                              disabled={loadingAction !== null}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black text-xs flex items-center gap-1.5 border-2 border-primary-dark shadow-teal-glow cursor-pointer uppercase"
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
            <div className="space-y-6 animate-fade-slide-up">
              <div className="pb-2 border-b-3 border-dashed border-primary/20">
                <h3 className="text-base font-black text-primary-dark flex items-center gap-2 font-display uppercase tracking-wider">
                  <Award className="w-5 h-5 text-primary-light" /> Bước 4: Giám Đốc Phê Duyệt Hồ Sơ Thầu (CEO Review)
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
                          disabled={loadingAction !== null}
                          className="px-4 py-2.5 bg-white hover:bg-cream border-2 border-coral text-coral font-black text-xs rounded-full flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer shadow-coral-glow uppercase tracking-wider"
                        >
                          {loadingAction === "reject_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                          Bác bỏ &amp; Đàm phán lại
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={loadingAction !== null}
                          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 transition shadow-teal-glow transform active:scale-95 cursor-pointer uppercase tracking-wider"
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
                      <div className="space-y-3.5">
                        <p className="text-xs font-black text-primary-dark uppercase tracking-wider">Chi tiết thầu &amp; Đối soát nhập thực tế:</p>
                        
                        <div className="space-y-3.5">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="bg-surface-base border-2 border-primary-dark/30 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative">
                              <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                              <div className="space-y-0.5 flex-1 pr-4 pl-1">
                                <p className="font-black text-xs text-primary-dark uppercase tracking-wide">{it.name}</p>
                                <p className="text-[9.5px] text-primary-dark/60 font-black font-mono mt-1">Đặt thầu: {it.quantity} {it.unit} | Đơn giá: {formatVND(it.unitPrice)}</p>
                              </div>

                              {po.status === "confirmed" ? (
                                <div className="flex flex-wrap items-center gap-3.5 shrink-0 w-full md:w-auto">
                                  <div className="flex flex-col space-y-1">
                                    <label className="text-[9px] font-black text-primary-dark/70 uppercase block">Thực nhận:</label>
                                    <input 
                                      type="number"
                                      placeholder="Số lượng"
                                      value={receivedQtys[idx] || ""}
                                      onChange={e => setReceivedQtys(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                      className="w-20 p-1.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-mono font-black text-primary-dark text-center focus:outline-none"
                                    />
                                  </div>

                                  <div className="flex flex-col space-y-1">
                                    <label className="text-[9px] font-black text-primary-dark/70 uppercase block">Đánh giá:</label>
                                    <select 
                                      value={qualityStatuses[idx] || "accepted"}
                                      onChange={e => setQualityStatuses(prev => ({ ...prev, [idx]: e.target.value }))}
                                      className="p-1.5 border-2 border-primary-dark/30 bg-cream rounded-xl text-xs font-black text-primary-dark focus:outline-none"
                                    >
                                      <option value="accepted">Đạt chuẩn 🟢</option>
                                      <option value="damaged">Bị lỗi hỏng 🔴</option>
                                      <option value="expired">Móp méo/Hạn 🟡</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-col space-y-1 justify-end pt-4">
                                    {caseObj.status !== "closed" ? (
                                      <button
                                        onClick={() => handleReceiveGoodsItem(po.supplierId, idx, po.id)}
                                        disabled={loadingAction === `receive_${idx}`}
                                        className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-[9px] rounded-full uppercase transition transform active:scale-95 shadow-sm cursor-pointer"
                                      >
                                        {loadingAction === `receive_${idx}` ? "Nhập..." : "Nhập Kho"}
                                      </button>
                                    ) : (
                                      <span className="text-success text-[10px] font-black flex items-center gap-0.5">✓ Nhập kho</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-primary-dark/50 italic font-bold">Cần phát hành PO chính thức trước khi nhập kho.</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PO Draft Trigger */}
                      {po.status !== "confirmed" && (
                        <div className="flex justify-end pt-3">
                          <button
                            onClick={() => handleSendPo(po.id)}
                            disabled={loadingAction !== null}
                            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 transition shadow-teal-glow transform active:scale-95 cursor-pointer uppercase tracking-wider animate-pulse"
                          >
                            {loadingAction === "send_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Gửi thầu PO chính thức
                          </button>
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
                    <button
                      onClick={handleCreatePoDraft}
                      disabled={loadingAction !== null}
                      className="px-5 py-3 bg-accent-gold hover:bg-accent-dark text-primary-dark border-2 border-primary-dark font-black text-xs rounded-full flex items-center gap-1.5 shadow-accent-glow transition transform active:scale-95 cursor-pointer uppercase tracking-wider"
                    >
                      {loadingAction === "po_draft" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-primary-dark" />}
                      Khởi tạo bản thảo PO
                    </button>
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

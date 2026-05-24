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
      // Fetch Case Details
      const caseRes = await fetch(`/api/v1/cases/${caseId}`, {
        headers: { "X-Organization-Id": orgId }
      });
      const caseData = await caseRes.json();
      if (caseData.error) throw new Error(caseData.error.message);
      setCaseObj(caseData.data);

      // Fetch Timeline
      const timelineRes = await fetch(`/api/v1/cases/${caseId}/timeline`, {
        headers: { "X-Organization-Id": orgId }
      });
      const timelineData = await timelineRes.json();
      setTimeline(timelineData.data || []);

      // Fetch All Suppliers
      const supRes = await fetch(`/api/suppliers`, {
        headers: { "X-Organization-Id": orgId }
      });
      const supData = await supRes.json();
      setSuppliers(supData || []);

      // Fetch comparison matrix
      const compRes = await fetch(`/api/v1/cases/${caseId}/comparison`, {
        headers: { "X-Organization-Id": orgId }
      });
      const compData = await compRes.json();
      setComparison(compData);

      // Fetch existing POs
      const poRes = await fetch(`/api/v1/purchase-orders`, {
        headers: { "X-Organization-Id": orgId }
      });
      const poData = await poRes.json().catch(() => ({ data: [] }));
      const casePOs = (poData.data || []).filter((p: PurchaseOrder) => p.caseId === caseId);
      setPoList(casePOs);
      
      // Determine Milestone
      const status = caseData.data.status;
      if (["draft_request", "request_submitted", "request_validating"].includes(status)) {
        setActiveMilestone(1);
      } else if (["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"].includes(status)) {
        setActiveMilestone(2);
        // Load matches
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

  // Synchronize dynamic milestones when caseObj changes
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
        <RefreshCw className="w-8 h-8 text-[#006d77] animate-spin" />
        <span className="text-xs text-slate-400 font-bold">Đang tải hồ sơ quy trình chi tiết...</span>
      </div>
    );
  }

  // ----------------------------------------------------
  // MILESTONE DEFINITIONS
  // ----------------------------------------------------
  const milestones = [
    { num: 1, label: "Yêu cầu & Đánh giá", desc: "Chuẩn hóa danh mục" },
    { num: 2, label: "Nhà cung cấp & RFQ", desc: "Mời thầu & Báo giá" },
    { num: 3, label: "Thương lượng giá", desc: "So sánh & Đàm phán" },
    { num: 4, label: "Phê duyệt PO", desc: "Ký duyệt đơn PO" },
    { num: 5, label: "Nhập kho & Đóng", desc: "Đối soát thực nhận" }
  ];

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case "urgent": return "bg-rose-50 border-rose-200 text-rose-700";
      case "high": return "bg-amber-50 border-amber-200 text-amber-700";
      case "medium": return "bg-teal-50 border-teal-200 text-teal-700";
      default: return "bg-slate-50 border-slate-200 text-slate-600";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return "Khẩn cấp 🚨";
      case "high": return "Cao ⚠️";
      case "medium": return "Trung bình";
      default: return "Thấp";
    }
  };

  const getStatusBadgeColor = (s: string) => {
    if (s === "closed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "cancelled") return "bg-slate-100 text-slate-500 border-slate-200";
    if (s === "exception") return "bg-rose-100 text-rose-800 border-rose-200 animate-pulse";
    if (s.startsWith("po_")) return "bg-sky-100 text-sky-800 border-sky-200";
    if (s === "pending_approval") return "bg-amber-100 text-amber-800 border-amber-200 animate-pulse";
    return "bg-[#e0f2f1] text-[#004d40] border-[#b2dfdb]";
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft_request: "Yêu cầu nháp",
      request_submitted: "Đã gửi yêu cầu",
      request_validating: "Đang xác minh",
      supplier_matching: "Đang đề xuất NCC",
      rfq_draft: "Đang soạn RFQ",
      rfq_sent: "Đã gửi RFQ",
      collecting_quotes: "Đang thu thập báo giá",
      quote_review: "Đang duyệt báo giá",
      comparison_ready: "So sánh sẵn sàng",
      negotiating: "Đang đàm phán AI",
      pending_approval: "Chờ phê duyệt",
      approved: "Đã phê duyệt",
      po_draft: "Đang lập PO",
      po_sent: "Đã phát PO",
      receiving: "Đang nhận hàng",
      closed: "Đã đóng",
      cancelled: "Đã hủy",
      exception: "Lỗi nghiệp vụ"
    };
    return map[s] || s;
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------
  
  // Submit request (A) -> request_validating
  const handleIntakeSubmit = async () => {
    setLoadingAction("submit_intake");
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ reason: "Procurement chuẩn hóa danh mục sản phẩm thành công." })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã chuẩn hóa yêu cầu và chuyển sang bước Đề xuất nhà cung cấp!", "success");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Cancel Case
  const handleCancelCase = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy bỏ quy trình mua sắm này?")) return;
    setLoadingAction("cancel_case");
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ reason: "Người dùng chủ động hủy bỏ trên giao diện." })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      showToast("Đã hủy bỏ quy trình mua sắm này.", "info");
      if (onStateChanged) onStateChanged();
      setTimeout(fetchData, 650);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Add Item
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
      showToast("Đã thêm sản phẩm vào danh mục!", "success");
      fetchData();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  // Delete Item
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

  // Google Crawling Discovery (B)
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

  // Confirm Selection and Draft RFQ (C)
  const handleSelectSuppliers = async () => {
    if (selectedSuppliers.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 nhà cung cấp.", "error");
      return;
    }
    setLoadingAction("draft_rfq");
    try {
      // 1. Select suppliers
      await fetch(`/api/v1/cases/${caseId}/suppliers/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ supplierIds: selectedSuppliers })
      });

      // 2. Draft RFQ
      const draftRes = await fetch(`/api/v1/cases/${caseId}/rfq-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Organization-Id": orgId },
        body: JSON.stringify({ supplierIds: selectedSuppliers, dueDate: customRfqDueDate })
      });
      const draftData = await draftRes.json();
      setRfqDrafts(draftData.data || []);
      showToast("AI đã tự động soạn thư mời thầu nháp chuyên biệt cho từng NCC!", "success");
      fetchData();
    } catch (e: any) {
      showToast("Tạo bản thảo RFQ thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Save changes to email draft
  const handleSaveDraft = (draftId: string) => {
    setRfqDrafts(prev => prev.map(d => d.id === draftId ? { ...d, subject: editedSubject, bodyHtml: editedBody } : d));
    setEditingDraftId(null);
    showToast("Đã lưu chỉnh sửa email thầu!", "success");
  };

  // Send RFQs (C)
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

  // Simulate Inbound Email Quote (D & E)
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

  // Draft AI Negotiation Email (F)
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

  // Send Negotiation Email (F)
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
      setTimeout(fetchData, 1800); // 1.8s for supplier simulator reply
    } catch (e) {
      showToast("Gửi đàm phán thất bại.", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  // Request Approval (G)
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

  // Approve Quote and create PO (G & H)
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

  // Reject / Request changes (G)
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

  // Create Draft PO (H)
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

  // Send PO Official (H)
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

  // Goods receipt (I) -> updates inventory and closes case if complete
  const handleReceiveGoodsItem = async (itemId: string, itemIdx: number, poId: string) => {
    const qty = receivedQtys[itemIdx] || 0;
    const status = qualityStatuses[itemIdx] || "accepted";
    const notes = receivingNotes[itemIdx] || "Đầy đủ";

    if (qty <= 0) {
      showToast("Vui lòng nhập số lượng nhận hợp lệ.", "error");
      return;
    }

    setLoadingAction(`receive_${itemIdx}`);
    try {
      // Find the inventory item by matching name
      const poItemName = poList[0]?.items[itemIdx]?.name;
      const invItem = suppliers.length > 0 ? (await (await fetch("/api/state", { headers: { "X-Organization-Id": orgId } })).json()).inventory.find((i: any) => i.name.toLowerCase() === poItemName.toLowerCase()) : null;
      
      if (!invItem) {
        throw new Error("Không tìm thấy sản phẩm tương ứng trong danh mục Kho để ghi nhận nhập kho.");
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
      
      // Auto transitions case status via backend when checking PO delivery.
      // If we received all, let's close case!
      const allReceived = poList[0]?.items.every((it: any, idx: number) => {
        if (idx === itemIdx) return true; // currently checked
        return (receivedQtys[idx] || 0) >= it.quantity;
      });

      if (allReceived && qty >= poList[0]?.items[itemIdx]?.quantity) {
        // Transition case to closed
        await fetch(`/api/v1/cases/${caseId}/submit`, { // transitions receiving -> closed
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 executive-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToList}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Mã quy trình: {caseObj.id.toUpperCase()}</span>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getStatusBadgeColor(caseObj.status)}`}>
                {getStatusLabel(caseObj.status)}
              </span>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getPriorityBadgeColor(caseObj.priority)}`}>
                {getPriorityLabel(caseObj.priority)}
              </span>
            </div>
            <h2 className="text-lg font-black text-[#00535b] mt-1 font-display tracking-tight leading-none">
              {caseObj.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ
          </button>
          
          {caseObj.status !== "closed" && caseObj.status !== "cancelled" && (
            <button
              onClick={handleCancelCase}
              className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hủy Case thầu
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Multi-stage Wizard Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 executive-shadow">
        <div className="flex flex-col md:flex-row justify-between items-center relative gap-6">
          {/* Stepper Connecting Line */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-slate-100 hidden md:block z-0" />
          
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
                    showToast(`Bước này đang bị khóa. Hãy hoàn tất bước hiện tại trước.`, "info");
                  }
                }}
                className={`relative z-10 flex items-center space-x-3 text-left w-full md:w-auto p-3 rounded-xl transition-all cursor-pointer ${
                  isActive ? "bg-[#e0f2f1]/80 border border-[#b2dfdb] scale-102" : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all ${
                  isCompleted ? "bg-teal-600 border-teal-600 text-white" :
                  isActive ? "bg-[#00535b] border-[#00535b] text-white animate-pulse" :
                  "bg-white border-slate-200 text-slate-400"
                }`}>
                  {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : step.num}
                </div>
                <div>
                  <p className={`text-xs font-black leading-none ${isActive ? "text-[#00535b]" : isCompleted ? "text-slate-700" : "text-slate-400"}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1 leading-none">
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
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 executive-shadow min-h-[500px]">
          
          {/* Milestone 1 View: Request Intake & Standardization */}
          {activeMilestone === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <FileText className="w-5 h-5 text-teal-600" /> Bước 1: Tiếp nhận &amp; Chuẩn hóa Yêu cầu
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Đánh giá các sản phẩm cần thu mua từ Requester, thực hiện chỉnh sửa cấu trúc hoặc thêm sản phẩm để chuẩn hóa lớp B2B.
                </p>
              </div>

              {/* Informational Panel */}
              <div className="bg-[#e0f2f1]/30 border border-[#b2dfdb]/40 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#004d40]">Vai trò: {currentRole === "procurement" ? "Nhân viên Thu Mua (Sourcing Staff)" : "Độc giả"}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Bạn cần đối chiếu các sản phẩm bếp trưởng yêu cầu. Thêm ghi chú hoặc loại bỏ các mục trùng lặp trước khi gửi đi khớp nhà thầu.
                  </p>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">Tên sản phẩm</th>
                      <th className="p-3.5 text-center">Số lượng</th>
                      <th className="p-3.5">Đơn vị</th>
                      <th className="p-3.5">Ghi chú</th>
                      <th className="p-3.5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {caseObj.items && caseObj.items.length > 0 ? (
                      caseObj.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/55 transition-all">
                          <td className="p-3.5 font-bold font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3.5 font-black text-slate-900">{item.name}</td>
                          <td className="p-3.5 text-center font-bold font-mono text-teal-800 bg-teal-50/30">{item.quantity}</td>
                          <td className="p-3.5 font-bold text-slate-500">{item.unit}</td>
                          <td className="p-3.5 text-slate-400 italic font-medium">{item.notes || "—"}</td>
                          <td className="p-3.5 text-center">
                            {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) && (
                              <button 
                                onClick={() => handleDeleteItem(idx)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold italic">Không có mặt hàng nào trong danh mục thầu.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add New Item Panel */}
              {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-black text-slate-700">Thêm sản phẩm mới chuẩn hóa:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input 
                      type="text" 
                      placeholder="Tên nguyên liệu... (Ví dụ: Gạo ST25)"
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                    />
                    <input 
                      type="number" 
                      placeholder="Số lượng"
                      value={newItemQty}
                      onChange={e => setNewItemQty(Number(e.target.value))}
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800 font-mono"
                    />
                    <select 
                      value={newItemUnit}
                      onChange={e => setNewItemUnit(e.target.value)}
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="kg">kg</option>
                      <option value="chai">chai (5L)</option>
                      <option value="bao">bao</option>
                      <option value="hộp">hộp</option>
                      <option value="đv">đơn vị</option>
                    </select>
                    <button
                      onClick={handleAddItem}
                      className="p-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm nhanh
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ghi chú yêu cầu..."
                    value={newItemNotes}
                    onChange={e => setNewItemNotes(e.target.value)}
                    className="w-full p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              )}

              {/* Step submit trigger */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                {["draft_request", "request_submitted", "request_validating"].includes(caseObj.status) ? (
                  <button
                    onClick={handleIntakeSubmit}
                    disabled={loadingAction !== null || caseObj.items.length === 0}
                    className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {loadingAction === "submit_intake" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Xác nhận chuẩn hóa danh mục &amp; Tiếp tục
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <Check className="w-4 h-4 text-emerald-600" /> Hồ sơ này đã hoàn tất chuẩn hóa
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Milestone 2 View: Supplier Matching & RFQ Compose */}
          {activeMilestone === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Building2 className="w-5 h-5 text-teal-600" /> Bước 2: Khớp Nhà Cung Cấp &amp; Phát RFQ
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Khớp các đối tác phù hợp có lịch sử uy tín trong danh bạ hoặc sử dụng AI cào tìm kiếm trực tuyến từ Google.
                </p>
              </div>

              {/* Sourcing crawler workspace */}
              {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                <div className="bg-gradient-to-r from-teal-50 to-white border border-[#b2dfdb]/40 p-4 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-teal-500/5 rounded-full blur-xl" />
                  <div className="flex items-center gap-1.5 text-xs font-black text-teal-800">
                    <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
                    <span>Google Search Grounding Sourcing Crawler</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Không có nhà cung cấp gạo/dầu sỉ trong danh bạ? Gõ từ khóa nguyên liệu, AI sẽ quét cào dữ liệu địa chỉ, email thực của 3 NCC hàng đầu Việt Nam để mở rộng thầu thợ.
                  </p>
                  <div className="flex gap-2.5">
                    <input 
                      type="text" 
                      placeholder="Tìm NCC sỉ... (Ví dụ: Đại lý gạo thơm ST25 giá sỉ)"
                      value={aiSearchQuery}
                      onChange={e => setAiSearchQuery(e.target.value)}
                      className="flex-1 p-2 border border-[#b2dfdb]/60 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                    />
                    <button
                      onClick={handleSupplierDiscover}
                      disabled={loadingAction !== null || !aiSearchQuery}
                      className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {loadingAction === "discover_suppliers" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      AI Cào đối tác
                    </button>
                  </div>
                </div>
              )}

              {/* Suggested matched suppliers grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-1">
                  Đề xuất nhà thầu tốt nhất ({matchedSuppliers.length}):
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
                      className={`p-4 rounded-xl border transition-all flex justify-between items-start cursor-pointer ${
                        selectedSuppliers.includes(item.supplierId) 
                          ? "bg-teal-50/50 border-teal-500 ring-1 ring-teal-500/50" 
                          : "bg-white border-slate-200 hover:border-slate-350"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-800 truncate max-w-[150px]">{item.name}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 font-mono font-bold">
                            Khớp {item.score}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold">{item.email}</p>
                        
                        <div className="space-y-1 pt-1.5">
                          {item.reasons.map((r, i) => (
                            <p key={i} className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
                              <span className="text-emerald-500">✔</span> {r}
                            </p>
                          ))}
                        </div>
                      </div>
                      
                      {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedSuppliers.includes(item.supplierId) ? "bg-teal-600 border-teal-600 text-white" : "border-slate-300 bg-white"
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
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-600" /> Dự thảo Email RFQ từ AI:
                  </h4>
                  
                  {rfqDrafts.map((d) => (
                    <div key={d.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <div className="p-3 bg-slate-100 flex justify-between items-center text-xs font-bold border-b border-slate-200">
                        <span className="text-[#00535b]">{d.supplierName} ({d.supplierEmail})</span>
                        <button
                          onClick={() => {
                            setEditingDraftId(d.id);
                            setEditedSubject(d.subject);
                            setEditedBody(d.bodyHtml);
                          }}
                          className="px-2 py-1 bg-white hover:bg-slate-200 border border-slate-300 text-slate-600 rounded flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" /> Biên tập thư
                        </button>
                      </div>

                      {editingDraftId === d.id ? (
                        <div className="p-4 space-y-3 bg-white">
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tiêu đề email</label>
                            <input 
                              type="text"
                              value={editedSubject}
                              onChange={e => setEditedSubject(e.target.value)}
                              className="p-2 border border-slate-200 rounded text-xs font-bold text-slate-800"
                            />
                          </div>
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nội dung thư thầu (HTML)</label>
                            <textarea 
                              rows={8}
                              value={editedBody}
                              onChange={e => setEditedBody(e.target.value)}
                              className="p-2 border border-slate-200 rounded text-xs font-medium font-mono text-slate-700"
                            />
                          </div>
                          <div className="flex justify-end gap-2 text-xs">
                            <button onClick={() => setEditingDraftId(null)} className="px-3 py-1.5 bg-slate-100 rounded cursor-pointer font-bold text-slate-600">Hủy</button>
                            <button onClick={() => handleSaveDraft(d.id)} className="px-3 py-1.5 bg-teal-600 text-white rounded cursor-pointer font-bold">Lưu</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-white space-y-2">
                          <p className="text-xs font-bold text-slate-800">Tiêu đề: {d.subject}</p>
                          <div 
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 font-medium overflow-auto max-h-40 leading-relaxed font-sans"
                            dangerouslySetInnerHTML={{ __html: d.bodyHtml }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* RFQ Sender triggers */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="text-[11px] text-slate-400 font-bold">
                  {caseObj.status === "collecting_quotes" || caseObj.status === "rfq_sent" ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg">
                      <Clock className="w-3.5 h-3.5 animate-spin" /> Đang lắng nghe hòm thư báo giá tự động...
                    </span>
                  ) : "Vui lòng chọn NCC và nhấn tạo thầu nháp."}
                </div>

                <div className="flex gap-3">
                  {["supplier_matching", "rfq_draft"].includes(caseObj.status) && (
                    <>
                      {rfqDrafts.length === 0 ? (
                        <button
                          onClick={handleSelectSuppliers}
                          disabled={loadingAction !== null}
                          className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer"
                        >
                          {loadingAction === "draft_rfq" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          AI Soạn thư thầu nháp
                        </button>
                      ) : (
                        <button
                          onClick={handleSendRfqs}
                          disabled={loadingAction !== null}
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md cursor-pointer animate-bounce"
                        >
                          {loadingAction === "send_rfqs" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Gửi thầu chính thức qua Gmail
                        </button>
                      )}
                    </>
                  )}

                  {["collecting_quotes", "rfq_sent"].includes(caseObj.status) && (
                    <button
                      onClick={() => {
                        showToast("Đã kích hoạt lắng nghe thủ công. Báo giá sắp xuất hiện.", "info");
                        fetchData();
                      }}
                      className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Kiểm tra hòm thư Gmail 📩
                    </button>
                  )}
                </div>
              </div>

              {/* Simulator Section for Demo purposes */}
              {["collecting_quotes", "rfq_sent"].includes(caseObj.status) && (
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                    <h4 className="text-xs font-black text-slate-800">Cổng giả lập đối tác NCC phản hồi thư (Web thầu)</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Giả lập kịch bản một nhà cung cấp đính kèm file báo giá Excel/PDF và reply lại chuỗi email thầu của bạn. AI của hệ thống sẽ bắt webhook, trích xuất dữ liệu dòng thầu, và trả về phương án v2.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Đối tác gửi báo giá:</label>
                      <select 
                        value={simSupplierId}
                        onChange={e => setSimSupplierId(e.target.value)}
                        className="p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-850"
                      >
                        <option value="">-- Chọn NCC nộp thầu --</option>
                        {matchedSuppliers.map(s => (
                          <option key={s.supplierId} value={s.supplierId}>{s.name} ({s.email})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tên File đính kèm hóa đơn:</label>
                      <input 
                        type="text" 
                        value={simFile}
                        onChange={e => setSimFile(e.target.value)}
                        className="p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-bold font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nội dung email phản hồi (Tùy chọn soạn sỉ):</label>
                    <textarea 
                      rows={3}
                      placeholder="Chào Stally F&B, chúng tôi gửi bảng báo giá gạo/dầu ăn sỉ rẻ nhất..."
                      value={simEmailBody}
                      onChange={e => setSimEmailBody(e.target.value)}
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-800 font-sans"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSimulateQuote}
                      disabled={loadingAction !== null}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {loadingAction === "simulate_quote" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Phát tín hiệu Webhook Báo giá (Simulate)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milestone 3 View: Side-by-side Matrix and AI Negotiation */}
          {activeMilestone === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Scale className="w-5 h-5 text-teal-600" /> Bước 3: So sánh &amp; Thương lượng giá (AI Negotiation)
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Xem bảng ma trận so sánh thầu tối ưu do AI trích xuất và soạn thư đàm phán giảm giá thông minh.
                </p>
              </div>

              {/* Comparison Matrix Component */}
              {comparison && comparison.matrix && comparison.matrix.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-emerald-50 via-white to-white border border-emerald-200/50 p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-600 animate-bounce" /> Đề xuất phê duyệt từ AI Sourcing Assistant
                    </p>
                    <p className="text-xs text-slate-700 mt-2 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: comparison.summary.recommendationReason }} />
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 font-bold border-b border-slate-200 text-slate-500">
                          <th className="p-3">Hồ sơ chào thầu</th>
                          {comparison.matrix.map((q: Quote) => (
                            <th key={q.id} className="p-3 border-l border-slate-200 relative min-w-[200px]">
                              <div className="space-y-1">
                                <p className="font-black text-slate-800 text-sm">{q.supplierName}</p>
                                <p className="text-[9px] font-mono text-slate-400">Quote ID: {q.id}</p>
                                {q.id === comparison.summary.lowestTotalQuoteId && (
                                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[8px] text-emerald-700 font-extrabold uppercase">Rẻ nhất</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Tổng thanh toán (gồm thuế/ship)</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200 font-black text-sm text-[#00535b] bg-teal-50/20">
                              {formatVND(q.totalAmount)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Thời gian giao hàng dự kiến</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200 font-bold text-slate-800">
                              {q.deliveryDays} ngày
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Điều khoản thanh toán</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200 text-slate-500">
                              {q.paymentTerms}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Độ tin cậy trích xuất AI OCR</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200 font-mono text-xs">
                              <span className="text-teal-600 font-black">⭐ {q.aiConfidenceScore}/100</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Trạng thái thầu</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${
                                q.status === "selected" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                q.status === "rejected" ? "bg-rose-50 border-rose-200 text-rose-800" :
                                "bg-amber-50 border-amber-200 text-amber-800"
                              }`}>
                                {q.status === "extracted" ? "Chưa duyệt" : q.status === "selected" ? "Đã đề xuất" : "Đã loại"}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-bold bg-slate-50/50">Thao tác</td>
                          {comparison.matrix.map((q: Quote) => (
                            <td key={q.id} className="p-3 border-l border-slate-200">
                              {caseObj.status !== "pending_approval" && caseObj.status !== "approved" && caseObj.status !== "closed" ? (
                                <button
                                  onClick={() => handleRequestApproval(q.id)}
                                  className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] rounded transition cursor-pointer text-center"
                                >
                                  Đề xuất duyệt NCC này
                                </button>
                              ) : (
                                <span className="text-slate-450 italic text-[10px]">Đã chốt lựa chọn</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* AI Negotiation Workspace */}
                  {caseObj.status !== "closed" && (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
                        <h4 className="text-xs font-black text-slate-800">Hội thảo AI Negotiation - Đàm phán giảm giá tự động</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Chọn một nhà thầu tiềm năng và đặt mục tiêu đàm phán (Giảm giá 5%, Rút ngắn giao hàng, Gia hạn công nợ). Hệ thống AI sẽ soạn thảo email thương lượng gửi qua Gmail. NCC sẽ phản hồi v2 giúp cải thiện cơ cấu giá!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">NCC cần đàm phán:</label>
                          <select
                            value={selectedNegSupplier}
                            onChange={e => setSelectedNegSupplier(e.target.value)}
                            className="p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-850"
                          >
                            <option value="">-- Chọn nhà cung cấp --</option>
                            {comparison.matrix.map((q: Quote) => (
                              <option key={q.supplierId} value={q.supplierId}>{q.supplierName}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Mục tiêu thương lượng:</label>
                          <select
                            value={negGoal}
                            onChange={e => setNegGoal(e.target.value)}
                            className="p-2.5 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-850"
                          >
                            <option value="discount_5">Yêu cầu giảm giá 5%</option>
                            <option value="faster_delivery">Yêu cầu giao hàng nhanh hơn 1 ngày</option>
                            <option value="longer_terms">Yêu cầu giãn nợ công nợ Net 30</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={handleDraftNegotiation}
                          disabled={negLoading || !selectedNegSupplier}
                          className="px-4 py-2.5 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {negLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AI Soạn thư đàm phán
                        </button>
                      </div>

                      {negDraft && (
                        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
                          <div className="flex flex-col space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Bản thảo thư đàm phán nháp:</label>
                            <textarea 
                              rows={5}
                              value={negEditedBody}
                              onChange={e => setNegEditedBody(e.target.value)}
                              className="p-2 border border-slate-200 rounded text-xs font-sans text-slate-700 leading-relaxed focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="flex justify-end gap-2.5">
                            <button onClick={() => setNegDraft(null)} className="px-3.5 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 cursor-pointer">Hủy</button>
                            <button
                              onClick={handleSendNegotiation}
                              disabled={loadingAction !== null}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              {loadingAction === "send_neg" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Gửi email đàm phán thầu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                  <h4 className="text-sm font-bold text-slate-800">Chưa nhận được báo giá nào để tạo ma trận so sánh!</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Vui lòng bấm sang Bước 2 và sử dụng "Cổng giả lập đối tác" để gửi báo giá của các bên, AI sẽ phân tích hóa đơn lập tức.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Milestone 4 View: Manager Approval Queue */}
          {activeMilestone === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Award className="w-5 h-5 text-teal-600" /> Bước 4: Giám Đốc Phê Duyệt Hồ Sơ Thầu (CEO Review)
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Phê duyệt đơn đặt hàng PO chính thức dựa trên bảng phân tích thầu tối ưu của Phòng thu mua.
                </p>
              </div>

              {comparison && comparison.matrix && comparison.matrix.length > 0 ? (
                <div className="space-y-6">
                  {/* Selected Quote Summary Card */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Hồ sơ thầu được đề xuất:</h4>
                    
                    {comparison.matrix.filter((q: Quote) => q.status === "selected" || q.id === caseObj.selectedQuoteId).map((q: Quote) => (
                      <div key={q.id} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <p className="font-black text-sm text-slate-800">{q.supplierName}</p>
                          <p className="text-[10px] text-slate-400 font-bold font-mono">ID báo giá: {q.id} | Delivery: {q.deliveryDays} ngày</p>
                          <p className="text-xs text-slate-600 font-semibold mt-1">
                            Điều khoản: <span className="text-teal-700 font-bold">{q.paymentTerms}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Tổng giá trị đơn PO:</p>
                          <p className="text-base font-black text-[#00535b] mt-1.5">{formatVND(q.totalAmount)}</p>
                          <span className="text-[9px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-150 font-mono">
                            Đã tiết kiệm 10%
                          </span>
                        </div>
                      </div>
                    ))}

                    {comparison.matrix.filter((q: Quote) => q.status === "selected" || q.id === caseObj.selectedQuoteId).length === 0 && (
                      <p className="text-xs text-slate-400 italic font-semibold">Chưa có NCC nào được chọn đề xuất. Hãy quay lại Bước 3 để đề cử phương án thầu tốt nhất.</p>
                    )}
                  </div>

                  {/* Comment box and controls */}
                  {caseObj.status === "pending_approval" ? (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-black text-slate-800">Quyết định phê duyệt của Giám Đốc (Nguyễn Thị Mai)</h4>
                      </div>
                      
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Ý kiến phê duyệt hoặc lý do bác bỏ thầu:</label>
                        <textarea 
                          rows={3}
                          placeholder="Chọn đơn vị này do tổng chi phí tốt nhất và giao hàng nhanh. Duyệt xuất PO chính thức..."
                          value={approvalComment}
                          onChange={e => setApprovalComment(e.target.value)}
                          className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={handleReject}
                          disabled={loadingAction !== null}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {loadingAction === "reject_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                          Bác bỏ / Yêu cầu đàm phán lại
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={loadingAction !== null}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer"
                        >
                          {loadingAction === "approve_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                          Phê duyệt hồ sơ thầu &amp; Ký đơn PO
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-bold">
                      <span className="text-slate-500">Trạng thái phê duyệt:</span>
                      {["approved", "po_draft", "po_sent", "receiving", "closed"].includes(caseObj.status) ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hồ sơ thầu đã được CEO Phê duyệt thành công!
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chờ nộp hồ sơ so sánh thầu từ Phòng Thu Mua...</span>
                      )}
                    </div>
                  )}

                  {/* Create PO Draft control */}
                  {caseObj.status === "approved" && (
                    <div className="flex justify-end pt-4">
                      <button
                        onClick={handleCreatePoDraft}
                        disabled={loadingAction !== null}
                        className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer animate-bounce"
                      >
                        {loadingAction === "po_draft" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Tạo Đơn đặt hàng nháp PO
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-800">Không tìm thấy hồ sơ so sánh báo giá thầu!</h4>
                </div>
              )}
            </div>
          )}

          {/* Milestone 5 View: PO Issuance, Goods Receipt and Close */}
          {activeMilestone === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-[#00535b] flex items-center gap-2 font-display">
                  <Boxes className="w-5 h-5 text-teal-600" /> Bước 5: Đơn Đặt Hàng PO &amp; Ghi Nhận Nhập Kho
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Phát hành đơn đặt hàng chính thức và xác nhận số lượng thực tế hàng hóa nhập kho để tự động nâng cân đối tồn kho.
                </p>
              </div>

              {/* Purchase order details grid */}
              {poList.length > 0 ? (
                <div className="space-y-6">
                  {poList.map((po) => (
                    <div key={po.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white p-5 space-y-4">
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <p className="text-xs font-mono font-bold text-slate-400">PO CODE: {po.id.toUpperCase()}</p>
                          <h4 className="font-black text-sm text-slate-850">Nhà cung ứng: {po.supplierName}</h4>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${
                            po.status === "confirmed" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}>
                            {po.status === "confirmed" ? "Đã phát thầu" : "Nháp"}
                          </span>
                          <p className="text-sm font-black text-[#00535b] mt-1">{formatVND(po.totalAmount)}</p>
                        </div>
                      </div>

                      {/* PO Items List with Goods receipt fields */}
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Chi tiết sản phẩm thầu &amp; Ghi nhận thực nhận kho:</p>
                        
                        <div className="space-y-3.5">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="space-y-0.5 flex-1 pr-4">
                                <p className="font-black text-xs text-slate-900">{it.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold font-mono">Số lượng thầu: {it.quantity} {it.unit} | Đơn giá: {formatVND(it.unitPrice)}</p>
                              </div>

                              {po.status === "confirmed" ? (
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                  <div className="flex flex-col space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Thực tế nhận:</label>
                                    <input 
                                      type="number"
                                      placeholder="Số lượng"
                                      value={receivedQtys[idx] || ""}
                                      onChange={e => setReceivedQtys(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                      className="w-20 p-1.5 border border-slate-200 bg-white rounded text-xs font-bold font-mono text-teal-800"
                                    />
                                  </div>

                                  <div className="flex flex-col space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Đánh giá hàng:</label>
                                    <select 
                                      value={qualityStatuses[idx] || "accepted"}
                                      onChange={e => setQualityStatuses(prev => ({ ...prev, [idx]: e.target.value }))}
                                      className="p-1.5 border border-slate-200 bg-white rounded text-xs font-bold text-slate-800"
                                    >
                                      <option value="accepted">Tốt / Đạt 🟢</option>
                                      <option value="damaged">Hỏng / Móp 🔴</option>
                                      <option value="expired">Cận hạn / Hỏng 🟡</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-col space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Thao tác nhập:</label>
                                    {caseObj.status !== "closed" ? (
                                      <button
                                        onClick={() => handleReceiveGoodsItem(po.supplierId, idx, po.id)}
                                        disabled={loadingAction === `receive_${idx}`}
                                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] rounded transition cursor-pointer"
                                      >
                                        {loadingAction === `receive_${idx}` ? "Nhập..." : "Nhập Kho"}
                                      </button>
                                    ) : (
                                      <span className="text-emerald-700 text-[10px] font-bold">✓ Đã nhận kho</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 italic">Cần gửi đơn PO thầu trước khi ghi nhận kiểm kho.</div>
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
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {loadingAction === "send_po" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Gửi Đơn đặt hàng PO thật qua Gmail
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-700">Chưa tạo đơn đặt hàng PO chính thức:</h4>
                  <p className="text-xs text-slate-500">
                    Phê duyệt thầu đã được Giám Đốc xác nhận? Hãy nhấp khởi tạo Bản thảo PO thầu để gửi email PO đến nhà thầu.
                  </p>
                  
                  {caseObj.status === "po_draft" || caseObj.status === "approved" ? (
                    <button
                      onClick={handleCreatePoDraft}
                      disabled={loadingAction !== null}
                      className="px-5 py-3 bg-[#00535b] hover:bg-[#003d44] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer"
                    >
                      {loadingAction === "po_draft" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Khởi tạo bản thảo Đơn PO
                    </button>
                  ) : (
                    <div className="text-xs text-slate-400 italic font-semibold">Đang đợi Giám Đốc ký phê duyệt hồ sơ ở Bước 4...</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Step Timeline History logs and status details */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Metadata Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 executive-shadow space-y-3.5">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-display">Thông tin nguồn phát:</h3>
            
            <div className="space-y-2.5 text-xs text-slate-650 font-bold">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Phòng ban đề xuất:</span>
                <span className="text-slate-800">{caseObj.departmentName || "Bộ phận Bếp"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Người đề xuất:</span>
                <span className="text-slate-800">{caseObj.requesterName || "Bếp Trưởng Bình"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Nguồn tạo tự động:</span>
                <span className="text-teal-700 uppercase font-mono">{caseObj.createdFrom}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Hạn giao nguyên liệu:</span>
                <span className="text-rose-700 font-mono font-black">{caseObj.requiredDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Ngày tạo:</span>
                <span className="text-slate-500 font-mono font-medium">{new Date(caseObj.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </div>

          {/* Audit event timeline transition logs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 executive-shadow space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-display flex items-center gap-1.5">
              <History className="w-4 h-4 text-teal-600" /> Nhật ký chuyển trạng thái Case
            </h3>

            <div className="space-y-4 relative pl-3.5 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
              {timeline.slice().reverse().map((t) => (
                <div key={t.id} className="relative space-y-1">
                  <div className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 rounded-full bg-teal-600 border border-white" />
                  
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-[#00535b] font-black">{getStatusLabel(t.toStatus)}</span>
                    <span className="text-slate-450 font-mono">{new Date(t.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
                    {t.reason}
                  </p>

                  <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.actorRole} ({t.actorId})</span>
                  </div>
                </div>
              ))}
              
              {timeline.length === 0 && (
                <p className="text-[10px] text-slate-400 font-semibold italic text-center py-4">Chưa có nhật ký hoạt động chuyển đổi.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

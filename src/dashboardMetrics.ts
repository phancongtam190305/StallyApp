import { getQuoteRiskFlags } from "./quoteRisk";
import { InventoryItem, ProcurementCase, PurchaseRequest, Quote, RfqCase, Supplier } from "./types";

export type DashboardTaskKind =
  | "quote_risk"
  | "case_overdue"
  | "rfq_waiting"
  | "pr_intake"
  | "supplier_missing_info";

export interface DashboardTask {
  id: string;
  kind: DashboardTaskKind;
  title: string;
  reason: string;
  targetTab: "cases" | "pr" | "rfq" | "suppliers";
  targetCaseId?: string;
  targetRfqId?: string;
  targetPrId?: string;
  targetSupplierId?: string;
  severity: "high" | "medium" | "low";
  dueLabel: string;
  value: number;
}

export interface DashboardMetricsInput {
  purchaseRequests: PurchaseRequest[];
  rfqs: RfqCase[];
  quotes: Quote[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  cases: ProcurementCase[];
}

export interface DashboardMetrics {
  operator: {
    actionCount: number;
    pendingRfqCount: number;
    quoteReviewCount: number;
    overdueCaseCount: number;
    priorityQueue: DashboardTask[];
  };
  executive: {
    approvedSpend: number;
    riskCount: number;
    overdueCaseCount: number;
    pipeline: Array<{ id: string; label: string; count: number }>;
  };
}

export function buildDashboardMetrics(input: DashboardMetricsInput): DashboardMetrics {
  const quoteRiskTasks = input.quotes
    .filter((quote) => getQuoteRiskFlags(quote).length > 0)
    .map((quote): DashboardTask => {
      const rfq = input.rfqs.find((item) => item.id === quote.rfqCaseId);
      const relatedCase = findCaseForRfq(input.cases, quote.rfqCaseId, rfq?.purchaseRequestId);
      const rawFlag = getQuoteRiskFlags(quote)[0] || "Báo giá cần kiểm tra thủ công";
      let businessReason = rawFlag;
      if (rawFlag.includes("Độ tin cậy")) {
        businessReason = `Duyệt báo giá rủi ro từ NCC (AI Confidence Score ${quote.aiConfidenceScore}%)`;
      } else if (rawFlag.includes("Tổng tiền")) {
        businessReason = "Rà soát tổng giá trị báo giá bất thường";
      } else if (rawFlag.includes("Thiếu điều khoản")) {
        businessReason = "Bổ sung điều khoản thanh toán rõ ràng";
      } else if (rawFlag.includes("thiếu đơn giá")) {
        businessReason = "Sửa dòng hàng thiếu đơn giá/thành tiền";
      }
      return {
        id: `quote-${quote.id}`,
        kind: "quote_risk",
        title: quote.supplierName || "Báo giá cần kiểm tra",
        reason: businessReason,
        targetTab: relatedCase ? "cases" : "rfq",
        targetCaseId: relatedCase?.id,
        targetRfqId: quote.rfqCaseId,
        targetPrId: rfq?.purchaseRequestId,
        severity: "high",
        dueLabel: "Cần review",
        value: quote.totalAmount || 0,
      };
    });

  const overdueCaseTasks = input.cases
    .filter((caseItem) => isCaseOverdue(caseItem))
    .map((caseItem): DashboardTask => ({
      id: `case-overdue-${caseItem.id}`,
      kind: "case_overdue",
      title: caseItem.title,
      reason: "Hồ sơ mua hàng quá hạn xử lý - cần đốc thúc hoặc hủy",
      targetTab: "cases",
      targetCaseId: caseItem.id,
      targetPrId: caseItem.requestId,
      targetRfqId: caseItem.currentRfqId,
      severity: "high",
      dueLabel: caseItem.requiredDate || "Quá hạn",
      value: priorityValue(caseItem.priority),
    }));

  const rfqWaitingTasks = input.rfqs
    .filter((rfq) => ["sent", "quotes_received"].includes(rfq.status))
    .map((rfq): DashboardTask => {
      const relatedCase = findCaseForRfq(input.cases, rfq.id, rfq.purchaseRequestId);
      return {
        id: `rfq-${rfq.id}`,
        kind: "rfq_waiting",
        title: relatedCase?.title || rfq.id.toUpperCase(),
        reason: "So sánh báo giá và phản hồi RFQ từ các nhà cung cấp",
        targetTab: relatedCase ? "cases" : "rfq",
        targetCaseId: relatedCase?.id,
        targetRfqId: rfq.id,
        targetPrId: rfq.purchaseRequestId,
        severity: rfq.status === "quotes_received" ? "medium" : "low",
        dueLabel: rfq.dueDate,
        value: 0,
      };
    });

  const prIntakeTasks = input.purchaseRequests
    .filter((pr) => ["draft", "submitted"].includes(pr.status))
    .map((pr): DashboardTask => ({
      id: `pr-${pr.id}`,
      kind: "pr_intake",
      title: pr.title,
      reason: "Chuẩn hóa thông tin yêu cầu mua (PR) và tạo RFQ thầu",
      targetTab: "pr",
      targetCaseId: input.cases.find((caseItem) => caseItem.requestId === pr.id)?.id,
      targetPrId: pr.id,
      severity: pr.priority === "high" ? "medium" : "low",
      dueLabel: pr.requiredDate,
      value: priorityValue(pr.priority),
    }));

  const supplierTasks = input.suppliers
    .filter((supplier) => !supplier.email || !supplier.phone || supplier.tags.length === 0)
    .map((supplier): DashboardTask => ({
      id: `supplier-${supplier.id}`,
      kind: "supplier_missing_info",
      title: supplier.name,
      reason: "Cập nhật thông tin liên hệ và phân loại ngành hàng NCC",
      targetTab: "suppliers",
      targetSupplierId: supplier.id,
      severity: "low",
      dueLabel: "Bổ sung hồ sơ",
      value: supplier.rating || 0,
    }));

  const priorityQueue = [
    ...quoteRiskTasks,
    ...overdueCaseTasks,
    ...rfqWaitingTasks,
    ...prIntakeTasks,
    ...supplierTasks,
  ].sort(compareTasks);

  const approvedSpend = input.quotes
    .filter((quote) => quote.status === "selected" && quote.totalAmount > 0)
    .reduce((sum, quote) => sum + quote.totalAmount, 0);

  const pipeline = [
    { id: "intake", label: "Intake", statuses: ["draft_request", "request_submitted", "request_validating"] },
    { id: "sourcing", label: "Sourcing", statuses: ["supplier_matching", "rfq_draft", "rfq_sent", "collecting_quotes"] },
    { id: "review", label: "Review", statuses: ["quote_review", "comparison_ready", "negotiating"] },
    { id: "approval", label: "Approval", statuses: ["pending_approval", "approved", "po_draft"] },
    { id: "fulfillment", label: "Fulfillment", statuses: ["po_sent", "receiving", "closed", "cancelled", "exception"] },
  ].map((group) => ({
    id: group.id,
    label: group.label,
    count: input.cases.filter((caseItem) => group.statuses.includes(caseItem.status)).length,
  }));

  return {
    operator: {
      actionCount: priorityQueue.length,
      pendingRfqCount: rfqWaitingTasks.length,
      quoteReviewCount: quoteRiskTasks.length,
      overdueCaseCount: overdueCaseTasks.length,
      priorityQueue,
    },
    executive: {
      approvedSpend,
      riskCount: quoteRiskTasks.length + supplierTasks.length,
      overdueCaseCount: overdueCaseTasks.length,
      pipeline,
    },
  };
}

function compareTasks(a: DashboardTask, b: DashboardTask) {
  const severityScore = { high: 3, medium: 2, low: 1 };
  const severityDelta = severityScore[b.severity] - severityScore[a.severity];
  if (severityDelta !== 0) return severityDelta;
  return b.value - a.value;
}

function isCaseOverdue(caseItem: ProcurementCase) {
  if (!caseItem.requiredDate || ["closed", "cancelled"].includes(caseItem.status)) return false;
  const dueDate = new Date(`${caseItem.requiredDate}T23:59:59`);
  return Number.isFinite(dueDate.getTime()) && dueDate.getTime() < Date.now();
}

function findCaseForRfq(cases: ProcurementCase[], rfqId: string, purchaseRequestId?: string) {
  return cases.find((caseItem) => caseItem.currentRfqId === rfqId)
    || cases.find((caseItem) => Boolean(purchaseRequestId) && caseItem.requestId === purchaseRequestId);
}

function priorityValue(priority: string | undefined) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

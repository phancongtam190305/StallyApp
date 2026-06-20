import React from "react";
import { AlertTriangle, ArrowRight, Clock, FileText } from "lucide-react";
import { DashboardTask } from "../../dashboardMetrics";

interface PriorityQueueProps {
  tasks: DashboardTask[];
  onNavigate: (tab: DashboardTask["targetTab"]) => void;
  t: (key: any) => string;
}

function formatVND(value: number): string {
  if (!value || value === 0) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}export default function PriorityQueue({ tasks, onNavigate, t }: PriorityQueueProps) {
  const kindLabels: Record<string, { label: string; color: string }> = {
    quote_risk: { label: t("pqKindQuoteRisk"), color: "bg-rose-50 text-rose-700 border-rose-200" },
    case_overdue: { label: t("pqKindCaseOverdue"), color: "bg-amber-50 text-amber-700 border-amber-200" },
    rfq_waiting: { label: t("pqKindRfqWaiting"), color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    pr_intake: { label: t("pqKindPrIntake"), color: "bg-blue-50 text-blue-700 border-blue-200" },
    supplier_missing_info: { label: t("pqKindSupplierMissing"), color: "bg-slate-50 text-slate-700 border-slate-200" },
  };

  const translateReason = (reason: string) => {
    if (!reason) return "";
    if (reason.includes("Duyệt báo giá rủi ro")) {
      const match = reason.match(/\d+/);
      const score = match ? match[0] : "";
      return t("pqReasonRiskQuote").replace("{score}", score);
    }
    if (reason.includes("Rà soát tổng giá trị")) return t("pqReasonAbnormalTotal");
    if (reason.includes("Bổ sung điều khoản")) return t("pqReasonPaymentTerms");
    if (reason.includes("Sửa dòng hàng thiếu")) return t("pqReasonMissingPrices");
    if (reason.includes("Hồ sơ mua hàng quá hạn")) return t("pqReasonOverdueCase");
    if (reason.includes("So sánh báo giá và phản hồi")) return t("pqReasonRfqCompare");
    if (reason.includes("Chuẩn hóa thông tin yêu cầu")) return t("pqReasonPrIntake");
    if (reason.includes("Cập nhật thông tin liên hệ")) return t("pqReasonSupplierInfo");
    return reason;
  };

  const translateDueLabel = (label: string) => {
    if (label === "Cần review") return t("pqDueReview");
    if (label === "Quá hạn") return t("pqDueOverdue");
    if (label === "Bổ sung hồ sơ") return t("pqDueAddProfile");
    return label;
  };

  const translateTitle = (title: string) => {
    if (title === "Báo giá cần kiểm tra") return t("pqTitleQuoteCheck");
    return title;
  };

  if (tasks.length === 0) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl p-6 executive-shadow" data-testid="priority-queue">
        <p className="text-sm font-bold text-slate-900">{t("pqEmptyStateTitle")}</p>
        <p className="text-xs text-slate-500 mt-1">{t("pqEmptyStateDesc")}</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl executive-shadow overflow-hidden" data-testid="priority-queue">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-extrabold text-slate-900">{t("pqTitle")}</h2>
        <p className="text-xs text-slate-500 mt-1">{t("pqSubtitle")}</p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
              <th className="text-left px-5 py-3">{t("pqColTask")}</th>
              <th className="text-left px-3 py-3">{t("pqColCategory")}</th>
              <th className="text-left px-3 py-3">{t("pqColReason")}</th>
              <th className="text-left px-3 py-3">{t("pqColDeadline")}</th>
              <th className="text-right px-3 py-3">{t("pqColValue")}</th>
              <th className="text-right px-5 py-3">{t("pqColAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.slice(0, 8).map((task) => {
              const badge = kindLabels[task.kind] || { label: t("pqKindPrIntake"), color: "bg-blue-50 text-blue-700 border-blue-200" };
              return (
                <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={task.severity === "high" ? "text-rose-500" : task.severity === "medium" ? "text-amber-500" : "text-slate-400"}>
                        {task.kind.includes("risk") || task.kind.includes("overdue") ? <AlertTriangle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">{translateTitle(task.title)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-505 max-w-[220px] truncate">{translateReason(task.reason)}</td>
                  <td className="px-3 py-3.5">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {translateDueLabel(task.dueLabel)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-slate-700 font-bold">{formatVND(task.value)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="px-2.5 py-1.5 text-[10px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {t("pqActionReview")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(task.targetTab)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-white bg-slate-900 rounded-lg hover:bg-black transition-colors cursor-pointer"
                      >
                        {t("pqActionProcess")}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {tasks.slice(0, 8).map((task) => {
          const badge = kindLabels[task.kind] || { label: t("pqKindPrIntake"), color: "bg-blue-50 text-blue-700 border-blue-200" };
          return (
            <article key={task.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={task.severity === "high" ? "text-rose-600" : task.severity === "medium" ? "text-amber-600" : "text-slate-500"}>
                  {task.kind.includes("risk") || task.kind.includes("overdue") ? <AlertTriangle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{translateTitle(task.title)}</p>
                  <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <p className="text-xs text-slate-500 mt-1.5">{translateReason(task.reason)}</p>
                  <p className="text-[11px] text-slate-405 mt-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {translateDueLabel(task.dueLabel)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-700">{formatVND(task.value)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="px-2.5 py-1.5 text-[10px] font-bold text-slate-600 border border-slate-200 rounded-lg">{t("pqActionReview")}</button>
                  <button type="button" onClick={() => onNavigate(task.targetTab)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-white bg-slate-900 rounded-lg hover:bg-black">
                    {t("pqActionProcess")} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

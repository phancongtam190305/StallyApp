import React from "react";
import { AlertTriangle, BarChart3, CircleDollarSign, Clock } from "lucide-react";
import { DashboardMetrics } from "../../dashboardMetrics";
import MetricCard from "./MetricCard";

interface ExecutiveDashboardProps {
  metrics: DashboardMetrics;
  t: (key: any) => string;
}

export default function ExecutiveDashboard({ metrics, t }: ExecutiveDashboardProps) {
  const formatVnd = (value: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

  const labelMap: Record<string, string> = {
    intake: t("descIntake"),
    sourcing: t("descSourcing"),
    review: t("descNegotiation"),
    approval: t("descApproval"),
    fulfillment: t("descFulfillment")
  };

  return (
    <div className="space-y-5 animate-fade-slide-up" data-testid="executive-dashboard">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label={t("approvedSpend")} value={formatVnd(metrics.executive.approvedSpend)} subtitle={t("execApprovedSpendDesc")} icon={CircleDollarSign} tone="success" />
        <MetricCard label={t("slaHealth")} value={`${metrics.executive.overdueCaseCount} ${t("execOverdueSuffix")}`} subtitle={t("execSlaHealthDesc")} icon={Clock} tone={metrics.executive.overdueCaseCount > 0 ? "danger" : "neutral"} />
        <MetricCard label={t("riskExposure")} value={String(metrics.executive.riskCount)} subtitle={t("execRiskExposureDesc")} icon={AlertTriangle} tone={metrics.executive.riskCount > 0 ? "warning" : "neutral"} />
        <MetricCard label={t("pipelineSummary")} value={`${metrics.executive.pipeline.reduce((sum, item) => sum + item.count, 0)} ${t("execCasesSuffix")}`} subtitle={t("execPipelineMetricDesc")} icon={BarChart3} tone="info" />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 executive-shadow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{t("pipelineSummary")}</h2>
            <p className="text-xs text-slate-500 mt-1">{t("execPipelineDesc")}</p>
          </div>
        </div>
        <div className="space-y-3 mt-5">
          {metrics.executive.pipeline.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">{labelMap[item.id] || item.label}</span>
                <span className="font-mono text-slate-500">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, item.count * 16)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

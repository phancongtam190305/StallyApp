import React from "react";
import { AlertCircle, AlertTriangle, ClipboardCheck, Send } from "lucide-react";
import { DashboardMetrics, DashboardTask } from "../../dashboardMetrics";
import MetricCard from "./MetricCard";
import PriorityQueue from "./PriorityQueue";

interface OperatorDashboardProps {
  metrics: DashboardMetrics;
  onNavigate: (task: DashboardTask) => void;
  t: (key: any) => string;
}

export default function OperatorDashboard({ metrics, onNavigate, t }: OperatorDashboardProps) {
  const cards = [
    {
      label: t("priorityQueue"),
      value: metrics.operator.actionCount,
      subtitle: t("operatorPriorityQueueDesc"),
      icon: ClipboardCheck,
      tone: "info" as const,
    },
    {
      label: t("pendingRfq"),
      value: metrics.operator.pendingRfqCount,
      subtitle: t("operatorPendingRfqDesc"),
      icon: Send,
      tone: "info" as const,
    },
    {
      label: t("quoteReview"),
      value: metrics.operator.quoteReviewCount,
      subtitle: t("operatorQuoteReviewDesc"),
      icon: AlertTriangle,
      tone: metrics.operator.quoteReviewCount > 0 ? "warning" as const : "neutral" as const,
    },
    {
      label: t("overdueCases"),
      value: metrics.operator.overdueCaseCount,
      subtitle: t("operatorOverdueCasesDesc"),
      icon: AlertCircle,
      tone: metrics.operator.overdueCaseCount > 0 ? "danger" as const : "neutral" as const,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-slide-up" data-testid="operator-dashboard">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <React.Fragment key={card.label}>
            <MetricCard
              label={card.label}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              tone={card.tone}
            />
          </React.Fragment>
        ))}
      </section>

      <PriorityQueue tasks={metrics.operator.priorityQueue} onNavigate={onNavigate} t={t} />
    </div>
  );
}

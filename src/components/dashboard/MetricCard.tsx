import React from "react";

type MetricTone = "neutral" | "info" | "warning" | "danger" | "success";

const toneClass: Record<MetricTone, { icon: string; value: string }> = {
  neutral: {
    icon: "border-slate-200 bg-slate-50 text-slate-700",
    value: "text-slate-950",
  },
  info: {
    icon: "border-blue-200 bg-blue-50 text-blue-600",
    value: "text-slate-950",
  },
  warning: {
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    value: "text-slate-950",
  },
  danger: {
    icon: "border-rose-200 bg-rose-50 text-rose-700",
    value: "text-rose-700",
  },
  success: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    value: "text-emerald-700",
  },
};

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: MetricTone;
}

export default function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = "neutral",
}: MetricCardProps) {
  const classes = toneClass[tone];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 min-h-[112px] executive-shadow">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500 truncate">
            {label}
          </p>
          <p className={`text-3xl font-extrabold leading-none mt-3 tracking-tight ${classes.value}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] font-semibold text-slate-500 mt-2 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 ${classes.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

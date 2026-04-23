import type { AppEventType } from "@/lib/types";

const CONFIG: Record<
  AppEventType,
  { label: string; className: string }
> = {
  tool_call: {
    label: "Tool",
    className: "bg-sky-400/15 text-sky-300 border-sky-400/20",
  },
  transaction: {
    label: "Txn",
    className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
  },
  fraud_alert: {
    label: "Fraud",
    className: "bg-rose-400/15 text-rose-300 border-rose-400/20",
  },
  pin_verification: {
    label: "PIN",
    className: "bg-amber-400/15 text-amber-300 border-amber-400/20",
  },
  memory_operation: {
    label: "Memory",
    className: "bg-violet-400/15 text-violet-300 border-violet-400/20",
  },
  beneficiary: {
    label: "Payee",
    className: "bg-cyan-400/15 text-cyan-300 border-cyan-400/20",
  },
  limit_breach: {
    label: "Limit",
    className: "bg-orange-400/15 text-orange-300 border-orange-400/20",
  },
};

interface StatusBadgeProps {
  type: AppEventType;
}

export function StatusBadge({ type }: StatusBadgeProps) {
  const config = CONFIG[type] ?? {
    label: type,
    className: "bg-slate-400/15 text-slate-300 border-slate-400/20",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}
    >
      {config.label}
    </span>
  );
}

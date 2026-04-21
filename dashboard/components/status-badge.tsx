import type { AppEventType } from "@/lib/types";
import { formatEventType } from "@/lib/format";

const toneByType: Record<AppEventType, string> = {
  tool_call: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  fraud_alert: "border-rose-500/45 bg-rose-500/20 text-rose-100",
  transaction: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  pin_verification: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  memory_operation: "border-indigo-400/40 bg-indigo-400/10 text-indigo-100",
};

export function StatusBadge({ type }: { type: AppEventType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize ${toneByType[type]}`}
    >
      {formatEventType(type)}
    </span>
  );
}

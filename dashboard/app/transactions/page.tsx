"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTransactions } from "@/lib/api";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";
import { ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

interface TransferRow {
  id: string;
  timestamp: string;
  sender: string;
  receiver: string;
  amount: number;
  status: string;
  riskScore?: number;
  riskLevel?: string;
}

function toTransferRow(event: AppEvent): TransferRow | null {
  const action = event.details["action"];
  if (action !== "transfer" && action !== "transfer_initiated") return null;

  const receiver = event.details["receiverId"];
  const amount = event.details["amount"];
  const status = event.details["status"];
  const sender = event.details["senderId"];
  const riskScore = event.details["riskScore"];
  const riskLevel = event.details["riskLevel"];

  return {
    id: event.id,
    timestamp: event.timestamp,
    sender: typeof sender === "string" ? sender : event.userId,
    receiver: typeof receiver === "string" ? receiver : "-",
    amount: typeof amount === "number" ? amount : 0,
    status: typeof status === "string" ? status : "unknown",
    riskScore: typeof riskScore === "number" ? riskScore : undefined,
    riskLevel: typeof riskLevel === "string" ? riskLevel : undefined,
  };
}

function RiskBadge({ score, level }: { score?: number; level?: string }) {
  if (score === undefined) return <span className="text-slate-600">—</span>;

  const cls =
    level === "high"
      ? "bg-rose-400/15 text-rose-300"
      : level === "medium"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-emerald-400/15 text-emerald-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      <TrendingUp className="h-3 w-3" />
      {score}
    </span>
  );
}

export default function TransactionsPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchTransactions();
        if (!alive) return;
        setEvents(data);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load transactions");
      }
    };
    void load();
    const interval = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const rows = useMemo(
    () => events.map(toTransferRow).filter((r): r is TransferRow => r !== null),
    [events],
  );

  const totalVolume = rows
    .filter((r) => r.status === "success")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Payments</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Transactions</h1>
          <p className="mt-1 text-sm text-slate-400">
            All transfer requests, pending initiations, and completions with risk scores.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center">
            <p className="text-xs text-slate-500">Total rows</p>
            <p className="mt-1 font-heading text-xl font-bold text-white">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-center">
            <p className="text-xs text-slate-500">Settled volume</p>
            <p className="mt-1 font-heading text-xl font-bold text-emerald-300">
              {formatCurrency(totalVolume)}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="min-w-full text-sm">
          <thead className="border-b border-white/8 bg-slate-900/60">
            <tr>
              {["Time", "Sender", "Receiver", "Amount", "Risk", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                  No transactions yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
                      <span className="font-mono text-xs text-slate-200">{row.sender}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-mono text-xs text-slate-200">{row.receiver}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-heading font-semibold text-white">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge score={row.riskScore} level={row.riskLevel} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                        row.status === "success"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : row.status === "pending"
                            ? "bg-amber-400/15 text-amber-300"
                            : "bg-slate-400/15 text-slate-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

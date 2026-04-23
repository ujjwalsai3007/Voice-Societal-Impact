"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTransactions } from "@/lib/api";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

interface RiskRow {
  id: string;
  timestamp: string;
  userId: string;
  receiverId: string;
  amount: number;
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
  newPayeeWarning: boolean;
}

function toRiskRow(event: AppEvent): RiskRow | null {
  if (event.details["action"] !== "transfer_initiated") return null;
  const riskScore = event.details["riskScore"];
  if (typeof riskScore !== "number") return null;

  const riskLevel = event.details["riskLevel"];
  const receiverId = event.details["receiverId"];
  const amount = event.details["amount"];
  const riskFactors = event.details["riskFactors"];
  const newPayeeWarning = event.details["newPayeeWarning"];

  return {
    id: event.id,
    timestamp: event.timestamp,
    userId: event.userId,
    receiverId: typeof receiverId === "string" ? receiverId : "—",
    amount: typeof amount === "number" ? amount : 0,
    riskScore,
    riskLevel: typeof riskLevel === "string" ? riskLevel : "unknown",
    riskFactors: Array.isArray(riskFactors)
      ? (riskFactors as string[])
      : [],
    newPayeeWarning: newPayeeWarning === true,
  };
}

function RiskIcon({ level }: { level: string }) {
  if (level === "high")
    return <TrendingUp className="h-4 w-4 text-rose-400" />;
  if (level === "medium")
    return <Minus className="h-4 w-4 text-amber-400" />;
  return <TrendingDown className="h-4 w-4 text-emerald-400" />;
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color =
    score >= 60 ? "bg-rose-400" : score >= 30 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-slate-400">{score}</span>
    </div>
  );
}

export default function RiskPage() {
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
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    };
    void load();
    const interval = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const rows = useMemo(
    () => events.map(toRiskRow).filter((r): r is RiskRow => r !== null),
    [events],
  );

  const highCount = rows.filter((r) => r.riskLevel === "high").length;
  const medCount = rows.filter((r) => r.riskLevel === "medium").length;
  const avgScore =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.riskScore, 0) / rows.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Intelligence</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Risk Engine v2</h1>
          <p className="mt-1 text-sm text-slate-400">
            Per-transfer risk scores based on new payee, high value, velocity, and PIN failure streak.
          </p>
        </div>
      </div>

      {/* Score legend */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Info className="h-3.5 w-3.5 text-slate-500" />
          <span>Score breakdown:</span>
          <span className="rounded-md bg-violet-400/10 px-2 py-0.5 text-violet-300">New payee +30</span>
          <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-amber-300">High value +20</span>
          <span className="rounded-md bg-orange-400/10 px-2 py-0.5 text-orange-300">Rapid retries +25</span>
          <span className="rounded-md bg-rose-400/10 px-2 py-0.5 text-rose-300">PIN failures +25</span>
          <span className="ml-auto text-slate-500">
            ≥60 = High (step-up) · 30–59 = Medium · &lt;30 = Low
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-4">
          <p className="text-xs text-slate-500">Average risk score</p>
          <p className="mt-2 font-heading text-3xl font-bold text-emerald-300">{avgScore}</p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 p-4">
          <p className="text-xs text-slate-500">Medium risk transfers</p>
          <p className="mt-2 font-heading text-3xl font-bold text-amber-300">{medCount}</p>
        </div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 p-4">
          <p className="text-xs text-slate-500">High risk (step-up required)</p>
          <p className="mt-2 font-heading text-3xl font-bold text-rose-300">{highCount}</p>
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
              {["Time", "User", "Receiver", "Amount", "Risk Score", "Level", "Factors"].map((h) => (
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
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                  No risk data yet. Initiate a transfer to see scores.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {row.userId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-200">{row.receiverId}</span>
                      {row.newPayeeWarning && (
                        <span className="rounded-md bg-violet-400/15 px-1.5 py-0.5 text-[10px] text-violet-300">
                          new
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-heading font-semibold text-white">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBar score={row.riskScore} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <RiskIcon level={row.riskLevel} />
                      <span className={`text-xs capitalize font-medium ${
                        row.riskLevel === "high"
                          ? "text-rose-300"
                          : row.riskLevel === "medium"
                            ? "text-amber-300"
                            : "text-emerald-300"
                      }`}>
                        {row.riskLevel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.riskFactors.length === 0 ? (
                        <span className="text-xs text-slate-600">none</span>
                      ) : (
                        row.riskFactors.map((f) => (
                          <span
                            key={f}
                            className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {f.replace(/_/g, " ")}
                          </span>
                        ))
                      )}
                    </div>
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

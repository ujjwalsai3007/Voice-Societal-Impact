"use client";

import { useEffect, useState } from "react";
import { fetchLimits } from "@/lib/api";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import type { AppEvent, LimitUsage } from "@/lib/types";
import { Gauge, AlertTriangle } from "lucide-react";

function UsageBar({ pct, label }: { pct: number; label: string }) {
  const color =
    pct >= 90 ? "bg-rose-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function LimitsPage() {
  const [usage, setUsage] = useState<Record<string, LimitUsage>>({});
  const [breaches, setBreaches] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchLimits();
        if (!alive) return;
        setUsage(data.usage);
        setBreaches(data.breaches);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load limits data");
      }
    };
    void load();
    const interval = window.setInterval(load, 3000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const userIds = Object.keys(usage);
  const totalBreaches = breaches.length;
  const perTxBreaches = breaches.filter(
    (e) => e.details["limitType"] === "per_transaction",
  ).length;
  const dailyBreaches = breaches.filter(
    (e) => e.details["limitType"] === "daily_total",
  ).length;
  const beneficiaryBreaches = breaches.filter(
    (e) => e.details["limitType"] === "per_beneficiary",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Controls</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Transaction Limits</h1>
          <p className="mt-1 text-sm text-slate-400">
            Per-transaction cap, daily rolling total, and per-beneficiary daily spend limit.
          </p>
        </div>
      </div>

      {/* Limit rules info */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Per Transaction</p>
          <p className="mt-2 font-heading text-2xl font-bold text-white">₹10,000</p>
          <p className="mt-1 text-xs text-slate-500">Max single transfer amount</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Daily Total</p>
          <p className="mt-2 font-heading text-2xl font-bold text-white">₹25,000</p>
          <p className="mt-1 text-xs text-slate-500">Rolling 24-hour window</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Per Beneficiary</p>
          <p className="mt-2 font-heading text-2xl font-bold text-white">₹15,000</p>
          <p className="mt-1 text-xs text-slate-500">Max daily send to one payee</p>
        </div>
      </div>

      {/* Breach summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={`rounded-xl border p-4 ${totalBreaches > 0 ? "border-rose-400/20 bg-rose-500/8" : "border-white/8 bg-white/3"}`}>
          <p className="text-xs text-slate-500">Total breaches</p>
          <p className={`mt-2 font-heading text-3xl font-bold ${totalBreaches > 0 ? "text-rose-300" : "text-slate-400"}`}>
            {totalBreaches}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs text-slate-500">Per-tx limit hit</p>
          <p className="mt-2 font-heading text-3xl font-bold text-amber-300">{perTxBreaches}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs text-slate-500">Daily limit hit</p>
          <p className="mt-2 font-heading text-3xl font-bold text-amber-300">{dailyBreaches}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="text-xs text-slate-500">Per-payee limit hit</p>
          <p className="mt-2 font-heading text-3xl font-bold text-amber-300">{beneficiaryBreaches}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* Per-user usage */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Daily Usage by User
        </h2>
        {userIds.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center">
            <Gauge className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="font-heading text-lg font-semibold text-slate-400">
              No usage tracked yet
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Completed transfers will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {userIds.map((userId) => {
              const u = usage[userId];
              if (!u) return null;
              return (
                <div
                  key={userId}
                  className="rounded-xl border border-white/8 bg-slate-900/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">
                      {userId}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatCurrency(u.dailyUsed)} used
                    </span>
                  </div>
                  <UsageBar pct={u.usagePercent} label={`Daily: ${formatCurrency(u.dailyUsed)} / ${formatCurrency(u.dailyLimit)}`} />
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">
                      Remaining: <span className="text-emerald-300">{formatCurrency(u.dailyRemaining)}</span>
                    </span>
                    <span className="text-slate-500">
                      Per-tx max: <span className="text-slate-300">{formatCurrency(u.perTxLimit)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breach log */}
      {breaches.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Breach Log
          </h2>
          <div className="space-y-2">
            {breaches.slice(0, 30).map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-400/20 bg-orange-500/8 px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  <span className="font-mono text-xs text-slate-200">{b.userId}</span>
                  <span className="rounded-md bg-orange-400/15 px-1.5 py-0.5 text-[10px] text-orange-300 capitalize">
                    {String(b.details["limitType"] ?? "").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    {String(b.details["reason"] ?? "")}
                  </span>
                </div>
                <time className="font-mono text-xs text-slate-600">
                  {formatTimestamp(b.timestamp)}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

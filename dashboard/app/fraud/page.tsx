"use client";

import { useEffect, useState } from "react";
import { fetchFraudAlerts } from "@/lib/api";
import { compactDetails, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";
import { ShieldAlert, Clock } from "lucide-react";

export default function FraudPage() {
  const [alerts, setAlerts] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchFraudAlerts();
        if (!alive) return;
        setAlerts(data);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load fraud alerts");
      }
    };
    void load();
    const interval = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Security</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Fraud Alerts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Velocity-based blocks triggered when a user exceeds 3 transactions in 5 minutes.
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
          alerts.length > 0
            ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
            : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
        }`}>
          <ShieldAlert className="h-3.5 w-3.5" />
          {alerts.length} alerts detected
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-emerald-400/40" />
          <p className="font-heading text-lg font-semibold text-emerald-300">
            No fraud blocks detected
          </p>
          <p className="mt-1 text-sm text-slate-500">
            The system is actively monitoring for velocity anomalies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20">
                    <ShieldAlert className="h-4 w-4 text-rose-300" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-rose-100">
                      Velocity block —{" "}
                      <span className="font-mono">{alert.userId}</span>
                    </p>
                    <p className="text-xs text-rose-300/70">
                      Transaction rejected by fraud engine
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-rose-300/60">
                  <Clock className="h-3 w-3" />
                  <time>{formatTimestamp(alert.timestamp)}</time>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-rose-950/40 px-3 py-2 text-xs text-rose-200/80">
                {compactDetails(alert.details)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

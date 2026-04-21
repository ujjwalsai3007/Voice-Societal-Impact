"use client";

import { useEffect, useState } from "react";
import { fetchFraudAlerts } from "@/lib/api";
import { compactDetails, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";

export default function FraudPage() {
  const [alerts, setAlerts] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await fetchFraudAlerts();
        if (!alive) {
          return;
        }
        setAlerts(data);
        setError("");
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load fraud alerts");
      }
    };

    void load();
    const interval = window.setInterval(load, 2000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-2xl font-semibold text-white">Fraud Alerts</h2>
        <p className="mt-1 text-sm text-slate-300">
          Velocity-based blocks are highlighted below with timestamps and reason.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            No fraud blocks detected yet.
          </div>
        ) : (
          alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-rose-100">
                  Blocked user: <span className="font-mono">{alert.userId}</span>
                </p>
                <time className="font-mono text-xs text-rose-200/80">
                  {formatTimestamp(alert.timestamp)}
                </time>
              </div>
              <p className="mt-2 text-sm text-rose-50">
                {compactDetails(alert.details)}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

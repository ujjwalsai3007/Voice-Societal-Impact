"use client";

import { useEffect, useState } from "react";
import { fetchEvents, fetchStats } from "@/lib/api";
import type { AppEvent, StatsResponse } from "@/lib/types";
import { compactDetails, formatCurrency, formatTimestamp } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

const EMPTY_STATS: StatsResponse = {
  totalTransactions: 0,
  blockedCount: 0,
  activeUsers: 0,
  totalVolume: 0,
};

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse>(EMPTY_STATS);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [statsData, eventData] = await Promise.all([
          fetchStats(),
          fetchEvents(12),
        ]);

        if (!alive) {
          return;
        }

        setStats(statsData);
        setEvents(eventData);
        setError("");
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load data");
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-white md:text-3xl">
            Command Center
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Near real-time view of payment activity, safety controls, and tool orchestration.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
          Live polling every 2s
        </span>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Total Transactions</p>
          <p className="mt-3 font-heading text-3xl text-white">{stats.totalTransactions}</p>
        </article>
        <article className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-200">Blocked Count</p>
          <p className="mt-3 font-heading text-3xl text-white">{stats.blockedCount}</p>
        </article>
        <article className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Active Users</p>
          <p className="mt-3 font-heading text-3xl text-white">{stats.activeUsers}</p>
        </article>
        <article className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Total Volume</p>
          <p className="mt-3 font-heading text-3xl text-white">{formatCurrency(stats.totalVolume)}</p>
        </article>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <h3 className="font-heading text-lg text-white">Recent Event Feed</h3>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No events yet.</p>
          ) : (
            events.map((event) => (
              <article
                key={event.id}
                className="rounded-lg border border-white/10 bg-slate-950/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge type={event.type} />
                    <span className="text-xs text-slate-300">{event.userId}</span>
                  </div>
                  <time className="font-mono text-xs text-slate-400">
                    {formatTimestamp(event.timestamp)}
                  </time>
                </div>
                <p className="mt-2 text-sm text-slate-200">{compactDetails(event.details)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { fetchEvents } from "@/lib/api";
import { compactDetails, formatTimestamp } from "@/lib/format";
import type { AppEvent, AppEventType } from "@/lib/types";

const EVENT_TYPES: { value: AppEventType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "transaction", label: "Transaction" },
  { value: "fraud_alert", label: "Fraud" },
  { value: "pin_verification", label: "PIN" },
  { value: "beneficiary", label: "Beneficiary" },
  { value: "limit_breach", label: "Limit" },
  { value: "memory_operation", label: "Memory" },
  { value: "tool_call", label: "Tool Call" },
];

export default function EventsPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [filter, setFilter] = useState<AppEventType | "all">("all");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchEvents(500);
        if (!alive) return;
        setEvents(data);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load events");
      }
    };
    void load();
    const interval = window.setInterval(load, 2000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const filtered =
    filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Audit</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Event Stream</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tamper-resistant log of every agent decision — tool calls, PIN checks, fraud blocks, and memory ops.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {events.length} events · auto-refresh 2s
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === value
                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                : "bg-white/5 text-slate-400 hover:bg-white/8 hover:text-slate-200"
            }`}
          >
            {label}
            {value !== "all" && (
              <span className="ml-1.5 text-slate-500">
                {events.filter((e) => e.type === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/3 p-8 text-center text-sm text-slate-500">
            No events match the current filter.
          </div>
        ) : (
          filtered.map((event) => (
            <article
              key={event.id}
              className="rounded-xl border border-white/8 bg-slate-900/50 px-4 py-3 transition-colors hover:bg-slate-900/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StatusBadge type={event.type} />
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
                    {event.userId}
                  </span>
                  <span className="font-mono text-xs text-slate-600">{event.id}</span>
                </div>
                <time className="font-mono text-xs text-slate-500">
                  {formatTimestamp(event.timestamp)}
                </time>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {compactDetails(event.details)}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

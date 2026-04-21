"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { fetchEvents } from "@/lib/api";
import { compactDetails, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await fetchEvents(200);
        if (!alive) {
          return;
        }
        setEvents(data);
        setError("");
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load events");
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-white">
            Event Stream
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Real-time log of tool calls, memory actions, PIN verifications, and risk controls.
          </p>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
          Auto-refresh: 2s
        </span>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No events yet.</p>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge type={event.type} />
                  <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">
                    {event.userId}
                  </span>
                </div>
                <time className="font-mono text-xs text-slate-400">
                  {formatTimestamp(event.timestamp)}
                </time>
              </div>
              <p className="mt-3 text-sm text-slate-200">
                {compactDetails(event.details)}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

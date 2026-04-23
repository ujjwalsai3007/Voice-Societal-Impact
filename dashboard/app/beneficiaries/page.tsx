"use client";

import { useEffect, useState } from "react";
import { fetchBeneficiaries } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import type { AppEvent, BeneficiaryRecord } from "@/lib/types";
import { UserCheck, UserX, Users, Plus } from "lucide-react";

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRecord[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchBeneficiaries();
        if (!alive) return;
        setBeneficiaries(data.beneficiaries);
        setEvents(data.events);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load beneficiaries");
      }
    };
    void load();
    const interval = window.setInterval(load, 3000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const addedCount = events.filter(
    (e) => e.details["action"] === "beneficiary_added",
  ).length;
  const removedCount = events.filter(
    (e) => e.details["action"] === "beneficiary_removed",
  ).length;

  const grouped = beneficiaries.reduce<Record<string, BeneficiaryRecord[]>>(
    (acc, b) => {
      if (!acc[b.userId]) acc[b.userId] = [];
      acc[b.userId].push(b);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Safety</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-white">Beneficiary Registry</h1>
          <p className="mt-1 text-sm text-slate-400">
            Trusted payees per user. New-payee warnings are shown on first transfer;
            beneficiaries are auto-added after a confirmed transfer.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-300">
          How it works
        </h3>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-300 font-bold text-[10px]">1</span>
            <span>User sends to someone for the first time → <strong className="text-slate-300">new-payee warning</strong> + extra confirmation required</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-300 font-bold text-[10px]">2</span>
            <span>User confirms with PIN → transfer succeeds → payee is <strong className="text-slate-300">auto-added as beneficiary</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-300 font-bold text-[10px]">3</span>
            <span>Future transfers to the same payee → <strong className="text-slate-300">no warning</strong>, lower risk score</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" />
            <p className="text-xs text-slate-500">Total beneficiaries</p>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-cyan-300">
            {beneficiaries.length}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-300" />
            <p className="text-xs text-slate-500">Added</p>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-emerald-300">
            {addedCount}
          </p>
        </div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/8 p-4">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-rose-300" />
            <p className="text-xs text-slate-500">Removed</p>
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-rose-300">
            {removedCount}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* Grouped by user */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-10 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="font-heading text-lg font-semibold text-slate-400">
            No beneficiaries yet
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Complete a transfer to automatically register the first beneficiary.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([userId, list]) => (
            <div key={userId} className="rounded-2xl border border-white/8 bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15">
                  <Users className="h-3.5 w-3.5 text-cyan-300" />
                </span>
                <span className="font-mono text-sm font-semibold text-white">{userId}</span>
                <span className="ml-auto rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-300">
                  {list.length} payees
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => (
                  <div
                    key={b.beneficiaryId}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-mono text-xs text-slate-200">
                        {b.beneficiaryId}
                      </span>
                    </div>
                    <time className="text-[10px] text-slate-600">
                      {formatTimestamp(b.addedAt)}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent beneficiary events */}
      {events.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {events.slice(0, 20).map((e) => {
              const action = String(e.details["action"] ?? "");
              const isAdd = action === "beneficiary_added";
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {isAdd ? (
                      <Plus className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <UserX className="h-3.5 w-3.5 text-rose-400" />
                    )}
                    <span className="font-mono text-xs text-slate-300">
                      {e.userId}
                    </span>
                    <span className={`text-xs ${isAdd ? "text-emerald-400" : "text-rose-400"}`}>
                      {isAdd ? "added" : "removed"}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {String(e.details["beneficiaryId"] ?? "")}
                    </span>
                  </div>
                  <time className="font-mono text-xs text-slate-600">
                    {formatTimestamp(e.timestamp)}
                  </time>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

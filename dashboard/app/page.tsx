"use client";

import { useEffect, useState } from "react";
import { fetchEvents, fetchStats } from "@/lib/api";
import type { AppEvent, StatsResponse } from "@/lib/types";
import { compactDetails, formatCurrency, formatTimestamp } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import {
  ArrowUpRight,
  ShieldCheck,
  Users,
  TrendingUp,
  Zap,
  AlertTriangle,
  KeyRound,
  BarChart3,
  Gauge,
  UserCheck,
} from "lucide-react";

const EMPTY_STATS: StatsResponse = {
  totalTransactions: 0,
  blockedCount: 0,
  activeUsers: 0,
  totalVolume: 0,
  transferInitiatedCount: 0,
  pinVerifiedCount: 0,
  pinFailedCount: 0,
  highValueChallengeCount: 0,
  highValueConfirmedCount: 0,
  totalBeneficiaries: 0,
  limitBreaches: 0,
  avgRiskScore: 0,
  highRiskTransfers: 0,
  newPayeeWarnings: 0,
};

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  border: string;
  bg: string;
}

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
          fetchEvents(10),
        ]);
        if (!alive) return;
        setStats(statsData);
        setEvents(eventData);
        setError("");
      } catch (err) {
        if (!alive) return;
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

  const statCards: StatCard[] = [
    {
      label: "Transactions",
      value: stats.totalTransactions,
      sub: `${stats.transferInitiatedCount} initiated`,
      icon: ArrowUpRight,
      color: "text-emerald-300",
      border: "border-emerald-400/20",
      bg: "bg-emerald-500/8",
    },
    {
      label: "Total Volume",
      value: formatCurrency(stats.totalVolume),
      sub: "Settled transfers",
      icon: BarChart3,
      color: "text-indigo-300",
      border: "border-indigo-400/20",
      bg: "bg-indigo-500/8",
    },
    {
      label: "Active Users",
      value: stats.activeUsers,
      sub: "Unique callers",
      icon: Users,
      color: "text-cyan-300",
      border: "border-cyan-400/20",
      bg: "bg-cyan-500/8",
    },
    {
      label: "Fraud Blocks",
      value: stats.blockedCount,
      sub: `${stats.limitBreaches} limit breaches`,
      icon: ShieldCheck,
      color: "text-rose-300",
      border: "border-rose-400/20",
      bg: "bg-rose-500/8",
    },
    {
      label: "Avg Risk Score",
      value: stats.avgRiskScore,
      sub: `${stats.highRiskTransfers} high-risk transfers`,
      icon: TrendingUp,
      color: "text-amber-300",
      border: "border-amber-400/20",
      bg: "bg-amber-500/8",
    },
    {
      label: "PIN Verified",
      value: stats.pinVerifiedCount,
      sub: `${stats.pinFailedCount} failures`,
      icon: KeyRound,
      color: "text-sky-300",
      border: "border-sky-400/20",
      bg: "bg-sky-500/8",
    },
    {
      label: "Beneficiaries",
      value: stats.totalBeneficiaries,
      sub: `${stats.newPayeeWarnings} new-payee warnings`,
      icon: UserCheck,
      color: "text-violet-300",
      border: "border-violet-400/20",
      bg: "bg-violet-500/8",
    },
    {
      label: "High-Value",
      value: stats.highValueConfirmedCount,
      sub: `${stats.highValueChallengeCount} challenged`,
      icon: Zap,
      color: "text-yellow-300",
      border: "border-yellow-400/20",
      bg: "bg-yellow-500/8",
    },
    {
      label: "Limit Breaches",
      value: stats.limitBreaches,
      sub: "Daily / per-tx / per-payee",
      icon: Gauge,
      color: "text-orange-300",
      border: "border-orange-400/20",
      bg: "bg-orange-500/8",
    },
    {
      label: "New Payee Warnings",
      value: stats.newPayeeWarnings,
      sub: "Extra confirmation required",
      icon: AlertTriangle,
      color: "text-pink-300",
      border: "border-pink-400/20",
      bg: "bg-pink-500/8",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/40 px-6 py-10 md:px-10 md:py-14">
        <div className="absolute right-0 top-0 -z-10 h-64 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-20 -z-10 h-48 w-64 rounded-full bg-indigo-500/8 blur-3xl" />
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Polling every 2 seconds
          </div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
            Voice Payment <span className="text-primary">Intelligence</span>
          </h1>
          <p className="mt-3 text-base text-slate-300 md:text-lg">
            Real-time telemetry for every AI agent decision — from PIN verification
            to fraud detection, risk scoring, and beneficiary safety checks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Velocity fraud detection
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Risk engine v2
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-violet-400" /> Beneficiary safety
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              <Gauge className="h-3.5 w-3.5 text-orange-400" /> Transaction limits
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error} — is the backend running at localhost:3000?
        </div>
      ) : null}

      {/* KPI grid */}
      <section>
        <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-widest text-slate-400">
          Platform Metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className={`rounded-xl border ${card.border} ${card.bg} p-4 transition-colors hover:bg-white/5`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs text-slate-400">{card.label}</p>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className={`mt-3 font-heading text-2xl font-bold ${card.color}`}>
                  {card.value}
                </p>
                {card.sub && (
                  <p className="mt-1 text-[11px] text-slate-500">{card.sub}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Live event feed */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-400">
            Live Event Feed
          </h2>
          <a href="/events" className="text-xs text-primary hover:underline">
            View all →
          </a>
        </div>
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/3 p-6 text-center text-sm text-slate-500">
              No events yet. Start a voice call to see live data appear here.
            </div>
          ) : (
            events.map((event) => (
              <article
                key={event.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/8 bg-slate-900/50 px-4 py-3 transition-colors hover:bg-slate-900/80"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge type={event.type} />
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
                    {event.userId}
                  </span>
                  <span className="text-sm text-slate-300">
                    {compactDetails(event.details)}
                  </span>
                </div>
                <time className="font-mono text-xs text-slate-500">
                  {formatTimestamp(event.timestamp)}
                </time>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

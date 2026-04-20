"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  LayoutDashboard,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Stats",
    icon: LayoutDashboard,
  },
  {
    href: "/events",
    label: "Events",
    icon: Activity,
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
  },
  {
    href: "/fraud",
    label: "Fraud",
    icon: ShieldAlert,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(30,64,175,0.25),transparent_60%),radial-gradient(1000px_500px_at_100%_10%,rgba(22,163,74,0.15),transparent_60%),linear-gradient(160deg,#05090f_0%,#0a1220_45%,#0f1a2e_100%)]" />
      <div className="mx-auto flex w-full max-w-[1440px] px-4 py-4 md:px-6 md:py-6">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur md:flex md:flex-col">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">VoicePay</p>
            <h1 className="mt-2 font-heading text-2xl font-semibold text-white">
              Operations
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Live telemetry for agent calls, payments, fraud alerts, and memory operations.
            </p>
          </div>

          <nav className="mt-10 flex flex-col gap-2">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    active
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-xs text-cyan-100">
            Polling interval: 2s
          </div>
        </aside>

        <main className="w-full md:pl-6">
          <header className="mb-5 rounded-2xl border border-white/10 bg-slate-900/70 p-3 backdrop-blur md:hidden">
            <div className="grid grid-cols-4 gap-2">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] ${
                      active ? "bg-emerald-400/15 text-emerald-100" : "text-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur md:p-6">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}

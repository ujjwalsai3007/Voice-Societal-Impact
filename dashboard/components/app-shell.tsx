"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  LayoutDashboard,
  ShieldAlert,
  Users,
  Gauge,
  TrendingUp,
  Mic,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/fraud", label: "Fraud", icon: ShieldAlert },
  { href: "/risk", label: "Risk", icon: TrendingUp },
  { href: "/beneficiaries", label: "Beneficiaries", icon: Users },
  { href: "/limits", label: "Limits", icon: Gauge },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(1400px_700px_at_10%_-10%,rgba(30,64,175,0.18),transparent_55%),radial-gradient(800px_600px_at_90%_80%,rgba(22,163,74,0.1),transparent_60%),linear-gradient(160deg,#03060e_0%,#06101e_55%,#0a1628_100%)]" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40">
              <Mic className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="font-heading text-sm font-semibold text-white">
              VoicePay<span className="text-primary"> Ops</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-slate-400 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status pill + mobile toggle */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white md:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="border-t border-white/8 bg-background/95 px-4 py-3 md:hidden">
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-slate-400 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-6">
        {children}
      </main>
    </div>
  );
}

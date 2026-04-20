"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTransactions } from "@/lib/api";
import { formatCurrency, formatTimestamp } from "@/lib/format";
import type { AppEvent } from "@/lib/types";

interface TransferRow {
  id: string;
  timestamp: string;
  sender: string;
  receiver: string;
  amount: number;
  status: string;
}

function toTransferRow(event: AppEvent): TransferRow | null {
  const action = event.details["action"];
  if (action !== "transfer" && action !== "transfer_initiated") {
    return null;
  }

  const receiver = event.details["receiverId"];
  const amount = event.details["amount"];
  const status = event.details["status"];
  const sender = event.details["senderId"];

  return {
    id: event.id,
    timestamp: event.timestamp,
    sender: typeof sender === "string" ? sender : event.userId,
    receiver: typeof receiver === "string" ? receiver : "-",
    amount: typeof amount === "number" ? amount : 0,
    status: typeof status === "string" ? status : "unknown",
  };
}

export default function TransactionsPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await fetchTransactions();
        if (!alive) {
          return;
        }
        setEvents(data);
        setError("");
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load transactions");
      }
    };

    void load();
    const interval = window.setInterval(load, 2000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const rows = useMemo(
    () => events.map(toTransferRow).filter((row): row is TransferRow => row !== null),
    [events],
  );

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-2xl font-semibold text-white">Transactions</h2>
        <p className="mt-1 text-sm text-slate-300">
          Table view of transfer requests and completions.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-[0.16em] text-slate-300">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Sender</th>
              <th className="px-4 py-3">Receiver</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-slate-950/65 text-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                  No transfer events available.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-4 py-3">{row.sender}</td>
                  <td className="px-4 py-3">{row.receiver}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-200">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs capitalize ${
                        row.status === "success"
                          ? "bg-emerald-400/20 text-emerald-100"
                          : "bg-amber-400/20 text-amber-100"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

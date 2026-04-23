import { logEvent } from "./event-store.js";

export const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
export const VELOCITY_MAX_TXN = 3;

const txTimestampsByUser = new Map<string, number[]>();

function filterWithinWindow(
  timestamps: number[],
  now: number,
): number[] {
  const cutoff = now - VELOCITY_WINDOW_MS;
  return timestamps.filter((ts) => ts >= cutoff);
}

export function recordTransaction(userId: string): void {
  const now = Date.now();
  const existing = txTimestampsByUser.get(userId) ?? [];
  const inWindow = filterWithinWindow(existing, now);
  inWindow.push(now);
  txTimestampsByUser.set(userId, inWindow);
}

export function checkVelocity(
  userId: string,
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const existing = txTimestampsByUser.get(userId) ?? [];
  const inWindow = filterWithinWindow(existing, now);
  txTimestampsByUser.set(userId, inWindow);

  if (inWindow.length >= VELOCITY_MAX_TXN - 1) {
    const reason =
      "Transaction blocked: too many transactions in a short period. Please wait a few minutes.";
    logEvent("fraud_alert", userId, {
      reason,
      windowMs: VELOCITY_WINDOW_MS,
      maxTransactions: VELOCITY_MAX_TXN,
      currentWindowCount: inWindow.length,
    });
    return {
      allowed: false,
      reason,
    };
  }

  return { allowed: true };
}

export function getVelocityCount(userId: string): number {
  const now = Date.now();
  const existing = txTimestampsByUser.get(userId) ?? [];
  return filterWithinWindow(existing, now).length;
}

export function resetFraudState(): void {
  txTimestampsByUser.clear();
}

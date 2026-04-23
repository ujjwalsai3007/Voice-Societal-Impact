import { logEvent } from "./event-store.js";

export const PER_TX_LIMIT = 10_000;
export const DAILY_LIMIT = 25_000;
export const PER_BENEFICIARY_DAILY_CAP = 15_000;

const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface TxRecord {
  amount: number;
  beneficiaryId: string;
  timestamp: number;
}

const dailyRecords = new Map<string, TxRecord[]>();

function getWindowRecords(userId: string, now: number): TxRecord[] {
  const records = dailyRecords.get(userId) ?? [];
  const cutoff = now - DAILY_WINDOW_MS;
  const filtered = records.filter((r) => r.timestamp >= cutoff);
  dailyRecords.set(userId, filtered);
  return filtered;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  limitType?: "per_transaction" | "daily_total" | "per_beneficiary";
  used?: number;
  limit?: number;
}

export function checkLimits(
  userId: string,
  amount: number,
  beneficiaryId: string,
): LimitCheckResult {
  if (amount > PER_TX_LIMIT) {
    const result: LimitCheckResult = {
      allowed: false,
      reason: `Single transfer of ₹${amount.toLocaleString("en-IN")} exceeds the per-transaction limit of ₹${PER_TX_LIMIT.toLocaleString("en-IN")}.`,
      limitType: "per_transaction",
      used: amount,
      limit: PER_TX_LIMIT,
    };
    logEvent("limit_breach", userId, {
      ...result,
      beneficiaryId,
    });
    return result;
  }

  const now = Date.now();
  const records = getWindowRecords(userId, now);
  const dailyUsed = records.reduce((sum, r) => sum + r.amount, 0);

  if (dailyUsed + amount > DAILY_LIMIT) {
    const result: LimitCheckResult = {
      allowed: false,
      reason: `Daily transfer limit of ₹${DAILY_LIMIT.toLocaleString("en-IN")} would be exceeded. You have used ₹${dailyUsed.toLocaleString("en-IN")} today.`,
      limitType: "daily_total",
      used: dailyUsed,
      limit: DAILY_LIMIT,
    };
    logEvent("limit_breach", userId, {
      ...result,
      beneficiaryId,
    });
    return result;
  }

  const beneficiaryUsed = records
    .filter((r) => r.beneficiaryId === beneficiaryId)
    .reduce((sum, r) => sum + r.amount, 0);

  if (beneficiaryUsed + amount > PER_BENEFICIARY_DAILY_CAP) {
    const result: LimitCheckResult = {
      allowed: false,
      reason: `Daily cap of ₹${PER_BENEFICIARY_DAILY_CAP.toLocaleString("en-IN")} to ${beneficiaryId} would be exceeded. You have already sent ₹${beneficiaryUsed.toLocaleString("en-IN")} to them today.`,
      limitType: "per_beneficiary",
      used: beneficiaryUsed,
      limit: PER_BENEFICIARY_DAILY_CAP,
    };
    logEvent("limit_breach", userId, {
      ...result,
      beneficiaryId,
    });
    return result;
  }

  return { allowed: true };
}

export function recordLimitUsage(
  userId: string,
  amount: number,
  beneficiaryId: string,
): void {
  const now = Date.now();
  const records = getWindowRecords(userId, now);
  records.push({ amount, beneficiaryId, timestamp: now });
  dailyRecords.set(userId, records);
}

export interface LimitUsage {
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  perTxLimit: number;
  usagePercent: number;
}

export function getLimitUsage(userId: string): LimitUsage {
  const now = Date.now();
  const records = getWindowRecords(userId, now);
  const dailyUsed = records.reduce((sum, r) => sum + r.amount, 0);
  const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyUsed);
  return {
    dailyUsed,
    dailyLimit: DAILY_LIMIT,
    dailyRemaining,
    perTxLimit: PER_TX_LIMIT,
    usagePercent: Math.min(100, Math.round((dailyUsed / DAILY_LIMIT) * 100)),
  };
}

export function getAllLimitUsage(): Record<string, LimitUsage> {
  const result: Record<string, LimitUsage> = {};
  for (const userId of dailyRecords.keys()) {
    const usage = getLimitUsage(userId);
    if (usage.dailyUsed > 0) {
      result[userId] = usage;
    }
  }
  return result;
}

export function resetLimitsStore(): void {
  dailyRecords.clear();
}

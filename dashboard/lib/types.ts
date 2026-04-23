export type AppEventType =
  | "tool_call"
  | "fraud_alert"
  | "transaction"
  | "pin_verification"
  | "memory_operation"
  | "beneficiary"
  | "limit_breach";

export interface AppEvent {
  id: string;
  type: AppEventType;
  timestamp: string;
  userId: string;
  details: Record<string, unknown>;
}

export interface StatsResponse {
  totalTransactions: number;
  blockedCount: number;
  activeUsers: number;
  totalVolume: number;
  transferInitiatedCount: number;
  pinVerifiedCount: number;
  pinFailedCount: number;
  highValueChallengeCount: number;
  highValueConfirmedCount: number;
  totalBeneficiaries: number;
  limitBreaches: number;
  avgRiskScore: number;
  highRiskTransfers: number;
  newPayeeWarnings: number;
}

export interface BeneficiaryRecord {
  userId: string;
  beneficiaryId: string;
  addedAt: string;
}

export interface LimitUsage {
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  perTxLimit: number;
  usagePercent: number;
}

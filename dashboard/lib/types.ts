export type AppEventType =
  | "tool_call"
  | "fraud_alert"
  | "transaction"
  | "pin_verification"
  | "memory_operation";

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
}

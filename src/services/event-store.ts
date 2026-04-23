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

const events: AppEvent[] = [];
let eventCounter = 0;

export function logEvent(
  type: AppEventType,
  userId: string,
  details: Record<string, unknown> = {},
): AppEvent {
  eventCounter += 1;
  const event: AppEvent = {
    id: `evt-${eventCounter}`,
    type,
    timestamp: new Date().toISOString(),
    userId,
    details,
  };
  events.push(event);
  return event;
}

export function getEvents(limit?: number): AppEvent[] {
  const ordered = [...events].reverse();
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return ordered.slice(0, limit);
  }
  return ordered;
}

export function getTransactions(): AppEvent[] {
  return getEvents().filter((event) => event.type === "transaction");
}

export function getFraudAlerts(): AppEvent[] {
  return getEvents().filter((event) => event.type === "fraud_alert");
}

export function getLimitBreaches(): AppEvent[] {
  return getEvents().filter((event) => event.type === "limit_breach");
}

export function getBeneficiaryEvents(): AppEvent[] {
  return getEvents().filter((event) => event.type === "beneficiary");
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

export function getStats(): StatsResponse {
  const txEvents = getTransactions().filter(
    (e) => e.details["action"] === "transfer" && e.details["status"] === "success",
  );

  const initiatedEvents = getTransactions().filter(
    (e) => e.details["action"] === "transfer_initiated" && e.details["status"] === "pending",
  );

  const highValueChallengeEvents = getTransactions().filter(
    (e) =>
      e.details["action"] === "transfer_confirm" &&
      e.details["reason"] === "high_value_amount_mismatch",
  );

  const highValueConfirmedEvents = getTransactions().filter(
    (e) =>
      e.details["action"] === "transfer_high_value_confirmed" &&
      e.details["status"] === "success",
  );

  const pinEvents = getEvents().filter((e) => e.type === "pin_verification");
  const pinVerifiedEvents = pinEvents.filter((e) => e.details["status"] === "verified");
  const pinFailedEvents = pinEvents.filter((e) => {
    const status = e.details["status"];
    return status === "failed" || status === "invalid_format";
  });

  const activeUsers = new Set(
    events.map((e) => e.userId).filter((id) => id.length > 0),
  );

  const totalVolume = txEvents.reduce((sum, e) => {
    const amount = e.details["amount"];
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);

  const beneficiaryAddedEvents = getBeneficiaryEvents().filter(
    (e) => e.details["action"] === "beneficiary_added",
  );

  const riskScoreEvents = initiatedEvents.filter(
    (e) => typeof e.details["riskScore"] === "number",
  );

  const avgRiskScore =
    riskScoreEvents.length > 0
      ? Math.round(
          riskScoreEvents.reduce((sum, e) => sum + (e.details["riskScore"] as number), 0) /
            riskScoreEvents.length,
        )
      : 0;

  const highRiskTransfers = riskScoreEvents.filter(
    (e) => e.details["riskLevel"] === "high",
  ).length;

  const newPayeeWarnings = initiatedEvents.filter(
    (e) => e.details["newPayeeWarning"] === true,
  ).length;

  return {
    totalTransactions: txEvents.length,
    blockedCount: getFraudAlerts().length,
    activeUsers: activeUsers.size,
    totalVolume,
    transferInitiatedCount: initiatedEvents.length,
    pinVerifiedCount: pinVerifiedEvents.length,
    pinFailedCount: pinFailedEvents.length,
    highValueChallengeCount: highValueChallengeEvents.length,
    highValueConfirmedCount: highValueConfirmedEvents.length,
    totalBeneficiaries: beneficiaryAddedEvents.length,
    limitBreaches: getLimitBreaches().length,
    avgRiskScore,
    highRiskTransfers,
    newPayeeWarnings,
  };
}

export function resetEventStore(): void {
  events.length = 0;
  eventCounter = 0;
}

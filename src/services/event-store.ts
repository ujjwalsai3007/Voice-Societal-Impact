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

export function getStats(): {
  totalTransactions: number;
  blockedCount: number;
  activeUsers: number;
  totalVolume: number;
} {
  const txEvents = getTransactions().filter(
    (event) =>
      event.details["action"] === "transfer" &&
      event.details["status"] === "success",
  );

  const activeUsers = new Set(
    events.map((event) => event.userId).filter((userId) => userId.length > 0),
  );

  const totalVolume = txEvents.reduce((sum, event) => {
    const amount = event.details["amount"];
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);

  return {
    totalTransactions: txEvents.length,
    blockedCount: getFraudAlerts().length,
    activeUsers: activeUsers.size,
    totalVolume,
  };
}

export function resetEventStore(): void {
  events.length = 0;
  eventCounter = 0;
}

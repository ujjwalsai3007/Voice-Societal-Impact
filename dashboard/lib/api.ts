import type {
  AppEvent,
  BeneficiaryRecord,
  GeminiInsight,
  LimitUsage,
  StatsResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchEvents(limit?: number): Promise<AppEvent[]> {
  const search = typeof limit === "number" ? `?limit=${limit}` : "";
  const data = await fetchJson<{ events: AppEvent[] }>(`/api/events${search}`);
  return data.events;
}

export async function fetchTransactions(): Promise<AppEvent[]> {
  const data = await fetchJson<{ transactions: AppEvent[] }>("/api/transactions");
  return data.transactions;
}

export async function fetchFraudAlerts(): Promise<AppEvent[]> {
  const data = await fetchJson<{ fraudAlerts: AppEvent[] }>("/api/fraud-alerts");
  return data.fraudAlerts;
}

export async function fetchStats(): Promise<StatsResponse> {
  return fetchJson<StatsResponse>("/api/stats");
}

export async function fetchBeneficiaries(): Promise<{
  beneficiaries: BeneficiaryRecord[];
  events: AppEvent[];
}> {
  return fetchJson<{ beneficiaries: BeneficiaryRecord[]; events: AppEvent[] }>(
    "/api/beneficiaries",
  );
}

export async function fetchLimits(): Promise<{
  usage: Record<string, LimitUsage>;
  breaches: AppEvent[];
}> {
  return fetchJson<{ usage: Record<string, LimitUsage>; breaches: AppEvent[] }>(
    "/api/limits",
  );
}

export async function fetchInsights(): Promise<GeminiInsight> {
  const data = await fetchJson<{ insights: GeminiInsight }>("/api/insights");
  return data.insights;
}

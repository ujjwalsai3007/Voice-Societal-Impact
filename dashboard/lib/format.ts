import type { AppEventType } from "./types";

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

export function formatCurrency(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN").format(amount)}`;
}

export function formatEventType(type: AppEventType): string {
  return type.replace(/_/g, " ");
}

export function compactDetails(details: Record<string, unknown>): string {
  const pairs = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return pairs.length > 0 ? pairs.join(" • ") : "No details";
}

import { describe, it, expect, beforeEach } from "vitest";

describe("Hono Server (src/index.ts)", () => {
  it("should export a Hono app instance", async () => {
    const { app } = await import("../src/index.js");
    expect(app).toBeDefined();
  });

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const { app } = await import("../src/index.js");
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("status", "ok");
    });

    it("should include a timestamp in the health response", async () => {
      const { app } = await import("../src/index.js");
      const res = await app.request("/health");
      const body = await res.json();
      expect(body).toHaveProperty("timestamp");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("Latency middleware", () => {
    it("should include an X-Response-Time header on responses", async () => {
      const { app } = await import("../src/index.js");
      const res = await app.request("/health");
      const responseTime = res.headers.get("X-Response-Time");
      expect(responseTime).toBeDefined();
      expect(responseTime).toMatch(/^\d+ms$/);
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const { app } = await import("../src/index.js");
      const res = await app.request("/nonexistent-route");
      expect(res.status).toBe(404);
    });
  });

  describe("Event API routes", () => {
    beforeEach(async () => {
      const { resetEventStore } = await import("../src/services/event-store.js");
      resetEventStore();
    });

    it("should return events and respect the limit query", async () => {
      const { logEvent } = await import("../src/services/event-store.js");
      logEvent("transaction", "u1", { action: "transfer", status: "success", amount: 100 });
      logEvent("fraud_alert", "u2", { reason: "velocity" });

      const { app } = await import("../src/index.js");
      const res = await app.request("/api/events?limit=1");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { events: Array<{ type: string }> };
      expect(body.events).toHaveLength(1);
      expect(body.events[0]!.type).toBe("fraud_alert");
    });

    it("should expose transaction and fraud alert filtered APIs", async () => {
      const { logEvent } = await import("../src/services/event-store.js");
      logEvent("transaction", "u1", { action: "transfer", status: "success", amount: 500 });
      logEvent("fraud_alert", "u1", { reason: "velocity" });

      const { app } = await import("../src/index.js");

      const txRes = await app.request("/api/transactions");
      const txBody = (await txRes.json()) as { transactions: Array<{ type: string }> };
      expect(txRes.status).toBe(200);
      expect(txBody.transactions.every((event) => event.type === "transaction")).toBe(true);

      const fraudRes = await app.request("/api/fraud-alerts");
      const fraudBody = (await fraudRes.json()) as { fraudAlerts: Array<{ type: string }> };
      expect(fraudRes.status).toBe(200);
      expect(fraudBody.fraudAlerts.every((event) => event.type === "fraud_alert")).toBe(true);
    });

    it("should return aggregated stats", async () => {
      const { logEvent } = await import("../src/services/event-store.js");
      logEvent("transaction", "u1", { action: "transfer", status: "success", amount: 300 });
      logEvent("transaction", "u2", { action: "transfer", status: "success", amount: 700 });
      logEvent("fraud_alert", "u1", { reason: "velocity" });

      const { app } = await import("../src/index.js");
      const res = await app.request("/api/stats");
      const body = (await res.json()) as {
        totalTransactions: number;
        blockedCount: number;
        activeUsers: number;
        totalVolume: number;
      };

      expect(res.status).toBe(200);
      expect(body.totalTransactions).toBe(2);
      expect(body.blockedCount).toBe(1);
      expect(body.activeUsers).toBe(2);
      expect(body.totalVolume).toBe(1000);
    });
  });
});

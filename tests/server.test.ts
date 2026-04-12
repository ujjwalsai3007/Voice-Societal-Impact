import { describe, it, expect } from "vitest";

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
});

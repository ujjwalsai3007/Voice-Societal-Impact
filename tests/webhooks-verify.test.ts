import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { Hono } from "hono";

describe("Signature Verification Middleware (src/webhooks/verify.ts)", () => {
  const TEST_SECRET = "test-vapi-secret-key";

  function signPayload(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a verifyVapiSignature middleware factory", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");
    expect(verifyVapiSignature).toBeDefined();
    expect(typeof verifyVapiSignature).toBe("function");
  });

  it("should pass through when signature is valid", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");

    const app = new Hono();
    app.use("/webhook/*", verifyVapiSignature(TEST_SECRET));
    app.post("/webhook/vapi", (c) => c.json({ ok: true }));

    const body = JSON.stringify({ message: { type: "tool-calls" } });
    const signature = signPayload(body, TEST_SECRET);

    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("should allow requests through when no auth header is present (Vapi without credentials)", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");

    const app = new Hono();
    app.use("/webhook/*", verifyVapiSignature(TEST_SECRET));
    app.post("/webhook/vapi", (c) => c.json({ ok: true }));

    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: {} }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("should return 200 with error when signature is invalid", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");

    const app = new Hono();
    app.use("/webhook/*", verifyVapiSignature(TEST_SECRET));
    app.post("/webhook/vapi", (c) => c.json({ ok: true }));

    const body = JSON.stringify({ message: {} });

    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": "invalid-signature-value",
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("results");
    expect(json.results[0]).toHaveProperty("error");
    expect(json.results[0].error).toContain("signature");
  });

  it("should reject when body was tampered with after signing", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");

    const app = new Hono();
    app.use("/webhook/*", verifyVapiSignature(TEST_SECRET));
    app.post("/webhook/vapi", (c) => c.json({ ok: true }));

    const originalBody = JSON.stringify({ message: { type: "tool-calls" } });
    const signature = signPayload(originalBody, TEST_SECRET);
    const tamperedBody = JSON.stringify({ message: { type: "hacked" } });

    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body: tamperedBody,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0]).toHaveProperty("error");
  });

  it("should store raw body on context for downstream handlers", async () => {
    const { verifyVapiSignature } = await import("../src/webhooks/verify.js");

    const app = new Hono();
    app.use("/webhook/*", verifyVapiSignature(TEST_SECRET));
    app.post("/webhook/vapi", (c) => {
      const rawBody = c.get("rawBody" as never);
      return c.json({ hasRawBody: typeof rawBody === "string" });
    });

    const body = JSON.stringify({ message: { type: "tool-calls" } });
    const signature = signPayload(body, TEST_SECRET);

    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasRawBody).toBe(true);
  });
});

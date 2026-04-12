import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const TEST_SECRET = "test-vapi-secret-key";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("Webhook Router (src/webhooks/router.ts)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a createWebhookRouter function", async () => {
    const { createWebhookRouter } = await import("../src/webhooks/router.js");
    expect(createWebhookRouter).toBeDefined();
    expect(typeof createWebhookRouter).toBe("function");
  });

  describe("POST /webhook/vapi", () => {
    it("should return 200 with valid results for a valid tool-calls payload", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const { registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("checkBalance", async () => "Balance: Rs 5000");

      const router = createWebhookRouter(TEST_SECRET);

      const body = JSON.stringify({
        message: {
          type: "tool-calls",
          call: { id: "call-123" },
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { id: "tc-001", parameters: { userId: "user-abc" } },
            },
          ],
        },
      });

      const signature = signPayload(body, TEST_SECRET);

      const res = await router.request("/webhook/vapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-signature": signature,
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("results");
      expect(json.results).toHaveLength(1);
      expect(json.results[0].toolCallId).toBe("tc-001");
      expect(json.results[0].result).toBe("Balance: Rs 5000");
    });

    it("should return 200 with error for an invalid payload structure", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const { clearToolHandlers } = await import("../src/webhooks/dispatcher.js");
      clearToolHandlers();

      const router = createWebhookRouter(TEST_SECRET);

      const body = JSON.stringify({ invalid: "payload" });
      const signature = signPayload(body, TEST_SECRET);

      const res = await router.request("/webhook/vapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-signature": signature,
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("results");
      expect(json.results[0]).toHaveProperty("error");
    });

    it("should return 200 with error when signature verification fails", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const { clearToolHandlers } = await import("../src/webhooks/dispatcher.js");
      clearToolHandlers();

      const router = createWebhookRouter(TEST_SECRET);

      const body = JSON.stringify({
        message: {
          type: "tool-calls",
          call: {},
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { id: "tc-001", parameters: {} },
            },
          ],
        },
      });

      const res = await router.request("/webhook/vapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-signature": "bad-signature",
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results[0]).toHaveProperty("error");
    });

    it("should handle multiple tool calls in a single request", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const { registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("checkBalance", async () => "Rs 5000");
      registerToolHandler("sendMoney", async () => "Sent Rs 100");

      const router = createWebhookRouter(TEST_SECRET);

      const body = JSON.stringify({
        message: {
          type: "tool-calls",
          call: { id: "call-456" },
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { id: "tc-001", parameters: {} },
            },
            {
              name: "sendMoney",
              toolCall: { id: "tc-002", parameters: { to: "u2", amount: 100 } },
            },
          ],
        },
      });

      const signature = signPayload(body, TEST_SECRET);

      const res = await router.request("/webhook/vapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-signature": signature,
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toHaveLength(2);
      expect(json.results[0].toolCallId).toBe("tc-001");
      expect(json.results[1].toolCallId).toBe("tc-002");
    });

    it("should return 200 with error for unknown tools (not crash)", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const { clearToolHandlers } = await import("../src/webhooks/dispatcher.js");
      clearToolHandlers();

      const router = createWebhookRouter(TEST_SECRET);

      const body = JSON.stringify({
        message: {
          type: "tool-calls",
          call: {},
          toolWithToolCallList: [
            {
              name: "unknownTool",
              toolCall: { id: "tc-x", parameters: {} },
            },
          ],
        },
      });

      const signature = signPayload(body, TEST_SECRET);

      const res = await router.request("/webhook/vapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-signature": signature,
        },
        body,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results[0]).toHaveProperty("error");
      expect(json.results[0].error).toContain("Unknown tool");
    });
  });

  describe("Other routes", () => {
    it("should reject GET /webhook/vapi with signature error (Vapi only sends POST)", async () => {
      const { createWebhookRouter } = await import("../src/webhooks/router.js");
      const router = createWebhookRouter(TEST_SECRET);

      const res = await router.request("/webhook/vapi", { method: "GET" });
      // Signature middleware intercepts all methods on /webhook/* and returns 200 with error
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results[0]).toHaveProperty("error");
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createApp } from "../src/index.js";
import { clearToolHandlers } from "../src/webhooks/dispatcher.js";
import { registerUpiTools } from "../src/services/upi-tools.js";
import { resetAccounts, getBalance } from "../src/services/upi.js";

const TEST_SECRET = "e2e-test-secret";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

vi.mock("../src/services/qdrant.js", () => {
  const mockClient = {
    upsert: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
    scroll: vi.fn().mockResolvedValue({ points: [] }),
    getCollections: vi.fn().mockResolvedValue({ collections: [] }),
    collectionExists: vi.fn().mockResolvedValue({ exists: true }),
    createCollection: vi.fn().mockResolvedValue({}),
  };
  return {
    COLLECTION_NAME: "user_memory",
    VECTOR_SIZE: 384,
    createQdrantClient: vi.fn().mockReturnValue(mockClient),
    getQdrantClient: vi.fn().mockReturnValue(mockClient),
    checkQdrantHealth: vi.fn().mockResolvedValue(true),
    ensureCollection: vi.fn().mockResolvedValue(undefined),
  };
});

describe("End-to-End Webhook Cycle", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    clearToolHandlers();
    resetAccounts();
    registerUpiTools();
    app = createApp(TEST_SECRET);
  });

  it("should handle a full checkBalance flow through the webhook", async () => {
    const body = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-1" },
        toolWithToolCallList: [
          {
            name: "checkBalance",
            toolCall: { id: "tc-e2e-cb", parameters: { userId: "user-e2e" } },
          },
        ],
      },
    });

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
    const json = (await res.json()) as { results: Array<{ toolCallId: string; result?: string; error?: string }> };
    expect(json.results).toHaveLength(1);
    expect(json.results[0]!.toolCallId).toBe("tc-e2e-cb");
    expect(json.results[0]!.result).toContain("10,000 rupees");
    expect(json.results[0]!.error).toBeUndefined();
  });

  it("should handle a full sendMoney flow and update balances", async () => {
    const setPinBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-2-pin" },
        toolWithToolCallList: [
          {
            name: "setPin",
            toolCall: {
              id: "tc-e2e-pin-set",
              parameters: { userId: "alice", pin: "1234" },
            },
          },
        ],
      },
    });

    const setPinSignature = signPayload(setPinBody, TEST_SECRET);
    const setPinRes = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": setPinSignature,
      },
      body: setPinBody,
    });
    expect(setPinRes.status).toBe(200);

    const initiateBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-2" },
        toolWithToolCallList: [
          {
            name: "sendMoney",
            toolCall: {
              id: "tc-e2e-sm",
              parameters: { senderId: "alice", receiverId: "bob", amount: 2500 },
            },
          },
        ],
      },
    });

    const initiateSignature = signPayload(initiateBody, TEST_SECRET);
    const initiateRes = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": initiateSignature,
      },
      body: initiateBody,
    });

    expect(initiateRes.status).toBe(200);
    const initiateJson = (await initiateRes.json()) as { results: Array<{ toolCallId: string; result?: string; error?: string }> };
    expect(initiateJson.results[0]!.result).toContain("2,500 rupees");
    expect(initiateJson.results[0]!.result).toContain("bob");
    expect(initiateJson.results[0]!.result).toContain("4-digit PIN");

    const confirmBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-2b" },
        toolWithToolCallList: [
          {
            name: "confirmSendMoney",
            toolCall: {
              id: "tc-e2e-confirm",
              parameters: {
                senderId: "alice",
                pin: "1234",
                amountConfirmation: 2500,
                newPayeeConfirmed: true,
              },
            },
          },
        ],
      },
    });
    const confirmSignature = signPayload(confirmBody, TEST_SECRET);
    const confirmRes = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": confirmSignature,
      },
      body: confirmBody,
    });

    expect(confirmRes.status).toBe(200);
    const confirmJson = (await confirmRes.json()) as { results: Array<{ toolCallId: string; result?: string; error?: string }> };
    expect(confirmJson.results[0]!.result).toContain("2,500 rupees");
    expect(confirmJson.results[0]!.result).toContain("alice");
    expect(confirmJson.results[0]!.result).toContain("bob");

    expect(getBalance("alice")).toBe(7500);
    expect(getBalance("bob")).toBe(12500);
  });

  it("should handle a multi-tool call: sendMoney then getTransactionHistory", async () => {
    const setPinBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-3-pin" },
        toolWithToolCallList: [
          {
            name: "setPin",
            toolCall: {
              id: "tc-e2e-pin-charlie",
              parameters: { userId: "charlie", pin: "1234" },
            },
          },
        ],
      },
    });

    const setPinSig = signPayload(setPinBody, TEST_SECRET);
    await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": setPinSig,
      },
      body: setPinBody,
    });

    const sendBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-3a" },
        toolWithToolCallList: [
          {
            name: "sendMoney",
            toolCall: {
              id: "tc-e2e-send",
              parameters: { senderId: "charlie", receiverId: "dave", amount: 1000 },
            },
          },
        ],
      },
    });

    const sendSig = signPayload(sendBody, TEST_SECRET);
    await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": sendSig,
      },
      body: sendBody,
    });

    const confirmBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-3a-confirm" },
        toolWithToolCallList: [
          {
            name: "confirmSendMoney",
            toolCall: {
              id: "tc-e2e-send-confirm",
              parameters: { senderId: "charlie", pin: "1234", newPayeeConfirmed: true },
            },
          },
        ],
      },
    });
    const confirmSig = signPayload(confirmBody, TEST_SECRET);
    await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": confirmSig,
      },
      body: confirmBody,
    });

    const historyBody = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-3b" },
        toolWithToolCallList: [
          {
            name: "getTransactionHistory",
            toolCall: {
              id: "tc-e2e-hist",
              parameters: { userId: "charlie" },
            },
          },
        ],
      },
    });

    const histSig = signPayload(historyBody, TEST_SECRET);
    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": histSig,
      },
      body: historyBody,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { results: Array<{ toolCallId: string; result?: string; error?: string }> };
    expect(json.results[0]!.toolCallId).toBe("tc-e2e-hist");
    expect(json.results[0]!.result).toContain("1,000 rupees");
    expect(json.results[0]!.result).toContain("charlie");
  });

  it("should handle concurrent tool calls in a single webhook request", async () => {
    const body = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-4" },
        toolWithToolCallList: [
          {
            name: "checkBalance",
            toolCall: { id: "tc-e2e-b1", parameters: { userId: "user1" } },
          },
          {
            name: "checkBalance",
            toolCall: { id: "tc-e2e-b2", parameters: { userId: "user2" } },
          },
        ],
      },
    });

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
    const json = (await res.json()) as { results: Array<{ toolCallId: string; result?: string }> };
    expect(json.results).toHaveLength(2);
    expect(json.results[0]!.toolCallId).toBe("tc-e2e-b1");
    expect(json.results[1]!.toolCallId).toBe("tc-e2e-b2");
  });

  it("should complete the full webhook cycle within 300ms", async () => {
    const body = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-latency" },
        toolWithToolCallList: [
          {
            name: "checkBalance",
            toolCall: { id: "tc-latency", parameters: { userId: "perf-user" } },
          },
        ],
      },
    });

    const signature = signPayload(body, TEST_SECRET);

    const start = performance.now();
    const res = await app.request("/webhook/vapi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body,
    });
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(300);
  });

  it("should handle recallContext tool call for memory retrieval", async () => {
    const body = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-5" },
        toolWithToolCallList: [
          {
            name: "recallContext",
            toolCall: {
              id: "tc-e2e-recall",
              parameters: { userId: "user-mem", query: "last payment to ramesh" },
            },
          },
        ],
      },
    });

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
    const json = (await res.json()) as { results: Array<{ toolCallId: string; result?: string; error?: string }> };
    expect(json.results[0]!.toolCallId).toBe("tc-e2e-recall");
    expect(json.results[0]!.error).toBeUndefined();
    expect(json.results[0]!.result).toBeDefined();
  });

  it("should gracefully handle unknown tool calls", async () => {
    const body = JSON.stringify({
      message: {
        type: "tool-calls",
        call: { id: "call-e2e-6" },
        toolWithToolCallList: [
          {
            name: "nonexistentTool",
            toolCall: { id: "tc-e2e-unknown", parameters: {} },
          },
        ],
      },
    });

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
    const json = (await res.json()) as { results: Array<{ toolCallId: string; error?: string }> };
    expect(json.results[0]!.error).toContain("Unknown tool");
  });
});

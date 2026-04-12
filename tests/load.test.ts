import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createApp } from "../src/index.js";
import { clearToolHandlers } from "../src/webhooks/dispatcher.js";
import { registerUpiTools } from "../src/services/upi-tools.js";
import { resetAccounts } from "../src/services/upi.js";

const TEST_SECRET = "load-test-secret";

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

describe("Load Test — p95 < 300ms", () => {
  let app: ReturnType<typeof createApp>;
  const ITERATIONS = 50;

  beforeEach(() => {
    clearToolHandlers();
    resetAccounts();
    registerUpiTools();
    app = createApp(TEST_SECRET);
  });

  it(`should process ${ITERATIONS} sequential checkBalance requests with p95 < 300ms`, async () => {
    const latencies: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const body = JSON.stringify({
        message: {
          type: "tool-calls",
          call: { id: `load-call-${i}` },
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { id: `tc-load-${i}`, parameters: { userId: `user-${i}` } },
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
      latencies.push(elapsed);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)]!;
    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;

    expect(p95).toBeLessThan(300);
    expect(avg).toBeLessThan(100);
  });
});

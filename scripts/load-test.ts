import { createHmac } from "node:crypto";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3000";
const VAPI_SECRET = process.env["VAPI_SECRET"] ?? "";
const TOTAL_REQUESTS = 100;
const CONCURRENCY = 10;

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function makePayload(toolCallId: string): string {
  return JSON.stringify({
    message: {
      type: "tool-calls",
      call: { id: `load-call-${toolCallId}` },
      toolWithToolCallList: [
        {
          name: "checkBalance",
          toolCall: { id: toolCallId, parameters: { userId: `load-user-${toolCallId}` } },
        },
      ],
    },
  });
}

interface RequestResult {
  latencyMs: number;
  status: number;
  ok: boolean;
}

async function sendRequest(index: number): Promise<RequestResult> {
  const toolCallId = `tc-load-${index}`;
  const body = makePayload(toolCallId);
  const signature = signPayload(body, VAPI_SECRET);

  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/webhook/vapi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body,
    });
    const latencyMs = performance.now() - start;
    return { latencyMs, status: res.status, ok: res.ok };
  } catch {
    const latencyMs = performance.now() - start;
    return { latencyMs, status: 0, ok: false };
  }
}

async function runBatch(start: number, count: number): Promise<RequestResult[]> {
  const promises: Promise<RequestResult>[] = [];
  for (let i = start; i < start + count; i++) {
    promises.push(sendRequest(i));
  }
  return Promise.all(promises);
}

async function main(): Promise<void> {
  console.log(`Load test: ${TOTAL_REQUESTS} requests, concurrency ${CONCURRENCY}`);
  console.log(`Target: ${BASE_URL}/webhook/vapi\n`);

  if (!VAPI_SECRET) {
    console.error("ERROR: VAPI_SECRET env var is required for signing requests.");
    process.exit(1);
  }

  const allResults: RequestResult[] = [];
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENCY);

  for (let batch = 0; batch < batches; batch++) {
    const start = batch * CONCURRENCY;
    const count = Math.min(CONCURRENCY, TOTAL_REQUESTS - start);
    const results = await runBatch(start, count);
    allResults.push(...results);
    process.stdout.write(`  Batch ${batch + 1}/${batches} complete (${allResults.length}/${TOTAL_REQUESTS})\r`);
  }

  console.log("\n");

  const latencies = allResults.map((r) => r.latencyMs).sort((a, b) => a - b);
  const successCount = allResults.filter((r) => r.ok).length;
  const failCount = allResults.length - successCount;

  const p50 = latencies[Math.floor(latencies.length * 0.5)]!;
  const p90 = latencies[Math.floor(latencies.length * 0.9)]!;
  const p95 = latencies[Math.floor(latencies.length * 0.95)]!;
  const p99 = latencies[Math.floor(latencies.length * 0.99)]!;
  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const min = latencies[0]!;
  const max = latencies[latencies.length - 1]!;

  console.log("=== Load Test Results ===");
  console.log(`Total requests:  ${allResults.length}`);
  console.log(`Successes:       ${successCount}`);
  console.log(`Failures:        ${failCount}`);
  console.log(`\nLatency (ms):`);
  console.log(`  min:  ${min.toFixed(1)}`);
  console.log(`  avg:  ${avg.toFixed(1)}`);
  console.log(`  p50:  ${p50.toFixed(1)}`);
  console.log(`  p90:  ${p90.toFixed(1)}`);
  console.log(`  p95:  ${p95.toFixed(1)}`);
  console.log(`  p99:  ${p99.toFixed(1)}`);
  console.log(`  max:  ${max.toFixed(1)}`);

  const targetMet = p95 < 300;
  console.log(`\n${targetMet ? "✓" : "✗"} p95 < 300ms target: ${targetMet ? "MET" : "MISSED"} (${p95.toFixed(1)}ms)`);

  process.exit(targetMet ? 0 : 1);
}

main();

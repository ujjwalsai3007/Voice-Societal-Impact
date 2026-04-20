import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as pinoLogger } from "./lib/logger.js";
import { loadConfig } from "./lib/config.js";
import { createWebhookRouter } from "./webhooks/router.js";
import { registerUpiTools } from "./services/upi-tools.js";
import { createQdrantClient, ensureCollection, checkQdrantHealth, COLLECTION_NAME, VECTOR_SIZE } from "./services/qdrant.js";
import {
  getEvents,
  getFraudAlerts,
  getStats,
  getTransactions,
} from "./services/event-store.js";

export function createApp(vapiSecret?: string): Hono {
  const secret = vapiSecret ?? process.env["VAPI_SECRET"] ?? "";
  const app = new Hono();

  app.use("*", async (c, next) => {
    const start = performance.now();
    await next();
    const ms = Math.round(performance.now() - start);
    c.res.headers.set("X-Response-Time", `${ms}ms`);

    if (ms > 300) {
      pinoLogger.warn(
        { method: c.req.method, path: c.req.path, responseTimeMs: ms },
        "Response exceeded 300ms latency target",
      );
    }

    pinoLogger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, responseTimeMs: ms },
      "request completed",
    );
  });

  app.use(
    "/api/*",
    cors({
      origin: process.env["DASHBOARD_ORIGIN"] ?? "*",
    }),
  );

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/events", (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return c.json({ events: getEvents(limit) });
  });

  app.get("/api/transactions", (c) => {
    return c.json({ transactions: getTransactions() });
  });

  app.get("/api/fraud-alerts", (c) => {
    return c.json({ fraudAlerts: getFraudAlerts() });
  });

  app.get("/api/stats", (c) => {
    return c.json(getStats());
  });

  if (secret) {
    const webhookRouter = createWebhookRouter(secret);
    app.route("/", webhookRouter);
  }

  app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404);
  });

  return app;
}

export async function warmUpQdrant(url: string, apiKey?: string): Promise<void> {
  try {
    createQdrantClient(url, apiKey || undefined);
    const healthy = await checkQdrantHealth();

    if (healthy) {
      await ensureCollection(COLLECTION_NAME, VECTOR_SIZE);
      pinoLogger.info("Qdrant warm-up complete: connection established and collection ensured");
    } else {
      pinoLogger.warn("Qdrant warm-up: health check failed, will retry on first request");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    pinoLogger.error({ error: message }, "Qdrant warm-up failed — continuing without pre-connection");
  }
}

async function startServer(): Promise<void> {
  const config = loadConfig();

  await warmUpQdrant(config.qdrantUrl, config.qdrantApiKey);

  registerUpiTools();

  const app = createApp(config.vapiSecret);

  serve(
    { fetch: app.fetch, port: config.port },
    (info) => {
      pinoLogger.info(
        { port: info.port, address: info.address },
        "VoicePay Assist server started",
      );
    },
  );
}

const isMainModule = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMainModule) {
  startServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    pinoLogger.error({ error: message }, "Failed to start server");
    process.exit(1);
  });
}

export const app = createApp();

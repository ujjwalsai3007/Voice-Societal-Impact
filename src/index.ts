import { Hono } from "hono";
import { logger as pinoLogger } from "./lib/logger.js";
import { createWebhookRouter } from "./webhooks/router.js";
import { loadConfig } from "./lib/config.js";
import { registerUpiTools } from "./services/upi-tools.js";

let upiToolsRegistered = false;

export function createApp(vapiSecret?: string): Hono {
  const secret = vapiSecret ?? process.env["VAPI_SECRET"] ?? "";
  const app = new Hono();

  if (!upiToolsRegistered) {
    registerUpiTools();
    upiToolsRegistered = true;
  }

  app.use("*", async (c, next) => {
    const start = performance.now();
    await next();
    const ms = Math.round(performance.now() - start);
    c.res.headers.set("X-Response-Time", `${ms}ms`);
    pinoLogger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, responseTimeMs: ms },
      "request completed",
    );
  });

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
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

export const app = createApp();

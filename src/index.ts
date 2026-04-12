import { Hono } from "hono";
import { logger as pinoLogger } from "./lib/logger.js";

export const app = new Hono();

app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  c.res.headers.set("X-Response-Time", `${ms}ms`);
  pinoLogger.info({ method: c.req.method, path: c.req.path, status: c.res.status, responseTimeMs: ms }, "request completed");
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import { vapiToolCallRequestSchema } from "./schemas.js";
import { verifyVapiSignature } from "./verify.js";
import { dispatchToolCalls } from "./dispatcher.js";

export function createWebhookRouter(vapiSecret: string): Hono {
  const router = new Hono();

  router.use("/webhook/*", verifyVapiSignature(vapiSecret));

  router.post("/webhook/vapi", async (c) => {
    const rawBody = c.get("rawBody" as never) as string;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      logger.error({ path: c.req.path }, "Failed to parse webhook JSON body");
      return c.json(
        {
          results: [
            { toolCallId: "unknown", error: "Invalid JSON body" },
          ],
        },
        200,
      );
    }

    const validation = vapiToolCallRequestSchema.safeParse(parsed);

    if (!validation.success) {
      logger.warn(
        { path: c.req.path, issues: validation.error.issues },
        "Webhook payload validation failed",
      );
      return c.json(
        {
          results: [
            {
              toolCallId: "unknown",
              error: "Invalid webhook payload structure",
            },
          ],
        },
        200,
      );
    }

    const { message } = validation.data;
    const results = await dispatchToolCalls(message.toolWithToolCallList);

    return c.json({ results }, 200);
  });

  return router;
}

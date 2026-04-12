import { createHmac, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger.js";

export function verifyVapiSignature(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const rawBody = await c.req.text();
    c.set("rawBody" as never, rawBody as never);

    const signatureHeader = c.req.header("x-vapi-signature");

    if (!signatureHeader) {
      logger.warn({ path: c.req.path }, "Missing x-vapi-signature header");
      return c.json(
        {
          results: [
            { toolCallId: "unknown", error: "Missing x-vapi-signature header" },
          ],
        },
        200,
      );
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(signatureHeader, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      logger.warn({ path: c.req.path }, "Invalid x-vapi-signature");
      return c.json(
        {
          results: [
            { toolCallId: "unknown", error: "Invalid x-vapi-signature" },
          ],
        },
        200,
      );
    }

    await next();
  };
}

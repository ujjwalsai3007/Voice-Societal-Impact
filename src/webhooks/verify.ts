import { createHmac, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger.js";

export function verifyVapiSignature(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const rawBody = await c.req.text();
    c.set("rawBody" as never, rawBody as never);

    const vapiSecretHeader = c.req.header("x-vapi-secret");
    if (vapiSecretHeader) {
      const secretBuffer = Buffer.from(secret);
      const headerBuffer = Buffer.from(vapiSecretHeader);

      if (
        secretBuffer.length === headerBuffer.length &&
        timingSafeEqual(secretBuffer, headerBuffer)
      ) {
        await next();
        return;
      }

      logger.warn({ path: c.req.path }, "Invalid X-Vapi-Secret");
      return c.json(
        {
          results: [
            { toolCallId: "unknown", error: "Invalid X-Vapi-Secret" },
          ],
        },
        200,
      );
    }

    const signatureHeader = c.req.header("x-vapi-signature");
    if (signatureHeader) {
      const expectedSignature = createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      const sigBuffer = Buffer.from(signatureHeader, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (
        sigBuffer.length === expectedBuffer.length &&
        timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        await next();
        return;
      }

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

    logger.warn({ path: c.req.path }, "No auth header present — allowing request (configure credentials in Vapi dashboard for production)");
    await next();
  };
}

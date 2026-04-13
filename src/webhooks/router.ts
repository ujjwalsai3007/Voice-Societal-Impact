import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import { verifyVapiSignature } from "./verify.js";
import { dispatchToolCalls } from "./dispatcher.js";
import type { VapiToolWithToolCall } from "./schemas.js";

function extractToolCalls(
  message: Record<string, unknown>,
): VapiToolWithToolCall[] {
  const toolWithToolCallList = message["toolWithToolCallList"] as
    | Array<Record<string, unknown>>
    | undefined;

  if (Array.isArray(toolWithToolCallList) && toolWithToolCallList.length > 0) {
    return toolWithToolCallList.map(normalizeToolCall);
  }

  const toolCallList = message["toolCallList"] as
    | Array<Record<string, unknown>>
    | undefined;

  if (Array.isArray(toolCallList) && toolCallList.length > 0) {
    return toolCallList.map((tc) => {
      const fn = tc["function"] as Record<string, unknown> | undefined;
      const name = (fn?.["name"] as string) ?? (tc["name"] as string) ?? "unknown";
      const id = (tc["id"] as string) ?? "unknown";

      let parameters: Record<string, unknown> = {};
      const args = fn?.["arguments"];
      if (typeof args === "string") {
        try {
          parameters = JSON.parse(args) as Record<string, unknown>;
        } catch {
          logger.warn({ toolCallId: id, rawArgs: args }, "Failed to parse tool call arguments");
        }
      } else if (typeof args === "object" && args !== null) {
        parameters = args as Record<string, unknown>;
      }

      return {
        name,
        toolCall: { id, parameters },
      };
    });
  }

  return [];
}

function normalizeToolCall(
  raw: Record<string, unknown>,
): VapiToolWithToolCall {
  const toolCall = raw["toolCall"] as Record<string, unknown>;
  const id = toolCall["id"] as string;

  const wrapperFn = raw["function"] as Record<string, unknown> | undefined;
  const toolCallFn = toolCall["function"] as Record<string, unknown> | undefined;

  const name =
    (raw["name"] as string | undefined) ??
    (wrapperFn?.["name"] as string | undefined) ??
    (toolCallFn?.["name"] as string | undefined) ??
    "unknown";

  let parameters: Record<string, unknown> =
    (toolCall["parameters"] as Record<string, unknown>) ?? {};

  const fnWithArgs = toolCallFn ?? wrapperFn;
  if (fnWithArgs?.["parameters"] && typeof fnWithArgs["parameters"] === "object") {
    const fnParams = fnWithArgs["parameters"] as Record<string, unknown>;
    if (!fnParams["type"]) {
      parameters = fnParams;
    }
  }
  if (fnWithArgs?.["arguments"]) {
    const args = fnWithArgs["arguments"];
    if (typeof args === "string") {
      try {
        parameters = JSON.parse(args) as Record<string, unknown>;
      } catch {
        logger.warn({ toolCallId: id, rawArgs: args }, "Failed to parse tool call arguments");
      }
    } else if (typeof args === "object" && args !== null) {
      parameters = args as Record<string, unknown>;
    }
  }

  return { name, toolCall: { id, parameters } };
}

export function createWebhookRouter(vapiSecret: string): Hono {
  const router = new Hono();

  router.use("/webhook/*", verifyVapiSignature(vapiSecret));

  router.post("/webhook/vapi", async (c) => {
    const rawBody = c.get("rawBody" as never) as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
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

    const message = parsed["message"] as Record<string, unknown> | undefined;
    const messageType = message?.["type"] as string | undefined;

    if (messageType !== "tool-calls") {
      logger.info(
        { path: c.req.path, messageType: messageType ?? "unknown" },
        "Non-tool-call event received — acknowledged",
      );
      return c.json({}, 200);
    }

    const messageKeys = message ? Object.keys(message) : [];
    logger.info({ messageType, messageKeys }, "Received tool-calls webhook");

    const toolCalls = message ? extractToolCalls(message) : [];
    logger.info({ extractedToolCalls: toolCalls.map((tc) => ({ name: tc.name, id: tc.toolCall.id })) }, "Extracted tool calls");

    if (toolCalls.length === 0) {
      logger.warn(
        { path: c.req.path, messageKeys: message ? Object.keys(message) : [] },
        "No tool calls found in payload",
      );
      return c.json(
        {
          results: [
            { toolCallId: "unknown", error: "No tool calls found in payload" },
          ],
        },
        200,
      );
    }

    const results = await dispatchToolCalls(toolCalls);

    return c.json({ results }, 200);
  });

  return router;
}

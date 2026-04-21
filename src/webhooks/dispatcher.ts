import { logger } from "../lib/logger.js";
import type { VapiToolWithToolCall } from "./schemas.js";
import { logEvent } from "../services/event-store.js";

export type ToolHandler = (
  parameters: Record<string, unknown>,
) => Promise<string>;

interface ToolCallResult {
  toolCallId: string;
  result?: string;
  error?: string;
}

const toolHandlers = new Map<string, ToolHandler>();

function inferUserId(params: Record<string, unknown>): string {
  const userId = params["userId"];
  if (typeof userId === "string" && userId.length > 0) {
    return userId;
  }

  const senderId = params["senderId"];
  if (typeof senderId === "string" && senderId.length > 0) {
    return senderId;
  }

  return "system";
}

export function registerToolHandler(
  name: string,
  handler: ToolHandler,
): void {
  if (toolHandlers.has(name)) {
    throw new Error(`Tool handler already registered: ${name}`);
  }
  toolHandlers.set(name, handler);
  logger.info({ tool: name }, "Tool handler registered");
}

export function getRegisteredTools(): string[] {
  return [...toolHandlers.keys()];
}

export function clearToolHandlers(): void {
  toolHandlers.clear();
}

export async function dispatchToolCalls(
  toolCalls: VapiToolWithToolCall[],
): Promise<ToolCallResult[]> {
  const results = await Promise.all(
    toolCalls.map(async (tc): Promise<ToolCallResult> => {
      const handler = toolHandlers.get(tc.name);
      const parameters = tc.toolCall.parameters ?? {};
      const userId = inferUserId(parameters);

      logEvent("tool_call", userId, {
        toolName: tc.name,
        toolCallId: tc.toolCall.id,
        status: "received",
      });

      if (!handler) {
        logger.warn({ tool: tc.name, toolCallId: tc.toolCall.id }, "Unknown tool requested");
        logEvent("tool_call", userId, {
          toolName: tc.name,
          toolCallId: tc.toolCall.id,
          status: "error",
          error: `Unknown tool: ${tc.name}`,
        });
        return { toolCallId: tc.toolCall.id, error: `Unknown tool: ${tc.name}` };
      }

      try {
        const result = await handler(parameters);
        logger.info({ tool: tc.name, toolCallId: tc.toolCall.id }, "Tool call succeeded");
        logEvent("tool_call", userId, {
          toolName: tc.name,
          toolCallId: tc.toolCall.id,
          status: "success",
        });
        return { toolCallId: tc.toolCall.id, result };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Internal tool error";
        logger.error(
          { tool: tc.name, toolCallId: tc.toolCall.id, error: message },
          "Tool call failed",
        );
        logEvent("tool_call", userId, {
          toolName: tc.name,
          toolCallId: tc.toolCall.id,
          status: "error",
          error: message,
        });
        return { toolCallId: tc.toolCall.id, error: message };
      }
    }),
  );

  return results;
}

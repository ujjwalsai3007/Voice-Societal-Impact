import { logger } from "../lib/logger.js";
import type { VapiToolWithToolCall } from "./schemas.js";

export type ToolHandler = (
  parameters: Record<string, unknown>,
) => Promise<string>;

interface ToolCallResult {
  toolCallId: string;
  result?: string;
  error?: string;
}

const toolHandlers = new Map<string, ToolHandler>();

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

      if (!handler) {
        logger.warn({ tool: tc.name, toolCallId: tc.toolCall.id }, "Unknown tool requested");
        return { toolCallId: tc.toolCall.id, error: `Unknown tool: ${tc.name}` };
      }

      try {
        const result = await handler(tc.toolCall.parameters);
        logger.info({ tool: tc.name, toolCallId: tc.toolCall.id }, "Tool call succeeded");
        return { toolCallId: tc.toolCall.id, result };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Internal tool error";
        logger.error(
          { tool: tc.name, toolCallId: tc.toolCall.id, error: message },
          "Tool call failed",
        );
        return { toolCallId: tc.toolCall.id, error: message };
      }
    }),
  );

  return results;
}

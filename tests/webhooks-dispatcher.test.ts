import { describe, it, expect, vi } from "vitest";

describe("Tool Dispatcher (src/webhooks/dispatcher.ts)", () => {
  it("should export a dispatchToolCalls function", async () => {
    const { dispatchToolCalls } = await import("../src/webhooks/dispatcher.js");
    expect(dispatchToolCalls).toBeDefined();
    expect(typeof dispatchToolCalls).toBe("function");
  });

  it("should export a registerToolHandler function", async () => {
    const { registerToolHandler } = await import("../src/webhooks/dispatcher.js");
    expect(registerToolHandler).toBeDefined();
    expect(typeof registerToolHandler).toBe("function");
  });

  it("should export a getRegisteredTools function", async () => {
    const { getRegisteredTools } = await import("../src/webhooks/dispatcher.js");
    expect(getRegisteredTools).toBeDefined();
    expect(typeof getRegisteredTools).toBe("function");
  });

  describe("registerToolHandler", () => {
    it("should register a tool handler by name", async () => {
      const { registerToolHandler, getRegisteredTools, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      const handler = vi.fn().mockResolvedValue("result");
      registerToolHandler("testTool", handler);

      const tools = getRegisteredTools();
      expect(tools).toContain("testTool");
    });

    it("should throw when registering a duplicate tool name", async () => {
      const { registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      const handler = vi.fn().mockResolvedValue("result");
      registerToolHandler("dupTool", handler);

      expect(() => registerToolHandler("dupTool", handler)).toThrow();
    });
  });

  describe("dispatchToolCalls", () => {
    it("should dispatch a single tool call and return results", async () => {
      const { dispatchToolCalls, registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("checkBalance", async (params) => {
        return `Balance for ${params["userId"] as string}: Rs 5000`;
      });

      const toolCalls = [
        {
          name: "checkBalance",
          toolCall: { id: "tc-001", parameters: { userId: "user-abc" } },
        },
      ];

      const results = await dispatchToolCalls(toolCalls);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        toolCallId: "tc-001",
        result: "Balance for user-abc: Rs 5000",
      });
    });

    it("should dispatch multiple tool calls in parallel", async () => {
      const { dispatchToolCalls, registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("toolA", async () => "result-A");
      registerToolHandler("toolB", async () => "result-B");

      const toolCalls = [
        { name: "toolA", toolCall: { id: "tc-a", parameters: {} } },
        { name: "toolB", toolCall: { id: "tc-b", parameters: {} } },
      ];

      const results = await dispatchToolCalls(toolCalls);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ toolCallId: "tc-a", result: "result-A" });
      expect(results[1]).toEqual({ toolCallId: "tc-b", result: "result-B" });
    });

    it("should return an error result for an unknown tool", async () => {
      const { dispatchToolCalls, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      const toolCalls = [
        { name: "nonExistentTool", toolCall: { id: "tc-x", parameters: {} } },
      ];

      const results = await dispatchToolCalls(toolCalls);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        toolCallId: "tc-x",
        error: "Unknown tool: nonExistentTool",
      });
    });

    it("should catch handler errors and return them as error results", async () => {
      const { dispatchToolCalls, registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("failingTool", async () => {
        throw new Error("Something went wrong");
      });

      const toolCalls = [
        { name: "failingTool", toolCall: { id: "tc-fail", parameters: {} } },
      ];

      const results = await dispatchToolCalls(toolCalls);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        toolCallId: "tc-fail",
        error: "Something went wrong",
      });
    });

    it("should handle a mix of successful and failing tool calls", async () => {
      const { dispatchToolCalls, registerToolHandler, clearToolHandlers } = await import(
        "../src/webhooks/dispatcher.js"
      );
      clearToolHandlers();

      registerToolHandler("goodTool", async () => "success");
      registerToolHandler("badTool", async () => {
        throw new Error("failure");
      });

      const toolCalls = [
        { name: "goodTool", toolCall: { id: "tc-g", parameters: {} } },
        { name: "badTool", toolCall: { id: "tc-b", parameters: {} } },
        { name: "missingTool", toolCall: { id: "tc-m", parameters: {} } },
      ];

      const results = await dispatchToolCalls(toolCalls);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ toolCallId: "tc-g", result: "success" });
      expect(results[1]).toEqual({ toolCallId: "tc-b", error: "failure" });
      expect(results[2]).toEqual({ toolCallId: "tc-m", error: "Unknown tool: missingTool" });
    });
  });
});

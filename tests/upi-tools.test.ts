import { describe, it, expect, beforeEach } from "vitest";
import { clearToolHandlers, getRegisteredTools, dispatchToolCalls } from "../src/webhooks/dispatcher.js";
import { registerUpiTools } from "../src/services/upi-tools.js";
import { resetAccounts } from "../src/services/upi.js";

describe("UPI Tool Handler Registration (src/services/upi-tools.ts)", () => {
  beforeEach(() => {
    clearToolHandlers();
    resetAccounts();
  });

  it("should register checkBalance, sendMoney, and getTransactionHistory tools", () => {
    registerUpiTools();
    const tools = getRegisteredTools();
    expect(tools).toContain("checkBalance");
    expect(tools).toContain("sendMoney");
    expect(tools).toContain("getTransactionHistory");
  });

  it("should throw if registered twice", () => {
    registerUpiTools();
    expect(() => registerUpiTools()).toThrow(/already registered/);
  });

  describe("end-to-end dispatch", () => {
    beforeEach(() => {
      registerUpiTools();
    });

    it("should dispatch checkBalance via the tool pipeline", async () => {
      const results = await dispatchToolCalls([
        {
          name: "checkBalance",
          toolCall: { id: "tc-cb-1", parameters: { userId: "user-test" } },
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.toolCallId).toBe("tc-cb-1");
      expect(results[0]!.result).toContain("10000");
      expect(results[0]!.error).toBeUndefined();
    });

    it("should dispatch sendMoney via the tool pipeline", async () => {
      const results = await dispatchToolCalls([
        {
          name: "sendMoney",
          toolCall: {
            id: "tc-sm-1",
            parameters: { senderId: "user-a", receiverId: "user-b", amount: 1000 },
          },
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.toolCallId).toBe("tc-sm-1");
      expect(results[0]!.result).toContain("1000");
      expect(results[0]!.result).toContain("user-a");
      expect(results[0]!.result).toContain("user-b");
      expect(results[0]!.error).toBeUndefined();
    });

    it("should dispatch getTransactionHistory via the tool pipeline", async () => {
      await dispatchToolCalls([
        {
          name: "sendMoney",
          toolCall: {
            id: "tc-sm-2",
            parameters: { senderId: "user-a", receiverId: "user-b", amount: 500 },
          },
        },
      ]);

      const results = await dispatchToolCalls([
        {
          name: "getTransactionHistory",
          toolCall: { id: "tc-th-1", parameters: { userId: "user-a" } },
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.toolCallId).toBe("tc-th-1");
      expect(results[0]!.result).toContain("500");
      expect(results[0]!.error).toBeUndefined();
    });

    it("should return error for sendMoney with insufficient funds", async () => {
      const results = await dispatchToolCalls([
        {
          name: "sendMoney",
          toolCall: {
            id: "tc-sm-fail",
            parameters: { senderId: "user-a", receiverId: "user-b", amount: 99999 },
          },
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.toolCallId).toBe("tc-sm-fail");
      expect(results[0]!.error).toMatch(/insufficient/i);
      expect(results[0]!.result).toBeUndefined();
    });

    it("should handle multiple tool calls in a single dispatch", async () => {
      const results = await dispatchToolCalls([
        {
          name: "checkBalance",
          toolCall: { id: "tc-1", parameters: { userId: "user-a" } },
        },
        {
          name: "checkBalance",
          toolCall: { id: "tc-2", parameters: { userId: "user-b" } },
        },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.result).toContain("10000");
      expect(results[1]!.result).toContain("10000");
    });
  });
});

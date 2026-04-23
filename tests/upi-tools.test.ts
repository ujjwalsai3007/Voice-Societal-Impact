import { describe, it, expect, beforeEach } from "vitest";
import { clearToolHandlers, getRegisteredTools, dispatchToolCalls } from "../src/webhooks/dispatcher.js";
import { registerUpiTools } from "../src/services/upi-tools.js";
import { resetAccounts } from "../src/services/upi.js";

describe("UPI Tool Handler Registration (src/services/upi-tools.ts)", () => {
  beforeEach(() => {
    clearToolHandlers();
    resetAccounts();
  });

  it("should register payment, PIN, history, and beneficiary tools", () => {
    registerUpiTools();
    const tools = getRegisteredTools();
    expect(tools).toContain("checkBalance");
    expect(tools).toContain("sendMoney");
    expect(tools).toContain("confirmSendMoney");
    expect(tools).toContain("setPin");
    expect(tools).toContain("changePin");
    expect(tools).toContain("checkPinStatus");
    expect(tools).toContain("getTransactionHistory");
    expect(tools).toContain("addBeneficiary");
    expect(tools).toContain("listBeneficiaries");
    expect(tools).toContain("removeBeneficiary");
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
      expect(results[0]!.result).toContain("10,000 rupees");
      expect(results[0]!.error).toBeUndefined();
    });

    it("should dispatch sendMoney via the tool pipeline", async () => {
      await dispatchToolCalls([
        {
          name: "setPin",
          toolCall: {
            id: "tc-pin-1",
            parameters: { userId: "user-a", pin: "1234" },
          },
        },
      ]);

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
      expect(results[0]!.result).toContain("Transfer of 1,000 rupees");
      expect(results[0]!.result).toContain("user-b");
      expect(results[0]!.result).toContain("4-digit PIN");
      expect(results[0]!.error).toBeUndefined();
    });

    it("should dispatch getTransactionHistory via the tool pipeline", async () => {
      await dispatchToolCalls([
        {
          name: "setPin",
          toolCall: {
            id: "tc-pin-2",
            parameters: { userId: "user-a", pin: "1234" },
          },
        },
      ]);

      await dispatchToolCalls([
        {
          name: "sendMoney",
          toolCall: {
            id: "tc-sm-2",
            parameters: { senderId: "user-a", receiverId: "user-b", amount: 500 },
          },
        },
      ]);
      await dispatchToolCalls([
        {
          name: "confirmSendMoney",
          toolCall: {
            id: "tc-sm-2-confirm",
            parameters: { senderId: "user-a", pin: "1234", newPayeeConfirmed: true },
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

    it("should update PIN through setPin and changePin tools", async () => {
      const setResults = await dispatchToolCalls([
        {
          name: "setPin",
          toolCall: {
            id: "tc-pin-set",
            parameters: { userId: "user-a", pin: "1234" },
          },
        },
      ]);
      expect(setResults[0]!.result).toContain("PIN set successfully");

      const changeResults = await dispatchToolCalls([
        {
          name: "changePin",
          toolCall: {
            id: "tc-pin-change",
            parameters: {
              userId: "user-a",
              currentPin: "1234",
              newPin: "9876",
            },
          },
        },
      ]);
      expect(changeResults[0]!.result).toContain("PIN updated successfully");
    });

    it("should return error for sendMoney that violates a limit", async () => {
      await dispatchToolCalls([
        {
          name: "setPin",
          toolCall: {
            id: "tc-pin-3",
            parameters: { userId: "user-a", pin: "1234" },
          },
        },
      ]);

      // 99_999 exceeds the per-transaction limit of 10_000 — limit check fires first
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
      expect(results[0]!.error).toMatch(/per-transaction limit|insufficient/i);
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
      expect(results[0]!.result).toContain("10,000 rupees");
      expect(results[1]!.result).toContain("10,000 rupees");
    });
  });
});

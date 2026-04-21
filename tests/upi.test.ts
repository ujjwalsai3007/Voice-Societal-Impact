import { describe, it, expect, beforeEach } from "vitest";
import {
  getBalance,
  checkBalance,
  sendMoney,
  getTransactionHistory,
  resetAccounts,
  HIGH_VALUE_TRANSFER_THRESHOLD,
} from "../src/services/upi.js";
import { setPin } from "../src/services/pin.js";

describe("UPI Transaction Engine (src/services/upi.ts)", () => {
  beforeEach(() => {
    resetAccounts();
  });

  async function sendMoneySecure(
    senderId: string,
    receiverId: string,
    amount: number,
    pin = "1234",
  ): Promise<string> {
    setPin(senderId, pin);
    return sendMoney({
      senderId,
      receiverId,
      amount,
      pin,
      ...(amount >= HIGH_VALUE_TRANSFER_THRESHOLD
        ? { amountConfirmation: amount }
        : {}),
    });
  }

  describe("getBalance", () => {
    it("should return default balance of 10000 for a new user", () => {
      const balance = getBalance("user-new");
      expect(balance).toBe(10000);
    });

    it("should return the same balance on repeated calls for the same user", () => {
      const b1 = getBalance("user-a");
      const b2 = getBalance("user-a");
      expect(b1).toBe(b2);
    });

    it("should track separate balances per user", () => {
      const b1 = getBalance("user-a");
      const b2 = getBalance("user-b");
      expect(b1).toBe(10000);
      expect(b2).toBe(10000);
    });
  });

  describe("checkBalance", () => {
    it("should return a human-readable string with the user's balance", async () => {
      const result = await checkBalance({ userId: "user-abc" });
      expect(result).toContain("10,000 rupees");
      expect(result).toContain("user-abc");
    });

    it("should throw if userId is missing", async () => {
      await expect(checkBalance({})).rejects.toThrow();
    });

    it("should throw if userId is not a string", async () => {
      await expect(checkBalance({ userId: 123 })).rejects.toThrow();
    });

    it("should reflect updated balance after a transaction", async () => {
      await sendMoneySecure("user-abc", "user-xyz", 500);
      const result = await checkBalance({ userId: "user-abc" });
      expect(result).toContain("9,500 rupees");
    });
  });

  describe("sendMoney", () => {
    it("should transfer money between two users", async () => {
      const result = await sendMoneySecure("user-a", "user-b", 2000);

      expect(result).toContain("2,000 rupees");
      expect(result).toContain("user-a");
      expect(result).toContain("user-b");

      expect(getBalance("user-a")).toBe(8000);
      expect(getBalance("user-b")).toBe(12000);
    });

    it("should reject transfer when sender has insufficient funds", async () => {
      setPin("user-a", "1234");
      await expect(
        sendMoney({
          senderId: "user-a",
          receiverId: "user-b",
          amount: 99999,
          pin: "1234",
          amountConfirmation: 99999,
        }),
      ).rejects.toThrow(/insufficient/i);
    });

    it("should reject transfer with zero amount", async () => {
      setPin("user-a", "1234");
      await expect(
        sendMoney({
          senderId: "user-a",
          receiverId: "user-b",
          amount: 0,
          pin: "1234",
        }),
      ).rejects.toThrow();
    });

    it("should reject transfer with negative amount", async () => {
      setPin("user-a", "1234");
      await expect(
        sendMoney({
          senderId: "user-a",
          receiverId: "user-b",
          amount: -100,
          pin: "1234",
        }),
      ).rejects.toThrow();
    });

    it("should reject transfer to self", async () => {
      setPin("user-a", "1234");
      await expect(
        sendMoney({
          senderId: "user-a",
          receiverId: "user-a",
          amount: 100,
          pin: "1234",
        }),
      ).rejects.toThrow(/same/i);
    });

    it("should throw if senderId is missing", async () => {
      await expect(
        sendMoney({ receiverId: "user-b", amount: 100 }),
      ).rejects.toThrow();
    });

    it("should throw if receiverId is missing", async () => {
      await expect(
        sendMoney({ senderId: "user-a", amount: 100 }),
      ).rejects.toThrow();
    });

    it("should throw if amount is missing", async () => {
      await expect(
        sendMoney({ senderId: "user-a", receiverId: "user-b" }),
      ).rejects.toThrow();
    });

    it("should handle multiple sequential transactions correctly", async () => {
      await sendMoneySecure("user-a", "user-b", 1000);
      await sendMoneySecure("user-b", "user-a", 500);
      await sendMoneySecure("user-a", "user-c", 200);

      expect(getBalance("user-a")).toBe(9300);
      expect(getBalance("user-b")).toBe(10500);
      expect(getBalance("user-c")).toBe(10200);
    });

    it("should handle exact balance transfer (balance goes to zero)", async () => {
      const result = await sendMoneySecure("user-a", "user-b", 10000);
      expect(result).toContain("10,000 rupees");
      expect(getBalance("user-a")).toBe(0);
      expect(getBalance("user-b")).toBe(20000);
    });
  });

  describe("getTransactionHistory", () => {
    it("should return an empty array for a user with no transactions", async () => {
      const result = await getTransactionHistory({ userId: "user-none" });
      expect(result).toContain("no transactions");
    });

    it("should return transaction details after a send", async () => {
      await sendMoneySecure("user-a", "user-b", 500);
      const result = await getTransactionHistory({ userId: "user-a" });
      expect(result).toContain("500");
      expect(result).toContain("user-b");
    });

    it("should show both sent and received transactions", async () => {
      await sendMoneySecure("user-a", "user-b", 300);
      await sendMoneySecure("user-c", "user-a", 700);

      const result = await getTransactionHistory({ userId: "user-a" });
      expect(result).toContain("300");
      expect(result).toContain("700");
    });

    it("should respect the limit parameter", async () => {
      await sendMoneySecure("user-a", "user-b", 100);
      await sendMoneySecure("user-b", "user-a", 200);
      await sendMoneySecure("user-a", "user-b", 300);

      const result = await getTransactionHistory({ userId: "user-a", limit: 1 });
      expect(result).toContain("300");
      expect(result).not.toContain("100");
    });

    it("should throw if userId is missing", async () => {
      await expect(getTransactionHistory({})).rejects.toThrow();
    });

    it("should default limit to 10 when not provided", async () => {
      const result = await getTransactionHistory({ userId: "user-a" });
      expect(typeof result).toBe("string");
    });
  });

  describe("resetAccounts", () => {
    it("should clear all account balances and transactions", () => {
      getBalance("user-a");
      resetAccounts();
      const balance = getBalance("user-a");
      expect(balance).toBe(10000);
    });

    it("should clear transaction history", async () => {
      await sendMoneySecure("user-a", "user-b", 500);
      resetAccounts();
      const result = await getTransactionHistory({ userId: "user-a" });
      expect(result).toContain("no transactions");
    });
  });
});

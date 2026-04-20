import { beforeEach, describe, expect, it } from "vitest";
import {
  setPin,
  verifyPin,
  resetPinStore,
} from "../src/services/pin.js";
import {
  confirmSendMoney,
  getBalance,
  initiateSendMoney,
  resetAccounts,
} from "../src/services/upi.js";

describe("PIN Service (src/services/pin.ts)", () => {
  beforeEach(() => {
    resetPinStore();
    resetAccounts();
  });

  it("uses default PIN 1234 when user has no PIN yet", () => {
    expect(verifyPin("pin-user-default", "1234")).toBe(true);
  });

  it("supports setting and verifying a custom PIN", () => {
    setPin("pin-user-custom", "4321");
    expect(verifyPin("pin-user-custom", "4321")).toBe(true);
    expect(verifyPin("pin-user-custom", "1234")).toBe(false);
  });

  it("rejects invalid PIN format during setPin", () => {
    expect(() => setPin("pin-user-bad", "12ab")).toThrow();
    expect(() => setPin("pin-user-bad", "123")).toThrow();
    expect(() => setPin("pin-user-bad", "12345")).toThrow();
  });

  it("rejects invalid PIN format during verifyPin", () => {
    expect(() => verifyPin("pin-user-bad-verify", "9")).toThrow();
  });

  describe("Two-step transfer flow", () => {
    it("initiates and confirms transfer with correct PIN", async () => {
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "bob",
        amount: 700,
      });
      expect(message).toContain("Please say your 4-digit PIN");

      const confirmation = await confirmSendMoney({
        senderId: "alice",
        pin: "1234",
      });
      expect(confirmation).toContain("Successfully sent 700 rupees");
      expect(getBalance("alice")).toBe(9300);
      expect(getBalance("bob")).toBe(10700);
    });

    it("fails on wrong PIN and reports remaining attempts", async () => {
      await initiateSendMoney({
        senderId: "pin-attempt-user",
        receiverId: "pin-attempt-receiver",
        amount: 200,
      });

      await expect(
        confirmSendMoney({
          senderId: "pin-attempt-user",
          pin: "9999",
        }),
      ).rejects.toThrow("Incorrect PIN. 2 attempts remaining.");
    });

    it("cancels pending transfer after 3 wrong PIN attempts", async () => {
      await initiateSendMoney({
        senderId: "pin-lock-user",
        receiverId: "pin-lock-receiver",
        amount: 200,
      });

      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
        }),
      ).rejects.toThrow("Incorrect PIN. 2 attempts remaining.");
      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
        }),
      ).rejects.toThrow("Incorrect PIN. 1 attempt remaining.");
      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
        }),
      ).rejects.toThrow(
        "Incorrect PIN. Maximum attempts reached. Pending transfer has been cancelled.",
      );

      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "1234",
        }),
      ).rejects.toThrow("No pending transfer found. Please initiate sendMoney first.");
    });

    it("rejects confirmation when no pending transfer exists", async () => {
      await expect(
        confirmSendMoney({
          senderId: "missing-pending-user",
          pin: "1234",
        }),
      ).rejects.toThrow("No pending transfer found. Please initiate sendMoney first.");
    });
  });
});

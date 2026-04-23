import { beforeEach, describe, expect, it } from "vitest";
import {
  setPin,
  changePin,
  hasPin,
  verifyPin,
  resetPinStore,
  NO_PIN_SET_ERROR,
} from "../src/services/pin.js";
import {
  confirmSendMoney,
  getBalance,
  initiateSendMoney,
  HIGH_VALUE_CONFIRMATION_ERROR_PREFIX,
  resetAccounts,
} from "../src/services/upi.js";

describe("PIN Service (src/services/pin.ts)", () => {
  beforeEach(() => {
    resetPinStore();
    resetAccounts();
  });

  it("requires users to set a PIN before verification", () => {
    expect(() => verifyPin("pin-user-default", "1234")).toThrow(NO_PIN_SET_ERROR);
  });

  it("supports setting and verifying a custom PIN", () => {
    setPin("pin-user-custom", "4321");
    expect(hasPin("pin-user-custom")).toBe(true);
    expect(verifyPin("pin-user-custom", "4321")).toBe(true);
    expect(verifyPin("pin-user-custom", "1234")).toBe(false);
  });

  it("supports changing PIN with current PIN validation", () => {
    setPin("pin-change-user", "2222");
    changePin("pin-change-user", "2222", "8888");

    expect(verifyPin("pin-change-user", "8888")).toBe(true);
    expect(verifyPin("pin-change-user", "2222")).toBe(false);
  });

  it("rejects PIN change when no PIN exists", () => {
    expect(() =>
      changePin("pin-change-missing", "1111", "2222"),
    ).toThrow(NO_PIN_SET_ERROR);
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
    it("requires PIN setup before initiating transfer", async () => {
      await expect(
        initiateSendMoney({
          senderId: "pin-missing-user",
          receiverId: "pin-missing-receiver",
          amount: 700,
        }),
      ).rejects.toThrow(NO_PIN_SET_ERROR);
    });

    it("initiates and confirms transfer with correct PIN", async () => {
      setPin("alice", "1234");
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "bob",
        amount: 700,
      });
      expect(message).toContain("4-digit PIN");

      const confirmation = await confirmSendMoney({
        senderId: "alice",
        pin: "1234",
        newPayeeConfirmed: true,
      });
      expect(confirmation).toContain("Successfully sent 700 rupees");
      expect(getBalance("alice")).toBe(9300);
      expect(getBalance("bob")).toBe(10700);
    });

    it("fails on wrong PIN and reports remaining attempts", async () => {
      setPin("pin-attempt-user", "1234");
      await initiateSendMoney({
        senderId: "pin-attempt-user",
        receiverId: "pin-attempt-receiver",
        amount: 200,
      });

      await expect(
        confirmSendMoney({
          senderId: "pin-attempt-user",
          pin: "9999",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow("Incorrect PIN. 2 attempts remaining.");
    });

    it("cancels pending transfer after 3 wrong PIN attempts", async () => {
      setPin("pin-lock-user", "1234");
      await initiateSendMoney({
        senderId: "pin-lock-user",
        receiverId: "pin-lock-receiver",
        amount: 200,
      });

      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow("Incorrect PIN. 2 attempts remaining.");
      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow("Incorrect PIN. 1 attempt remaining.");
      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "0000",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow(
        "Incorrect PIN. Maximum attempts reached. Pending transfer has been cancelled.",
      );

      await expect(
        confirmSendMoney({
          senderId: "pin-lock-user",
          pin: "1234",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow("No pending transfer found. Please initiate sendMoney first.");
    });

    it("rejects confirmation when no pending transfer exists", async () => {
      setPin("missing-pending-user", "1234");
      await expect(
        confirmSendMoney({
          senderId: "missing-pending-user",
          pin: "1234",
        }),
      ).rejects.toThrow("No pending transfer found. Please initiate sendMoney first.");
    });

    it("requires exact amount confirmation for high-value transfer", async () => {
      setPin("high-value-user", "1234");
      await initiateSendMoney({
        senderId: "high-value-user",
        receiverId: "high-value-receiver",
        amount: 2500,
      });

      await expect(
        confirmSendMoney({
          senderId: "high-value-user",
          pin: "1234",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow(HIGH_VALUE_CONFIRMATION_ERROR_PREFIX);

      const confirmation = await confirmSendMoney({
        senderId: "high-value-user",
        pin: "1234",
        amountConfirmation: 2500,
        newPayeeConfirmed: true,
      });
      expect(confirmation).toContain("Successfully sent 2,500 rupees");
      expect(getBalance("high-value-user")).toBe(7500);
      expect(getBalance("high-value-receiver")).toBe(12500);
    });
  });
});

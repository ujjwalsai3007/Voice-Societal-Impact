import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkVelocity,
  recordTransaction,
  resetFraudState,
  VELOCITY_WINDOW_MS,
  VELOCITY_MAX_TXN,
} from "../src/services/fraud.js";
import { resetAccounts, sendMoney } from "../src/services/upi.js";
import { setPin } from "../src/services/pin.js";

describe("Fraud Velocity Checks (src/services/fraud.ts)", () => {
  beforeEach(() => {
    resetFraudState();
    resetAccounts();
  });

  it("allows the first 2 transactions and blocks on the 3rd attempt", () => {
    const userId = "fraud-user-1";

    const first = checkVelocity(userId);
    expect(first.allowed).toBe(true);
    recordTransaction(userId);

    const second = checkVelocity(userId);
    expect(second.allowed).toBe(true);
    recordTransaction(userId);

    const third = checkVelocity(userId);
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain("too many transactions");
  });

  it("re-allows transactions after the velocity window expires", () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);

    const userId = "fraud-user-2";
    recordTransaction(userId);
    recordTransaction(userId);
    expect(checkVelocity(userId).allowed).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + VELOCITY_WINDOW_MS + 1));
    expect(checkVelocity(userId).allowed).toBe(true);

    vi.useRealTimers();
  });

  it("exports the expected threshold constants", () => {
    expect(VELOCITY_WINDOW_MS).toBe(5 * 60 * 1000);
    expect(VELOCITY_MAX_TXN).toBe(3);
  });

  it("blocks through sendMoney when sender crosses velocity threshold", async () => {
    setPin("fraud-sender", "1234");
    await sendMoney({
      senderId: "fraud-sender",
      receiverId: "fraud-receiver",
      amount: 100,
      pin: "1234",
    });
    await sendMoney({
      senderId: "fraud-sender",
      receiverId: "fraud-receiver",
      amount: 100,
      pin: "1234",
    });

    await expect(
      sendMoney({
        senderId: "fraud-sender",
        receiverId: "fraud-receiver",
        amount: 100,
        pin: "1234",
      }),
    ).rejects.toThrow(
      "Transaction blocked: too many transactions in a short period. Please wait a few minutes.",
    );
  });
});

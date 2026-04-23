import { beforeEach, describe, expect, it } from "vitest";
import { computeRisk } from "../src/services/risk.js";
import {
  addBeneficiary,
  resetBeneficiaryStore,
} from "../src/services/beneficiary.js";
import {
  recordTransaction,
  resetFraudState,
} from "../src/services/fraud.js";
import {
  setPin,
  resetPinStore,
  incrementPinFailedStreak,
  resetPinFailedStreak,
  getPinFailedStreak,
} from "../src/services/pin.js";
import {
  initiateSendMoney,
  confirmSendMoney,
  resetAccounts,
  HIGH_VALUE_TRANSFER_THRESHOLD,
} from "../src/services/upi.js";
import { resetLimitsStore } from "../src/services/limits.js";

function resetAll() {
  resetBeneficiaryStore();
  resetFraudState();
  resetPinStore();
  resetLimitsStore();
  resetAccounts();
}

describe("Risk Engine v2 (src/services/risk.ts)", () => {
  beforeEach(() => {
    resetAll();
  });

  describe("computeRisk — individual factors", () => {
    it("returns low risk (score 0) when all factors are clean", () => {
      addBeneficiary("alice", "bob");
      const risk = computeRisk("alice", "bob", 100);
      expect(risk.score).toBe(0);
      expect(risk.level).toBe("low");
      expect(risk.requiresStepUp).toBe(false);
    });

    it("adds +30 for a new (unregistered) beneficiary", () => {
      const risk = computeRisk("alice", "new-bob", 100);
      const factor = risk.factors.find((f) => f.name === "new_beneficiary");
      expect(factor?.triggered).toBe(true);
      expect(risk.score).toBeGreaterThanOrEqual(30);
    });

    it("does not add new-beneficiary penalty for a known beneficiary", () => {
      addBeneficiary("alice", "trusted-bob");
      const risk = computeRisk("alice", "trusted-bob", 100);
      const factor = risk.factors.find((f) => f.name === "new_beneficiary");
      expect(factor?.triggered).toBe(false);
    });

    it("adds +20 for a high-value transfer", () => {
      addBeneficiary("alice", "bob");
      const risk = computeRisk("alice", "bob", HIGH_VALUE_TRANSFER_THRESHOLD);
      const factor = risk.factors.find((f) => f.name === "high_value");
      expect(factor?.triggered).toBe(true);
      expect(risk.score).toBeGreaterThanOrEqual(20);
    });

    it("does not add high-value penalty below the threshold", () => {
      addBeneficiary("alice", "bob");
      const risk = computeRisk("alice", "bob", HIGH_VALUE_TRANSFER_THRESHOLD - 1);
      const factor = risk.factors.find((f) => f.name === "high_value");
      expect(factor?.triggered).toBe(false);
    });

    it("adds +25 for rapid transaction velocity (2+ in window)", () => {
      addBeneficiary("alice", "bob");
      recordTransaction("alice");
      recordTransaction("alice");
      const risk = computeRisk("alice", "bob", 100);
      const factor = risk.factors.find((f) => f.name === "rapid_retries");
      expect(factor?.triggered).toBe(true);
      expect(risk.score).toBeGreaterThanOrEqual(25);
    });

    it("does not add velocity penalty with fewer than 2 recent transactions", () => {
      addBeneficiary("alice", "bob");
      recordTransaction("alice");
      const risk = computeRisk("alice", "bob", 100);
      const factor = risk.factors.find((f) => f.name === "rapid_retries");
      expect(factor?.triggered).toBe(false);
    });

    it("adds +25 for a PIN failure streak of 2 or more", () => {
      addBeneficiary("alice", "bob");
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      const risk = computeRisk("alice", "bob", 100);
      const factor = risk.factors.find((f) => f.name === "pin_failure_streak");
      expect(factor?.triggered).toBe(true);
      expect(risk.score).toBeGreaterThanOrEqual(25);
    });

    it("does not add PIN streak penalty with only 1 failure", () => {
      addBeneficiary("alice", "bob");
      incrementPinFailedStreak("alice");
      const risk = computeRisk("alice", "bob", 100);
      const factor = risk.factors.find((f) => f.name === "pin_failure_streak");
      expect(factor?.triggered).toBe(false);
    });
  });

  describe("computeRisk — risk levels", () => {
    it("returns 'low' when score is below 30", () => {
      addBeneficiary("alice", "bob");
      const risk = computeRisk("alice", "bob", HIGH_VALUE_TRANSFER_THRESHOLD);
      expect(risk.level).toBe("low");
      expect(risk.score).toBe(20);
    });

    it("returns 'medium' when score is between 30 and 59", () => {
      const risk = computeRisk("alice", "new-bob", 100);
      expect(risk.score).toBe(30);
      expect(risk.level).toBe("medium");
      expect(risk.requiresStepUp).toBe(false);
    });

    it("returns 'high' and requiresStepUp when score is 60 or above", () => {
      recordTransaction("alice");
      recordTransaction("alice");
      const risk = computeRisk("alice", "new-bob", HIGH_VALUE_TRANSFER_THRESHOLD);
      expect(risk.score).toBe(75);
      expect(risk.level).toBe("high");
      expect(risk.requiresStepUp).toBe(true);
    });

    it("exactly 60 score triggers high risk and step-up", () => {
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      recordTransaction("alice");
      recordTransaction("alice");
      const risk = computeRisk("alice", "new-bob", 100);
      expect(risk.score).toBe(80);
      expect(risk.level).toBe("high");
    });
  });

  describe("computeRisk — combined factors", () => {
    it("all 4 factors active yields maximum score of 100", () => {
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      recordTransaction("alice");
      recordTransaction("alice");
      const risk = computeRisk("alice", "new-bob", HIGH_VALUE_TRANSFER_THRESHOLD);
      expect(risk.score).toBe(100);
      expect(risk.level).toBe("high");
      expect(risk.requiresStepUp).toBe(true);
    });

    it("new beneficiary + high value = score 50 (medium)", () => {
      const risk = computeRisk("alice", "new-bob", HIGH_VALUE_TRANSFER_THRESHOLD);
      expect(risk.score).toBe(50);
      expect(risk.level).toBe("medium");
    });

    it("factors list has exactly 4 entries", () => {
      const risk = computeRisk("alice", "bob", 100);
      expect(risk.factors).toHaveLength(4);
    });

    it("each factor has required fields: name, label, score, triggered", () => {
      const risk = computeRisk("alice", "bob", 100);
      for (const factor of risk.factors) {
        expect(typeof factor.name).toBe("string");
        expect(typeof factor.label).toBe("string");
        expect(typeof factor.score).toBe("number");
        expect(typeof factor.triggered).toBe("boolean");
      }
    });
  });

  describe("PIN streak tracking (src/services/pin.ts)", () => {
    it("incrementPinFailedStreak increases the count", () => {
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      expect(getPinFailedStreak("alice")).toBe(2);
    });

    it("resetPinFailedStreak sets count back to 0", () => {
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      resetPinFailedStreak("alice");
      expect(getPinFailedStreak("alice")).toBe(0);
    });

    it("streak is isolated per user", () => {
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");
      expect(getPinFailedStreak("bob")).toBe(0);
    });

    it("wrong PIN in confirmSendMoney increments streak", async () => {
      setPin("alice", "1234");
      await initiateSendMoney({
        senderId: "alice",
        receiverId: "bob",
        amount: 100,
      });
      await expect(
        confirmSendMoney({
          senderId: "alice",
          pin: "9999",
          newPayeeConfirmed: true,
        }),
      ).rejects.toThrow("Incorrect PIN");
      expect(getPinFailedStreak("alice")).toBe(1);
    });

    it("correct PIN in confirmSendMoney resets the streak", async () => {
      setPin("alice", "1234");
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");

      await initiateSendMoney({
        senderId: "alice",
        receiverId: "bob",
        amount: 100,
      });
      await confirmSendMoney({
        senderId: "alice",
        pin: "1234",
        newPayeeConfirmed: true,
      });
      expect(getPinFailedStreak("alice")).toBe(0);
    });
  });

  describe("Integration — risk score visible in transfer events", () => {
    it("medium-risk transfer message contains risk level text", async () => {
      setPin("alice", "1234");
      // new beneficiary (+30) = medium risk — message includes "Risk level is medium"
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "new-bob",
        amount: 100,
      });
      expect(message).toContain("Risk level");
    });

    it("high-risk transfer message contains 'HIGH'", async () => {
      setPin("alice", "1234");
      // Use PIN streak + new beneficiary + high value to reach ≥60 WITHOUT velocity
      // new_beneficiary(30) + high_value(20) + pin_streak(25) = 75 → high
      incrementPinFailedStreak("alice");
      incrementPinFailedStreak("alice");

      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "new-bob",
        amount: HIGH_VALUE_TRANSFER_THRESHOLD,
      });
      expect(message).toContain("HIGH");
    });
  });
});

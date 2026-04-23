import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkLimits,
  recordLimitUsage,
  getLimitUsage,
  getAllLimitUsage,
  resetLimitsStore,
  PER_TX_LIMIT,
  DAILY_LIMIT,
  PER_BENEFICIARY_DAILY_CAP,
} from "../src/services/limits.js";
import {
  initiateSendMoney,
  resetAccounts,
} from "../src/services/upi.js";
import { setPin } from "../src/services/pin.js";

describe("Transaction Limits (src/services/limits.ts)", () => {
  beforeEach(() => {
    resetLimitsStore();
    resetAccounts();
  });

  describe("constants", () => {
    it("exports expected limit values", () => {
      expect(PER_TX_LIMIT).toBe(10_000);
      expect(DAILY_LIMIT).toBe(25_000);
      expect(PER_BENEFICIARY_DAILY_CAP).toBe(15_000);
    });
  });

  describe("checkLimits — per-transaction cap", () => {
    it("allows a transfer at exactly the per-tx limit", () => {
      const result = checkLimits("alice", PER_TX_LIMIT, "bob");
      expect(result.allowed).toBe(true);
    });

    it("blocks a transfer one rupee over the per-tx limit", () => {
      const result = checkLimits("alice", PER_TX_LIMIT + 1, "bob");
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("per_transaction");
      expect(result.reason).toContain("per-transaction limit");
    });

    it("returns the correct used/limit fields for per-tx breach", () => {
      const amount = PER_TX_LIMIT + 500;
      const result = checkLimits("alice", amount, "bob");
      expect(result.used).toBe(amount);
      expect(result.limit).toBe(PER_TX_LIMIT);
    });
  });

  describe("checkLimits — daily total cap", () => {
    it("allows transfers that stay within the daily limit", () => {
      recordLimitUsage("alice", 5_000, "bob");
      recordLimitUsage("alice", 5_000, "charlie");
      const result = checkLimits("alice", 5_000, "dave");
      expect(result.allowed).toBe(true);
    });

    it("blocks a transfer that would exceed the daily limit", () => {
      recordLimitUsage("alice", 10_000, "bob");
      recordLimitUsage("alice", 10_000, "charlie");
      const result = checkLimits("alice", 10_000, "dave");
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("daily_total");
      expect(result.reason).toContain("Daily transfer limit");
    });

    it("allows transfer up to exactly the daily limit", () => {
      recordLimitUsage("alice", 15_000, "bob");
      const result = checkLimits("alice", 10_000, "charlie");
      expect(result.allowed).toBe(true);
    });

    it("blocks transfer one rupee over the daily limit", () => {
      // Use 24_000 pre-recorded so any amount > 1_000 exceeds daily limit
      // and stays well under PER_TX_LIMIT (10_000)
      recordLimitUsage("alice", 24_000, "bob");
      const result = checkLimits("alice", 1_001, "charlie");
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("daily_total");
    });

    it("limit usage is isolated between users", () => {
      recordLimitUsage("alice", 24_000, "bob");
      // Use a safe amount below per-tx limit
      const carolResult = checkLimits("carol", 5_000, "dave");
      expect(carolResult.allowed).toBe(true);
    });

    it("resets after the 24-hour window", () => {
      vi.useFakeTimers();
      const start = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(start);

      recordLimitUsage("alice", 24_000, "bob");
      expect(checkLimits("alice", 5_000, "charlie").allowed).toBe(false);

      vi.setSystemTime(new Date(start.getTime() + 24 * 60 * 60 * 1000 + 1));
      expect(checkLimits("alice", 5_000, "charlie").allowed).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("checkLimits — per-beneficiary daily cap", () => {
    it("allows transfers to a beneficiary within the daily cap", () => {
      recordLimitUsage("alice", 5_000, "bob");
      const result = checkLimits("alice", 5_000, "bob");
      expect(result.allowed).toBe(true);
    });

    it("blocks when cumulative spend to one payee exceeds the cap", () => {
      recordLimitUsage("alice", 10_000, "bob");
      const result = checkLimits("alice", 5_001, "bob");
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("per_beneficiary");
      expect(result.reason).toContain("bob");
    });

    it("cap is per-beneficiary — spending on bob does not affect charlie cap", () => {
      recordLimitUsage("alice", 14_999, "bob");
      const result = checkLimits("alice", 500, "charlie");
      expect(result.allowed).toBe(true);
    });

    it("returns correct used/limit for per-beneficiary breach", () => {
      recordLimitUsage("alice", 12_000, "bob");
      const result = checkLimits("alice", 5_000, "bob");
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(12_000);
      expect(result.limit).toBe(PER_BENEFICIARY_DAILY_CAP);
    });
  });

  describe("getLimitUsage", () => {
    it("returns zeroed usage for a fresh user", () => {
      const usage = getLimitUsage("new-user");
      expect(usage.dailyUsed).toBe(0);
      expect(usage.dailyLimit).toBe(DAILY_LIMIT);
      expect(usage.dailyRemaining).toBe(DAILY_LIMIT);
      expect(usage.perTxLimit).toBe(PER_TX_LIMIT);
      expect(usage.usagePercent).toBe(0);
    });

    it("reflects recorded usage correctly", () => {
      recordLimitUsage("alice", 10_000, "bob");
      const usage = getLimitUsage("alice");
      expect(usage.dailyUsed).toBe(10_000);
      expect(usage.dailyRemaining).toBe(15_000);
      expect(usage.usagePercent).toBe(40);
    });

    it("caps usagePercent at 100 when limit is reached", () => {
      recordLimitUsage("alice", DAILY_LIMIT, "bob");
      const usage = getLimitUsage("alice");
      expect(usage.usagePercent).toBe(100);
      expect(usage.dailyRemaining).toBe(0);
    });
  });

  describe("getAllLimitUsage", () => {
    it("returns an empty record when no usage has been recorded", () => {
      expect(getAllLimitUsage()).toEqual({});
    });

    it("returns usage for all users with activity", () => {
      recordLimitUsage("alice", 1_000, "bob");
      recordLimitUsage("carol", 2_000, "dave");
      const all = getAllLimitUsage();
      expect(all["alice"]).toBeDefined();
      expect(all["carol"]).toBeDefined();
      expect(all["alice"]!.dailyUsed).toBe(1_000);
      expect(all["carol"]!.dailyUsed).toBe(2_000);
    });
  });

  describe("resetLimitsStore", () => {
    it("clears all usage records", () => {
      recordLimitUsage("alice", 10_000, "bob");
      resetLimitsStore();
      expect(getLimitUsage("alice").dailyUsed).toBe(0);
      expect(getAllLimitUsage()).toEqual({});
    });
  });

  describe("Integration — limits checked during initiateSendMoney", () => {
    it("blocks initiateSendMoney when amount exceeds per-tx limit", async () => {
      setPin("high-limit-alice", "1234");
      // Give the user enough balance by doing a fake balance init first
      // PER_TX_LIMIT + 1 = 10_001. Default balance is 10_000, so insufficient funds would
      // fire UNLESS we check limits first (which we now do). The limit check is first.
      await expect(
        initiateSendMoney({
          senderId: "high-limit-alice",
          receiverId: "bob",
          amount: PER_TX_LIMIT + 1,
        }),
      ).rejects.toThrow(/per-transaction limit/i);
    });

    it("blocks initiateSendMoney when daily limit would be exceeded", async () => {
      setPin("alice", "1234");
      recordLimitUsage("alice", 20_000, "bob");
      recordLimitUsage("alice", 4_999, "charlie");
      await expect(
        initiateSendMoney({
          senderId: "alice",
          receiverId: "dave",
          amount: 100,
        }),
      ).rejects.toThrow(/Daily transfer limit/);
    });

    it("blocks when per-beneficiary cap would be exceeded", async () => {
      setPin("alice", "1234");
      recordLimitUsage("alice", 14_500, "bob");
      await expect(
        initiateSendMoney({
          senderId: "alice",
          receiverId: "bob",
          amount: 600,
        }),
      ).rejects.toThrow(/Daily cap/);
    });

    it("allows transfer when all limits are within bounds", async () => {
      setPin("alice", "1234");
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "bob",
        amount: 500,
      });
      expect(message).toContain("500 rupees");
    });
  });
});

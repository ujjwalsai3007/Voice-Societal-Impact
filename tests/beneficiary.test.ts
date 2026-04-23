import { beforeEach, describe, expect, it } from "vitest";
import {
  addBeneficiary,
  removeBeneficiary,
  listBeneficiaries,
  isBeneficiary,
  getBeneficiaryCount,
  getTotalBeneficiaryCount,
  getAllBeneficiaries,
  resetBeneficiaryStore,
} from "../src/services/beneficiary.js";
import {
  initiateSendMoney,
  confirmSendMoney,
  resetAccounts,
} from "../src/services/upi.js";
import { setPin } from "../src/services/pin.js";

describe("Beneficiary Service (src/services/beneficiary.ts)", () => {
  beforeEach(() => {
    resetBeneficiaryStore();
    resetAccounts();
  });

  describe("isBeneficiary", () => {
    it("returns false for a user with no beneficiaries", () => {
      expect(isBeneficiary("alice", "bob")).toBe(false);
    });

    it("returns true after adding a beneficiary", () => {
      addBeneficiary("alice", "bob");
      expect(isBeneficiary("alice", "bob")).toBe(true);
    });

    it("is user-scoped — alice trusting bob does not mean bob trusts alice", () => {
      addBeneficiary("alice", "bob");
      expect(isBeneficiary("bob", "alice")).toBe(false);
    });

    it("is beneficiary-scoped — alice trusting bob does not affect alice trusting charlie", () => {
      addBeneficiary("alice", "bob");
      expect(isBeneficiary("alice", "charlie")).toBe(false);
    });
  });

  describe("addBeneficiary", () => {
    it("adds a beneficiary and reflects in listBeneficiaries", () => {
      addBeneficiary("alice", "bob");
      const list = listBeneficiaries("alice");
      expect(list).toHaveLength(1);
      expect(list[0]!.beneficiaryId).toBe("bob");
      expect(list[0]!.userId).toBe("alice");
    });

    it("records an addedAt timestamp", () => {
      const before = new Date().toISOString();
      addBeneficiary("alice", "bob");
      const after = new Date().toISOString();
      const record = listBeneficiaries("alice")[0]!;
      expect(record.addedAt >= before).toBe(true);
      expect(record.addedAt <= after).toBe(true);
    });

    it("is idempotent — adding same beneficiary twice does not duplicate", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("alice", "bob");
      expect(listBeneficiaries("alice")).toHaveLength(1);
      expect(getBeneficiaryCount("alice")).toBe(1);
    });

    it("supports multiple beneficiaries per user", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("alice", "charlie");
      addBeneficiary("alice", "dave");
      expect(getBeneficiaryCount("alice")).toBe(3);
    });

    it("isolates beneficiaries between users", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("carol", "dave");
      expect(getBeneficiaryCount("alice")).toBe(1);
      expect(getBeneficiaryCount("carol")).toBe(1);
      expect(listBeneficiaries("alice").map((b) => b.beneficiaryId)).not.toContain("dave");
    });
  });

  describe("removeBeneficiary", () => {
    it("removes an existing beneficiary and returns true", () => {
      addBeneficiary("alice", "bob");
      const removed = removeBeneficiary("alice", "bob");
      expect(removed).toBe(true);
      expect(isBeneficiary("alice", "bob")).toBe(false);
      expect(listBeneficiaries("alice")).toHaveLength(0);
    });

    it("returns false when trying to remove a non-existent beneficiary", () => {
      const removed = removeBeneficiary("alice", "ghost");
      expect(removed).toBe(false);
    });

    it("only removes the specified beneficiary, not others", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("alice", "charlie");
      removeBeneficiary("alice", "bob");
      expect(isBeneficiary("alice", "bob")).toBe(false);
      expect(isBeneficiary("alice", "charlie")).toBe(true);
    });

    it("can re-add a beneficiary after removal", () => {
      addBeneficiary("alice", "bob");
      removeBeneficiary("alice", "bob");
      addBeneficiary("alice", "bob");
      expect(isBeneficiary("alice", "bob")).toBe(true);
    });
  });

  describe("listBeneficiaries", () => {
    it("returns an empty array for a user with no beneficiaries", () => {
      expect(listBeneficiaries("nobody")).toEqual([]);
    });

    it("returns all added beneficiaries for a user", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("alice", "charlie");
      const ids = listBeneficiaries("alice").map((b) => b.beneficiaryId);
      expect(ids).toContain("bob");
      expect(ids).toContain("charlie");
    });
  });

  describe("getTotalBeneficiaryCount / getAllBeneficiaries", () => {
    it("counts beneficiaries across all users", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("alice", "charlie");
      addBeneficiary("dave", "eve");
      expect(getTotalBeneficiaryCount()).toBe(3);
    });

    it("getAllBeneficiaries returns all records across all users", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("dave", "eve");
      const all = getAllBeneficiaries();
      expect(all).toHaveLength(2);
      const userIds = all.map((b) => b.userId);
      expect(userIds).toContain("alice");
      expect(userIds).toContain("dave");
    });
  });

  describe("resetBeneficiaryStore", () => {
    it("clears all beneficiaries", () => {
      addBeneficiary("alice", "bob");
      addBeneficiary("dave", "eve");
      resetBeneficiaryStore();
      expect(getTotalBeneficiaryCount()).toBe(0);
      expect(isBeneficiary("alice", "bob")).toBe(false);
    });
  });

  describe("Integration with transfer flow", () => {
    it("new-payee warning appears when receiver is not a beneficiary", async () => {
      setPin("alice", "1234");
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "new-bob",
        amount: 200,
      });
      expect(message).toContain("New payee alert");
      expect(message).toContain("new-bob");
    });

    it("no new-payee warning when receiver is already a beneficiary", async () => {
      setPin("alice", "1234");
      addBeneficiary("alice", "trusted-bob");
      const message = await initiateSendMoney({
        senderId: "alice",
        receiverId: "trusted-bob",
        amount: 200,
      });
      expect(message).not.toContain("New payee alert");
    });

    it("confirmSendMoney rejects if new payee is not confirmed", async () => {
      setPin("alice", "1234");
      await initiateSendMoney({
        senderId: "alice",
        receiverId: "unconfirmed-bob",
        amount: 300,
      });
      await expect(
        confirmSendMoney({
          senderId: "alice",
          pin: "1234",
        }),
      ).rejects.toThrow("new payee");
    });

    it("auto-adds receiver as beneficiary after a successful confirmed transfer", async () => {
      setPin("alice", "1234");
      expect(isBeneficiary("alice", "auto-bob")).toBe(false);

      await initiateSendMoney({
        senderId: "alice",
        receiverId: "auto-bob",
        amount: 300,
      });
      await confirmSendMoney({
        senderId: "alice",
        pin: "1234",
        newPayeeConfirmed: true,
      });

      expect(isBeneficiary("alice", "auto-bob")).toBe(true);
    });

    it("second transfer to same payee has no new-payee warning", async () => {
      setPin("alice", "1234");

      await initiateSendMoney({ senderId: "alice", receiverId: "repeat-bob", amount: 100 });
      await confirmSendMoney({ senderId: "alice", pin: "1234", newPayeeConfirmed: true });

      const secondMessage = await initiateSendMoney({
        senderId: "alice",
        receiverId: "repeat-bob",
        amount: 100,
      });
      expect(secondMessage).not.toContain("New payee alert");
    });
  });
});

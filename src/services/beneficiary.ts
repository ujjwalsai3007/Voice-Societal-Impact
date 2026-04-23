import { logEvent } from "./event-store.js";

export interface BeneficiaryRecord {
  userId: string;
  beneficiaryId: string;
  addedAt: string;
}

const beneficiaryStore = new Map<string, Set<string>>();
const beneficiaryMeta = new Map<string, BeneficiaryRecord>();

function metaKey(userId: string, beneficiaryId: string): string {
  return `${userId}:${beneficiaryId}`;
}

export function isBeneficiary(userId: string, beneficiaryId: string): boolean {
  return beneficiaryStore.get(userId)?.has(beneficiaryId) ?? false;
}

export function addBeneficiary(userId: string, beneficiaryId: string): void {
  if (isBeneficiary(userId, beneficiaryId)) return;

  if (!beneficiaryStore.has(userId)) {
    beneficiaryStore.set(userId, new Set());
  }
  beneficiaryStore.get(userId)!.add(beneficiaryId);
  beneficiaryMeta.set(metaKey(userId, beneficiaryId), {
    userId,
    beneficiaryId,
    addedAt: new Date().toISOString(),
  });

  logEvent("beneficiary", userId, {
    action: "beneficiary_added",
    beneficiaryId,
    status: "success",
  });
}

export function removeBeneficiary(userId: string, beneficiaryId: string): boolean {
  if (!isBeneficiary(userId, beneficiaryId)) return false;

  beneficiaryStore.get(userId)!.delete(beneficiaryId);
  beneficiaryMeta.delete(metaKey(userId, beneficiaryId));

  logEvent("beneficiary", userId, {
    action: "beneficiary_removed",
    beneficiaryId,
    status: "success",
  });

  return true;
}

export function listBeneficiaries(userId: string): BeneficiaryRecord[] {
  const ids = beneficiaryStore.get(userId);
  if (!ids || ids.size === 0) return [];

  return [...ids].map(
    (beneficiaryId) =>
      beneficiaryMeta.get(metaKey(userId, beneficiaryId)) ?? {
        userId,
        beneficiaryId,
        addedAt: "unknown",
      },
  );
}

export function getBeneficiaryCount(userId: string): number {
  return beneficiaryStore.get(userId)?.size ?? 0;
}

export function getTotalBeneficiaryCount(): number {
  let total = 0;
  for (const set of beneficiaryStore.values()) {
    total += set.size;
  }
  return total;
}

export function getAllBeneficiaries(): BeneficiaryRecord[] {
  return [...beneficiaryMeta.values()];
}

export function resetBeneficiaryStore(): void {
  beneficiaryStore.clear();
  beneficiaryMeta.clear();
}

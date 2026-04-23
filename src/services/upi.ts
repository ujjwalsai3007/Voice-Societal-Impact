import { z } from "zod/v4";
import { logger } from "../lib/logger.js";
import { upsertMemory } from "./memory.js";
import { checkVelocity, recordTransaction, resetFraudState } from "./fraud.js";
import {
  verifyPin,
  resetPinStore,
  hasPin,
  NO_PIN_SET_ERROR,
  incrementPinFailedStreak,
  resetPinFailedStreak,
} from "./pin.js";
import { logEvent } from "./event-store.js";
import {
  isBeneficiary,
  addBeneficiary,
  resetBeneficiaryStore,
} from "./beneficiary.js";
import {
  checkLimits,
  recordLimitUsage,
  resetLimitsStore,
} from "./limits.js";
import { computeRisk } from "./risk.js";

const DEFAULT_BALANCE = 10000;
const MAX_PIN_ATTEMPTS = 3;
export const HIGH_VALUE_TRANSFER_THRESHOLD = 2000;
export const HIGH_VALUE_CONFIRMATION_ERROR_PREFIX =
  "High-value transfer verification failed.";

const TX_BLOCKED_MESSAGE =
  "Transaction blocked: too many transactions in a short period. Please wait a few minutes.";

export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  timestamp: string;
  riskScore?: number;
  riskLevel?: string;
}

function spokenRupees(amount: number): string {
  const formatted = amount.toString().replace(/\B(?=(\d{2})*\d{3}(?!\d))/g, ",");
  return `${formatted} rupees`;
}

const accounts = new Map<string, number>();
const ledger: Transaction[] = [];
let txCounter = 0;

export interface PendingTransaction {
  senderId: string;
  receiverId: string;
  amount: number;
  groupId: string;
  pinAttempts: number;
  requiresAmountConfirmation: boolean;
  requiresNewPayeeConfirmation: boolean;
  riskScore: number;
  riskLevel: string;
  initiatedAt: string;
}

const pendingTransfers = new Map<string, PendingTransaction>();

export function getBalance(userId: string): number {
  if (!accounts.has(userId)) {
    accounts.set(userId, DEFAULT_BALANCE);
  }
  return accounts.get(userId)!;
}

export function resetAccounts(): void {
  accounts.clear();
  ledger.length = 0;
  txCounter = 0;
  pendingTransfers.clear();
  resetFraudState();
  resetPinStore();
  resetBeneficiaryStore();
  resetLimitsStore();
}

const checkBalanceSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export async function checkBalance(
  params: Record<string, unknown>,
): Promise<string> {
  const { userId } = checkBalanceSchema.parse(params);
  const balance = getBalance(userId);
  logger.info({ userId, balance }, "Balance checked");
  logEvent("transaction", userId, {
    action: "balance_check",
    balance,
    status: "success",
  });
  return `Account ${userId} has a balance of ${spokenRupees(balance)}.`;
}

const transferBaseSchema = z.object({
  senderId: z.string().min(1, "senderId is required"),
  receiverId: z.string().min(1, "receiverId is required"),
  amount: z.number().positive("Amount must be greater than zero"),
  groupId: z.string().min(1).optional(),
});

const sendMoneySchema = transferBaseSchema.extend({
  pin: z.string(),
  amountConfirmation: z.number().positive().optional(),
});

const initiateSendMoneySchema = transferBaseSchema;

const confirmSendMoneySchema = z.object({
  senderId: z.string().min(1, "senderId is required"),
  pin: z.string(),
  amountConfirmation: z.number().positive().optional(),
  newPayeeConfirmed: z.boolean().optional(),
});

function assertVelocityAllowed(senderId: string): void {
  const velocity = checkVelocity(senderId);
  if (!velocity.allowed) {
    throw new Error(velocity.reason ?? TX_BLOCKED_MESSAGE);
  }
}

function assertCanTransfer(
  senderId: string,
  receiverId: string,
  amount: number,
): void {
  if (senderId === receiverId) {
    throw new Error("Cannot transfer to the same account");
  }

  const senderBalance = getBalance(senderId);
  if (senderBalance < amount) {
    throw new Error(
      `Insufficient funds: ${senderId} has ${spokenRupees(senderBalance)} but tried to send ${spokenRupees(amount)}`,
    );
  }
}

function requiresHighValueConfirmation(amount: number): boolean {
  return amount >= HIGH_VALUE_TRANSFER_THRESHOLD;
}

function assertHighValueAmountConfirmation(
  amount: number,
  amountConfirmation: number | undefined,
): void {
  if (!requiresHighValueConfirmation(amount)) return;

  if (amountConfirmation !== amount) {
    throw new Error(
      `${HIGH_VALUE_CONFIRMATION_ERROR_PREFIX} Please confirm the exact amount of ${spokenRupees(amount)} along with your PIN.`,
    );
  }
}

async function executeTransfer(transfer: {
  senderId: string;
  receiverId: string;
  amount: number;
  groupId?: string;
  riskScore?: number;
  riskLevel?: string;
}): Promise<string> {
  const { senderId, receiverId, amount, groupId, riskScore, riskLevel } = transfer;
  assertCanTransfer(senderId, receiverId, amount);

  const senderBalance = getBalance(senderId);
  accounts.set(senderId, senderBalance - amount);
  accounts.set(receiverId, getBalance(receiverId) + amount);

  txCounter += 1;
  const tx: Transaction = {
    id: `txn-${txCounter}`,
    senderId,
    receiverId,
    amount,
    timestamp: new Date().toISOString(),
    riskScore,
    riskLevel,
  };
  ledger.push(tx);

  recordTransaction(senderId);
  recordLimitUsage(senderId, amount, receiverId);

  logEvent("transaction", senderId, {
    action: "transfer",
    status: "success",
    txId: tx.id,
    senderId,
    receiverId,
    amount,
    groupId: groupId ?? "default",
    riskScore: riskScore ?? 0,
    riskLevel: riskLevel ?? "low",
  });

  logger.info({ txId: tx.id, senderId, receiverId, amount }, "Money transferred");

  const memoryText = `Sent ${spokenRupees(amount)} from ${senderId} to ${receiverId} on ${tx.timestamp}. Transaction ID: ${tx.id}.`;
  upsertMemory(senderId, memoryText, { category: "transaction", txId: tx.id }, groupId).catch(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ txId: tx.id, error: msg }, "Failed to store transaction memory for sender");
    },
  );
  upsertMemory(receiverId, memoryText, { category: "transaction", txId: tx.id }, groupId).catch(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error({ txId: tx.id, error: msg }, "Failed to store transaction memory for receiver");
    },
  );

  return `Successfully sent ${spokenRupees(amount)} from ${senderId} to ${receiverId}. New balance for ${senderId} is ${spokenRupees(getBalance(senderId))}.`;
}

export async function sendMoney(
  params: Record<string, unknown>,
): Promise<string> {
  const transfer = sendMoneySchema.parse(params);
  if (!hasPin(transfer.senderId)) {
    throw new Error(NO_PIN_SET_ERROR);
  }

  assertHighValueAmountConfirmation(transfer.amount, transfer.amountConfirmation);
  assertVelocityAllowed(transfer.senderId);

  const verified = verifyPin(transfer.senderId, transfer.pin);
  if (!verified) {
    throw new Error("Incorrect PIN.");
  }

  return executeTransfer(transfer);
}

export async function initiateSendMoney(
  params: Record<string, unknown>,
): Promise<string> {
  const { senderId, receiverId, amount, groupId } =
    initiateSendMoneySchema.parse(params);

  if (!hasPin(senderId)) {
    logEvent("transaction", senderId, {
      action: "transfer_initiated",
      status: "failed",
      reason: "pin_not_set",
      receiverId,
      amount,
      groupId: groupId ?? "default",
    });
    throw new Error(NO_PIN_SET_ERROR);
  }

  const limitCheck = checkLimits(senderId, amount, receiverId);
  if (!limitCheck.allowed) {
    logEvent("transaction", senderId, {
      action: "transfer_initiated",
      status: "failed",
      reason: "limit_exceeded",
      limitType: limitCheck.limitType,
      receiverId,
      amount,
    });
    throw new Error(limitCheck.reason ?? "Transfer limit exceeded.");
  }

  assertVelocityAllowed(senderId);
  assertCanTransfer(senderId, receiverId, amount);

  if (pendingTransfers.has(senderId)) {
    throw new Error(
      "A transfer is already pending PIN confirmation for this user.",
    );
  }

  const risk = computeRisk(senderId, receiverId, amount);
  const isNewPayee = !isBeneficiary(senderId, receiverId);

  pendingTransfers.set(senderId, {
    senderId,
    receiverId,
    amount,
    groupId: groupId ?? "default",
    pinAttempts: 0,
    requiresAmountConfirmation: requiresHighValueConfirmation(amount),
    requiresNewPayeeConfirmation: isNewPayee,
    riskScore: risk.score,
    riskLevel: risk.level,
    initiatedAt: new Date().toISOString(),
  });

  logEvent("transaction", senderId, {
    action: "transfer_initiated",
    status: "pending",
    receiverId,
    amount,
    groupId: groupId ?? "default",
    riskScore: risk.score,
    riskLevel: risk.level,
    newPayeeWarning: isNewPayee,
    riskFactors: risk.factors.filter((f) => f.triggered).map((f) => f.name),
  });

  const parts: string[] = [
    `Transfer of ${spokenRupees(amount)} to ${receiverId} is ready.`,
  ];

  if (isNewPayee) {
    parts.push(
      `⚠️ New payee alert: You have never sent money to ${receiverId} before. Please confirm carefully.`,
    );
  }

  if (risk.level === "high") {
    parts.push(
      `Risk level is HIGH (score ${risk.score}). Extra verification required.`,
    );
  } else if (risk.level === "medium") {
    parts.push(`Risk level is medium (score ${risk.score}). Proceed with care.`);
  }

  if (requiresHighValueConfirmation(amount)) {
    parts.push(
      `High-value transfer. Please confirm the exact amount ${spokenRupees(amount)} with your PIN.`,
    );
  }

  parts.push("Say your 4-digit PIN to confirm.");
  return parts.join(" ");
}

export async function confirmSendMoney(
  params: Record<string, unknown>,
): Promise<string> {
  const { senderId, pin, amountConfirmation, newPayeeConfirmed } =
    confirmSendMoneySchema.parse(params);

  const pending = pendingTransfers.get(senderId);

  if (!pending) {
    logEvent("transaction", senderId, {
      action: "transfer_confirm",
      status: "failed",
      reason: "no_pending_transfer",
    });
    throw new Error(
      "No pending transfer found. Please initiate sendMoney first.",
    );
  }

  if (pending.requiresNewPayeeConfirmation && newPayeeConfirmed !== true) {
    logEvent("transaction", senderId, {
      action: "transfer_confirm",
      status: "failed",
      reason: "new_payee_not_confirmed",
      receiverId: pending.receiverId,
    });
    throw new Error(
      `${pending.receiverId} is a new payee. Please explicitly confirm by saying "Yes, I confirm new payee" and provide your PIN again.`,
    );
  }

  if (
    pending.requiresAmountConfirmation &&
    amountConfirmation !== pending.amount
  ) {
    logEvent("transaction", senderId, {
      action: "transfer_confirm",
      status: "failed",
      reason: "high_value_amount_mismatch",
      expectedAmount: pending.amount,
      providedAmount:
        typeof amountConfirmation === "number" ? amountConfirmation : "missing",
    });
    throw new Error(
      `${HIGH_VALUE_CONFIRMATION_ERROR_PREFIX} Please confirm the exact amount of ${spokenRupees(pending.amount)} along with your PIN.`,
    );
  }

  const verified = verifyPin(senderId, pin);
  if (!verified) {
    pending.pinAttempts += 1;
    incrementPinFailedStreak(senderId);
    const remainingAttempts = MAX_PIN_ATTEMPTS - pending.pinAttempts;

    if (remainingAttempts <= 0) {
      pendingTransfers.delete(senderId);
      logEvent("transaction", senderId, {
        action: "transfer_confirm",
        status: "failed",
        reason: "max_pin_attempts_reached",
      });
      throw new Error(
        "Incorrect PIN. Maximum attempts reached. Pending transfer has been cancelled.",
      );
    }

    const attemptWord = remainingAttempts === 1 ? "attempt" : "attempts";
    throw new Error(
      `Incorrect PIN. ${remainingAttempts} ${attemptWord} remaining.`,
    );
  }

  resetPinFailedStreak(senderId);

  if (pending.requiresAmountConfirmation) {
    logEvent("transaction", senderId, {
      action: "transfer_high_value_confirmed",
      status: "success",
      receiverId: pending.receiverId,
      amount: pending.amount,
      groupId: pending.groupId,
    });
  }

  const result = await executeTransfer({
    senderId: pending.senderId,
    receiverId: pending.receiverId,
    amount: pending.amount,
    groupId: pending.groupId,
    riskScore: pending.riskScore,
    riskLevel: pending.riskLevel,
  });

  addBeneficiary(senderId, pending.receiverId);

  pendingTransfers.delete(senderId);
  return result;
}

export function resetPendingTransfers(): void {
  pendingTransfers.clear();
}

const getTransactionHistorySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  limit: z.number().int().positive().optional(),
});

export async function getTransactionHistory(
  params: Record<string, unknown>,
): Promise<string> {
  const { userId, limit = 10 } = getTransactionHistorySchema.parse(params);

  const userTxns = ledger
    .filter((tx) => tx.senderId === userId || tx.receiverId === userId)
    .slice(-limit);

  if (userTxns.length === 0) {
    logger.info({ userId }, "Transaction history requested — no transactions");
    return `${userId} has no transactions yet.`;
  }

  const lines = userTxns.map((tx) => {
    const direction = tx.senderId === userId ? "Sent" : "Received";
    const counterparty =
      tx.senderId === userId ? tx.receiverId : tx.senderId;
    return `${direction} ${spokenRupees(tx.amount)} ${direction === "Sent" ? "to" : "from"} ${counterparty}`;
  });

  logger.info({ userId, count: userTxns.length }, "Transaction history retrieved");

  return `Transaction history for ${userId}: ${lines.join(". ")}`;
}

export function getLedger(): Transaction[] {
  return ledger;
}

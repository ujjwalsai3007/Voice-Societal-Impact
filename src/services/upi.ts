import { z } from "zod/v4";
import { logger } from "../lib/logger.js";

const DEFAULT_BALANCE = 10000;

export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  timestamp: string;
}

const accounts = new Map<string, number>();
const ledger: Transaction[] = [];
let txCounter = 0;

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
  return `Account ${userId} has a balance of ₹${balance}.`;
}

const sendMoneySchema = z.object({
  senderId: z.string().min(1, "senderId is required"),
  receiverId: z.string().min(1, "receiverId is required"),
  amount: z.number().positive("Amount must be greater than zero"),
});

export async function sendMoney(
  params: Record<string, unknown>,
): Promise<string> {
  const { senderId, receiverId, amount } = sendMoneySchema.parse(params);

  if (senderId === receiverId) {
    throw new Error("Cannot transfer to the same account");
  }

  const senderBalance = getBalance(senderId);
  if (senderBalance < amount) {
    throw new Error(
      `Insufficient funds: ${senderId} has ₹${senderBalance} but tried to send ₹${amount}`,
    );
  }

  accounts.set(senderId, senderBalance - amount);
  accounts.set(receiverId, getBalance(receiverId) + amount);

  txCounter += 1;
  const tx: Transaction = {
    id: `txn-${txCounter}`,
    senderId,
    receiverId,
    amount,
    timestamp: new Date().toISOString(),
  };
  ledger.push(tx);

  logger.info(
    { txId: tx.id, senderId, receiverId, amount },
    "Money transferred",
  );

  return `Successfully sent ₹${amount} from ${senderId} to ${receiverId}. Transaction ID: ${tx.id}.`;
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
    return `${direction} ₹${tx.amount} ${direction === "Sent" ? "to" : "from"} ${counterparty} (${tx.id}, ${tx.timestamp})`;
  });

  logger.info(
    { userId, count: userTxns.length },
    "Transaction history retrieved",
  );

  return `Transaction history for ${userId}:\n${lines.join("\n")}`;
}

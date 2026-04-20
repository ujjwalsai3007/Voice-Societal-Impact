import { z } from "zod/v4";
import { registerToolHandler } from "../webhooks/dispatcher.js";
import {
  checkBalance,
  initiateSendMoney,
  confirmSendMoney,
  getTransactionHistory,
} from "./upi.js";
import { recallMemory } from "./memory.js";
import { logger } from "../lib/logger.js";

const recallContextSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  query: z.string().min(1, "query is required"),
  topK: z.number().int().positive().optional(),
  groupId: z.string().min(1).optional(),
});

async function recallContext(
  params: Record<string, unknown>,
): Promise<string> {
  const { userId, query, topK = 3, groupId } = recallContextSchema.parse(params);

  const memories = await recallMemory(userId, query, topK, groupId);

  if (memories.length === 0) {
    logger.info({ userId, query }, "No context memories found");
    return `No previous context found for ${userId} matching "${query}".`;
  }

  const lines = memories.map(
    (m, i) => `${i + 1}. ${m.text} (relevance: ${m.score.toFixed(2)})`,
  );

  logger.info(
    { userId, query, resultCount: memories.length },
    "Context recalled for user",
  );

  return `Context for ${userId}: ${lines.join(". ")}`;
}

export function registerUpiTools(): void {
  registerToolHandler("checkBalance", checkBalance);
  registerToolHandler("sendMoney", initiateSendMoney);
  registerToolHandler("confirmSendMoney", confirmSendMoney);
  registerToolHandler("getTransactionHistory", getTransactionHistory);
  registerToolHandler("recallContext", recallContext);
}

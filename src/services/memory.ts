import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { getQdrantClient, COLLECTION_NAME } from "./qdrant.js";
import { generateEmbedding } from "./embedding.js";

export interface MemoryMetadata {
  category?: string;
  [key: string]: unknown;
}

export interface MemoryResult {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface MemoryHistoryItem {
  text: string;
  metadata: Record<string, unknown>;
}

export async function upsertMemory(
  userId: string,
  text: string,
  metadata?: MemoryMetadata,
): Promise<string> {
  const client = getQdrantClient();
  const id = randomUUID();
  const vector = generateEmbedding(text);
  const timestamp = new Date().toISOString();

  const payload: Record<string, unknown> = {
    userId,
    text,
    timestamp,
    ...metadata,
  };

  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{ id, vector, payload }],
  });

  logger.info({ userId, pointId: id, category: metadata?.category }, "Memory upserted");
  return id;
}

export async function recallMemory(
  userId: string,
  query: string,
  topK: number = 3,
): Promise<MemoryResult[]> {
  const client = getQdrantClient();
  const queryVector = generateEmbedding(query);

  const results = await client.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    filter: {
      must: [{ key: "userId", match: { value: userId } }],
    },
  });

  logger.info(
    { userId, query, topK, resultsCount: results.length },
    "Memory recalled",
  );

  return results.map((point) => {
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    return {
      text: (payload["text"] as string) ?? "",
      score: point.score,
      metadata: payload,
    };
  });
}

export async function getUserMemoryHistory(
  userId: string,
  limit: number = 10,
): Promise<MemoryHistoryItem[]> {
  const client = getQdrantClient();

  const response = await client.scroll(COLLECTION_NAME, {
    limit,
    with_payload: true,
    filter: {
      must: [{ key: "userId", match: { value: userId } }],
    },
  });

  logger.info(
    { userId, pointCount: response.points.length },
    "Memory history retrieved",
  );

  return response.points.map((point) => {
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    return {
      text: (payload["text"] as string) ?? "",
      metadata: payload,
    };
  });
}

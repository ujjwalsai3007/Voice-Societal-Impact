import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { getQdrantClient, COLLECTION_NAME } from "./qdrant.js";
import { generateEmbedding } from "./embedding.js";
import { logEvent } from "./event-store.js";

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
  groupId: string = "default",
): Promise<string> {
  const client = getQdrantClient();
  const id = randomUUID();
  const vector = generateEmbedding(text);
  const timestamp = new Date().toISOString();

  const payload: Record<string, unknown> = {
    userId,
    group_id: groupId,
    text,
    timestamp,
    ...metadata,
  };

  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{ id, vector, payload }],
  });

  logger.info(
    { userId, groupId, pointId: id, category: metadata?.category },
    "Memory upserted",
  );
  logEvent("memory_operation", userId, {
    operation: "upsert",
    groupId,
    pointId: id,
    category: metadata?.category ?? null,
  });
  return id;
}

export async function recallMemory(
  userId: string,
  query: string,
  topK: number = 3,
  groupId: string = "default",
): Promise<MemoryResult[]> {
  const client = getQdrantClient();
  const queryVector = generateEmbedding(query);

  const results = await client.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
        { key: "group_id", match: { value: groupId } },
      ],
    },
  });

  logger.info(
    { userId, groupId, query, topK, resultsCount: results.length },
    "Memory recalled",
  );
  logEvent("memory_operation", userId, {
    operation: "recall",
    groupId,
    query,
    topK,
    resultsCount: results.length,
  });

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
  groupId: string = "default",
): Promise<MemoryHistoryItem[]> {
  const client = getQdrantClient();

  const response = await client.scroll(COLLECTION_NAME, {
    limit,
    with_payload: true,
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
        { key: "group_id", match: { value: groupId } },
      ],
    },
  });

  logger.info(
    { userId, groupId, pointCount: response.points.length },
    "Memory history retrieved",
  );
  logEvent("memory_operation", userId, {
    operation: "history",
    groupId,
    limit,
    pointCount: response.points.length,
  });

  return response.points.map((point) => {
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    return {
      text: (payload["text"] as string) ?? "",
      metadata: payload,
    };
  });
}

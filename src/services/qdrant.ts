import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../lib/logger.js";

export const COLLECTION_NAME = "user_memory";
export const VECTOR_SIZE = 384;

let client: QdrantClient | null = null;

export function createQdrantClient(
  url: string,
  apiKey?: string,
): QdrantClient {
  const opts: { url: string; apiKey?: string } = { url };
  if (apiKey) {
    opts.apiKey = apiKey;
  }

  client = new QdrantClient(opts);
  logger.info({ url }, "Qdrant client created");
  return client;
}

export function getQdrantClient(): QdrantClient {
  if (!client) {
    throw new Error(
      "Qdrant client not initialized. Call createQdrantClient() first.",
    );
  }
  return client;
}

export async function checkQdrantHealth(): Promise<boolean> {
  const qdrant = getQdrantClient();
  try {
    await qdrant.getCollections();
    logger.info("Qdrant health check passed");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ error: message }, "Qdrant health check failed");
    return false;
  }
}

export async function ensureCollection(
  name: string,
  vectorSize: number,
): Promise<void> {
  const qdrant = getQdrantClient();
  const { exists } = await qdrant.collectionExists(name);

  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
    logger.info({ collection: name, vectorSize }, "Collection created");
  } else {
    logger.info({ collection: name }, "Collection already exists");
  }

  await ensurePayloadIndex(qdrant, name, "userId", "keyword");
  await ensurePayloadIndex(qdrant, name, "group_id", "keyword");
}

async function ensurePayloadIndex(
  qdrant: QdrantClient,
  collection: string,
  field: string,
  schema: "keyword" | "integer" | "float" | "text",
): Promise<void> {
  try {
    await qdrant.createPayloadIndex(collection, {
      field_name: field,
      field_schema: schema,
      wait: true,
    });
    logger.info({ collection, field, schema }, "Payload index ensured");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("already exists")) {
      logger.info({ collection, field }, "Payload index already exists");
      return;
    }
    logger.warn({ collection, field, error: message }, "Payload index creation warning");
  }
}

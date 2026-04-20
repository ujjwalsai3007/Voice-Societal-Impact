import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@qdrant/js-client-rest", () => {
  class MockQdrantClient {
    collectionExists = vi.fn().mockResolvedValue({ exists: false });
    createCollection = vi.fn().mockResolvedValue(true);
    createPayloadIndex = vi.fn().mockResolvedValue(true);
    getCollections = vi.fn().mockResolvedValue({ collections: [] });
    constructor(public opts: Record<string, unknown>) {}
  }

  return { QdrantClient: MockQdrantClient };
});

describe("Qdrant Service (src/services/qdrant.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should export createQdrantClient function", async () => {
    const mod = await import("../src/services/qdrant.js");
    expect(mod.createQdrantClient).toBeDefined();
    expect(typeof mod.createQdrantClient).toBe("function");
  });

  it("should export getQdrantClient function", async () => {
    const mod = await import("../src/services/qdrant.js");
    expect(mod.getQdrantClient).toBeDefined();
    expect(typeof mod.getQdrantClient).toBe("function");
  });

  it("should export ensureCollection function", async () => {
    const mod = await import("../src/services/qdrant.js");
    expect(mod.ensureCollection).toBeDefined();
    expect(typeof mod.ensureCollection).toBe("function");
  });

  it("should export checkQdrantHealth function", async () => {
    const mod = await import("../src/services/qdrant.js");
    expect(mod.checkQdrantHealth).toBeDefined();
    expect(typeof mod.checkQdrantHealth).toBe("function");
  });

  describe("createQdrantClient", () => {
    it("should create a QdrantClient with url and optional apiKey", async () => {
      const { createQdrantClient, getQdrantClient } = await import(
        "../src/services/qdrant.js"
      );

      createQdrantClient("http://localhost:6333", "test-key");
      const client = getQdrantClient() as unknown as { opts: Record<string, unknown> };

      expect(client.opts).toEqual({
        url: "http://localhost:6333",
        apiKey: "test-key",
      });
    });

    it("should create a QdrantClient without apiKey when empty", async () => {
      const { createQdrantClient, getQdrantClient } = await import(
        "../src/services/qdrant.js"
      );

      createQdrantClient("http://localhost:6333", "");
      const client = getQdrantClient() as unknown as { opts: Record<string, unknown> };

      expect(client.opts).toEqual({
        url: "http://localhost:6333",
      });
    });
  });

  describe("getQdrantClient", () => {
    it("should throw if no client has been created", async () => {
      const { getQdrantClient } = await import("../src/services/qdrant.js");

      expect(() => getQdrantClient()).toThrow(
        "Qdrant client not initialized. Call createQdrantClient() first.",
      );
    });

    it("should return the singleton after creation", async () => {
      const { createQdrantClient, getQdrantClient } = await import(
        "../src/services/qdrant.js"
      );

      const client = createQdrantClient("http://localhost:6333");
      expect(getQdrantClient()).toBe(client);
    });
  });

  describe("checkQdrantHealth", () => {
    it("should return true when Qdrant is healthy", async () => {
      const { createQdrantClient, checkQdrantHealth } = await import(
        "../src/services/qdrant.js"
      );

      createQdrantClient("http://localhost:6333");
      const healthy = await checkQdrantHealth();
      expect(healthy).toBe(true);
    });

    it("should return false when health check fails", async () => {
      const { createQdrantClient, checkQdrantHealth } = await import(
        "../src/services/qdrant.js"
      );

      const client = createQdrantClient("http://localhost:6333");
      vi.spyOn(client, "getCollections").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const healthy = await checkQdrantHealth();
      expect(healthy).toBe(false);
    });
  });

  describe("ensureCollection", () => {
    it("should create a collection with vector config if it does not exist", async () => {
      const { createQdrantClient, ensureCollection } = await import(
        "../src/services/qdrant.js"
      );

      const client = createQdrantClient("http://localhost:6333");
      await ensureCollection("user_memory", 384);

      expect(client.collectionExists).toHaveBeenCalledWith("user_memory");
      expect(client.createCollection).toHaveBeenCalledWith("user_memory", {
        vectors: {
          size: 384,
          distance: "Cosine",
        },
      });
      expect(client.createPayloadIndex).toHaveBeenCalledTimes(2);
      expect(client.createPayloadIndex).toHaveBeenNthCalledWith(1, "user_memory", {
        field_name: "userId",
        field_schema: "keyword",
        wait: true,
      });
      expect(client.createPayloadIndex).toHaveBeenNthCalledWith(2, "user_memory", {
        field_name: "group_id",
        field_schema: "keyword",
        wait: true,
      });
    });

    it("should skip creation when collection already exists", async () => {
      const { createQdrantClient, ensureCollection } = await import(
        "../src/services/qdrant.js"
      );

      const client = createQdrantClient("http://localhost:6333");
      vi.spyOn(client, "collectionExists").mockResolvedValueOnce({ exists: true });

      await ensureCollection("user_memory", 384);

      expect(client.createCollection).not.toHaveBeenCalled();
    });
  });

  describe("COLLECTION_NAME", () => {
    it("should export the default collection name", async () => {
      const { COLLECTION_NAME } = await import("../src/services/qdrant.js");
      expect(COLLECTION_NAME).toBe("user_memory");
    });
  });

  describe("VECTOR_SIZE", () => {
    it("should export the default vector size", async () => {
      const { VECTOR_SIZE } = await import("../src/services/qdrant.js");
      expect(VECTOR_SIZE).toBe(384);
    });
  });
});

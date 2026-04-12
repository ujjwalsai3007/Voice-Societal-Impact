import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/services/qdrant.js", () => {
  const mockClient = {
    upsert: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
    scroll: vi.fn().mockResolvedValue({ points: [] }),
    getCollections: vi.fn().mockResolvedValue({ collections: [] }),
    collectionExists: vi.fn().mockResolvedValue({ exists: true }),
    createCollection: vi.fn().mockResolvedValue({}),
  };
  return {
    COLLECTION_NAME: "user_memory",
    VECTOR_SIZE: 384,
    createQdrantClient: vi.fn().mockReturnValue(mockClient),
    getQdrantClient: vi.fn().mockReturnValue(mockClient),
    checkQdrantHealth: vi.fn().mockResolvedValue(true),
    ensureCollection: vi.fn().mockResolvedValue(undefined),
  };
});

describe("Qdrant Warm-Up (src/index.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export warmUpQdrant function", async () => {
    const { warmUpQdrant } = await import("../src/index.js");
    expect(warmUpQdrant).toBeDefined();
    expect(typeof warmUpQdrant).toBe("function");
  });

  it("should call createQdrantClient and ensureCollection during warm-up", async () => {
    const { warmUpQdrant } = await import("../src/index.js");
    const qdrant = await import("../src/services/qdrant.js");

    await warmUpQdrant("http://localhost:6333", "test-key");

    expect(qdrant.createQdrantClient).toHaveBeenCalledWith("http://localhost:6333", "test-key");
    expect(qdrant.checkQdrantHealth).toHaveBeenCalled();
    expect(qdrant.ensureCollection).toHaveBeenCalledWith("user_memory", 384);
  });

  it("should not throw if Qdrant health check fails", async () => {
    const qdrant = await import("../src/services/qdrant.js");
    vi.mocked(qdrant.checkQdrantHealth).mockResolvedValueOnce(false);

    const { warmUpQdrant } = await import("../src/index.js");
    await expect(warmUpQdrant("http://localhost:6333")).resolves.toBeUndefined();
    expect(qdrant.ensureCollection).not.toHaveBeenCalled();
  });

  it("should not throw if createQdrantClient throws", async () => {
    const qdrant = await import("../src/services/qdrant.js");
    vi.mocked(qdrant.createQdrantClient).mockImplementationOnce(() => {
      throw new Error("Connection refused");
    });

    const { warmUpQdrant } = await import("../src/index.js");
    await expect(warmUpQdrant("http://bad-host:6333")).resolves.toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QdrantClient } from "@qdrant/js-client-rest";

function createMockQdrantClient(): QdrantClient {
  return {
    upsert: vi.fn().mockResolvedValue({ status: "completed" }),
    search: vi.fn().mockResolvedValue([
      {
        id: "point-1",
        score: 0.95,
        payload: {
          userId: "user-abc",
          text: "Sent Rs 500 to Ramesh",
          category: "transaction",
          timestamp: "2026-04-12T10:00:00.000Z",
        },
      },
      {
        id: "point-2",
        score: 0.82,
        payload: {
          userId: "user-abc",
          text: "Checked balance",
          category: "query",
          timestamp: "2026-04-12T09:30:00.000Z",
        },
      },
    ]),
    scroll: vi.fn().mockResolvedValue({
      points: [
        {
          id: "point-3",
          payload: {
            userId: "user-abc",
            text: "Previous interaction",
            category: "general",
            timestamp: "2026-04-12T08:00:00.000Z",
          },
        },
      ],
      next_page_offset: null,
    }),
  } as unknown as QdrantClient;
}

let currentMockClient: QdrantClient | null = null;

vi.mock("../src/services/qdrant.js", () => ({
  COLLECTION_NAME: "user_memory",
  VECTOR_SIZE: 384,
  getQdrantClient: vi.fn(() => {
    if (!currentMockClient) throw new Error("Not initialized");
    return currentMockClient;
  }),
}));

describe("Memory Service (src/services/memory.ts)", () => {
  let mockClient: QdrantClient;

  beforeEach(() => {
    vi.resetModules();
    mockClient = createMockQdrantClient();
    currentMockClient = mockClient;
  });

  it("should export upsertMemory function", async () => {
    const mod = await import("../src/services/memory.js");
    expect(mod.upsertMemory).toBeDefined();
    expect(typeof mod.upsertMemory).toBe("function");
  });

  it("should export recallMemory function", async () => {
    const mod = await import("../src/services/memory.js");
    expect(mod.recallMemory).toBeDefined();
    expect(typeof mod.recallMemory).toBe("function");
  });

  describe("upsertMemory", () => {
    it("should call qdrant upsert with correct collection and point structure", async () => {
      const { upsertMemory } = await import("../src/services/memory.js");

      await upsertMemory("user-abc", "Sent Rs 500 to Ramesh", {
        category: "transaction",
      });

      expect(mockClient.upsert).toHaveBeenCalledTimes(1);
      const call = vi.mocked(mockClient.upsert).mock.calls[0]!;
      expect(call[0]).toBe("user_memory");

      const args = call[1] as { wait: boolean; points: Array<{
        id: string;
        vector: number[];
        payload: Record<string, unknown>;
      }> };
      expect(args.wait).toBe(true);
      expect(args.points).toHaveLength(1);

      const point = args.points[0]!;
      expect(point.vector).toHaveLength(384);
      expect(point.payload["userId"]).toBe("user-abc");
      expect(point.payload["text"]).toBe("Sent Rs 500 to Ramesh");
      expect(point.payload["category"]).toBe("transaction");
      expect(point.payload["timestamp"]).toBeDefined();
    });

    it("should generate a UUID for the point id", async () => {
      const { upsertMemory } = await import("../src/services/memory.js");

      await upsertMemory("user-abc", "test memory");

      const call = vi.mocked(mockClient.upsert).mock.calls[0]!;
      const args = call[1] as { points: Array<{ id: string }> };
      const id = args.points[0]!.id;
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should return the generated point id", async () => {
      const { upsertMemory } = await import("../src/services/memory.js");

      const id = await upsertMemory("user-abc", "test memory");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should include default metadata when none is provided", async () => {
      const { upsertMemory } = await import("../src/services/memory.js");

      await upsertMemory("user-xyz", "just a note");

      const call = vi.mocked(mockClient.upsert).mock.calls[0]!;
      const args = call[1] as { points: Array<{ payload: Record<string, unknown> }> };
      const payload = args.points[0]!.payload;
      expect(payload["userId"]).toBe("user-xyz");
      expect(payload["text"]).toBe("just a note");
      expect(payload["timestamp"]).toBeDefined();
    });
  });

  describe("recallMemory", () => {
    it("should call qdrant search with the correct parameters", async () => {
      const { recallMemory } = await import("../src/services/memory.js");

      await recallMemory("user-abc", "ramesh transaction", 5);

      expect(mockClient.search).toHaveBeenCalledTimes(1);
      const call = vi.mocked(mockClient.search).mock.calls[0]!;
      expect(call[0]).toBe("user_memory");

      const args = call[1] as {
        vector: number[];
        limit: number;
        filter: { must: Array<Record<string, unknown>> };
        with_payload: boolean;
      };
      expect(args.vector).toHaveLength(384);
      expect(args.limit).toBe(5);
      expect(args.with_payload).toBe(true);
      expect(args.filter.must).toEqual([
        {
          key: "userId",
          match: { value: "user-abc" },
        },
      ]);
    });

    it("should return formatted memory results with text and score", async () => {
      const { recallMemory } = await import("../src/services/memory.js");

      const results = await recallMemory("user-abc", "ramesh", 5);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        text: "Sent Rs 500 to Ramesh",
        score: 0.95,
        metadata: {
          userId: "user-abc",
          text: "Sent Rs 500 to Ramesh",
          category: "transaction",
          timestamp: "2026-04-12T10:00:00.000Z",
        },
      });
    });

    it("should default topK to 3 if not provided", async () => {
      const { recallMemory } = await import("../src/services/memory.js");

      await recallMemory("user-abc", "query");

      const call = vi.mocked(mockClient.search).mock.calls[0]!;
      const args = call[1] as { limit: number };
      expect(args.limit).toBe(3);
    });

    it("should return empty array when no results match", async () => {
      vi.mocked(mockClient.search).mockResolvedValueOnce([]);
      const { recallMemory } = await import("../src/services/memory.js");

      const results = await recallMemory("user-none", "nothing");
      expect(results).toEqual([]);
    });
  });

  describe("getUserMemoryHistory", () => {
    it("should export getUserMemoryHistory function", async () => {
      const mod = await import("../src/services/memory.js");
      expect(mod.getUserMemoryHistory).toBeDefined();
      expect(typeof mod.getUserMemoryHistory).toBe("function");
    });

    it("should scroll user memories with userId filter", async () => {
      const { getUserMemoryHistory } = await import("../src/services/memory.js");

      const results = await getUserMemoryHistory("user-abc", 10);

      expect(mockClient.scroll).toHaveBeenCalledTimes(1);
      const call = vi.mocked(mockClient.scroll).mock.calls[0]!;
      expect(call[0]).toBe("user_memory");

      const args = call[1] as {
        limit: number;
        filter: { must: Array<Record<string, unknown>> };
        with_payload: boolean;
      };
      expect(args.limit).toBe(10);
      expect(args.with_payload).toBe(true);
      expect(args.filter.must).toEqual([
        { key: "userId", match: { value: "user-abc" } },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.text).toBe("Previous interaction");
    });
  });
});

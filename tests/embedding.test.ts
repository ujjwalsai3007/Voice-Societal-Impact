import { describe, it, expect } from "vitest";

describe("Embedding Service (src/services/embedding.ts)", () => {
  it("should export generateEmbedding function", async () => {
    const mod = await import("../src/services/embedding.js");
    expect(mod.generateEmbedding).toBeDefined();
    expect(typeof mod.generateEmbedding).toBe("function");
  });

  it("should export EMBEDDING_DIM constant equal to 384", async () => {
    const { EMBEDDING_DIM } = await import("../src/services/embedding.js");
    expect(EMBEDDING_DIM).toBe(384);
  });

  describe("generateEmbedding", () => {
    it("should return a vector of length 384", async () => {
      const { generateEmbedding, EMBEDDING_DIM } = await import(
        "../src/services/embedding.js"
      );

      const vec = generateEmbedding("hello world");
      expect(vec).toHaveLength(EMBEDDING_DIM);
    });

    it("should return numbers between -1 and 1", async () => {
      const { generateEmbedding } = await import(
        "../src/services/embedding.js"
      );

      const vec = generateEmbedding("test embedding normalization");
      for (const val of vec) {
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it("should produce deterministic output for the same input", async () => {
      const { generateEmbedding } = await import(
        "../src/services/embedding.js"
      );

      const vec1 = generateEmbedding("deterministic test");
      const vec2 = generateEmbedding("deterministic test");
      expect(vec1).toEqual(vec2);
    });

    it("should produce different vectors for different inputs", async () => {
      const { generateEmbedding } = await import(
        "../src/services/embedding.js"
      );

      const vec1 = generateEmbedding("hello world");
      const vec2 = generateEmbedding("goodbye world");
      expect(vec1).not.toEqual(vec2);
    });

    it("should produce a unit-normalized vector (L2 norm ~1)", async () => {
      const { generateEmbedding } = await import(
        "../src/services/embedding.js"
      );

      const vec = generateEmbedding("normalization check");
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 3);
    });

    it("should handle empty string input", async () => {
      const { generateEmbedding, EMBEDDING_DIM } = await import(
        "../src/services/embedding.js"
      );

      const vec = generateEmbedding("");
      expect(vec).toHaveLength(EMBEDDING_DIM);
    });

    it("should handle very long input text", async () => {
      const { generateEmbedding, EMBEDDING_DIM } = await import(
        "../src/services/embedding.js"
      );

      const longText = "a".repeat(10000);
      const vec = generateEmbedding(longText);
      expect(vec).toHaveLength(EMBEDDING_DIM);
    });

    it("should produce similar vectors for similar inputs (cosine similarity > 0.5)", async () => {
      const { generateEmbedding } = await import(
        "../src/services/embedding.js"
      );

      const vec1 = generateEmbedding("send money to ramesh");
      const vec2 = generateEmbedding("transfer money to ramesh");

      const dotProduct = vec1.reduce((sum, v, i) => sum + v * (vec2[i] ?? 0), 0);
      expect(dotProduct).toBeGreaterThan(0.5);
    });
  });
});

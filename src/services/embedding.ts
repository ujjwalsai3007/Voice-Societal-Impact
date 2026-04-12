import { createHash } from "node:crypto";

export const EMBEDDING_DIM = 384;

/**
 * Lightweight deterministic text embedding using character trigram hashing.
 * Produces unit-normalized 384-dim vectors suitable for cosine similarity.
 * Similar texts share trigrams, yielding high cosine similarity without
 * needing a heavy ML model — ideal for a hackathon demo with Qdrant.
 */
export function generateEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const normalized = text.toLowerCase().trim();

  if (normalized.length === 0) {
    const hash = createHash("sha512").update("__empty__").digest();
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] = ((hash[i % hash.length]! / 255) * 2) - 1;
    }
    return normalizeVector(Array.from(vec));
  }

  const trigrams = extractTrigrams(normalized);

  for (const trigram of trigrams) {
    const hash = createHash("md5").update(trigram).digest();
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      const byte = hash[i % hash.length]!;
      vec[i]! += ((byte / 255) * 2) - 1;
    }
  }

  return normalizeVector(Array.from(vec));
}

function extractTrigrams(text: string): string[] {
  const grams: string[] = [];
  const padded = ` ${text} `;

  for (let i = 0; i <= padded.length - 3; i++) {
    grams.push(padded.slice(i, i + 3));
  }

  return grams;
}

function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));

  if (norm === 0) {
    return vec;
  }

  return vec.map((v) => v / norm);
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheService } from "../src/services/cache.js";

describe("CacheService (src/services/cache.ts)", () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({ defaultTtlMs: 1000, maxEntries: 100 });
  });

  it("should store and retrieve a cached value", () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return undefined for a missing key", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("should expire entries after TTL", async () => {
    const shortCache = new CacheService({ defaultTtlMs: 50, maxEntries: 10 });
    shortCache.set("expiring", "data");
    expect(shortCache.get("expiring")).toBe("data");

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(shortCache.get("expiring")).toBeUndefined();
  });

  it("should allow custom TTL per entry", async () => {
    cache.set("short", "data", 50);
    cache.set("long", "data", 5000);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("long")).toBe("data");
  });

  it("should evict oldest entry when maxEntries is exceeded", () => {
    const tinyCache = new CacheService({ defaultTtlMs: 60000, maxEntries: 3 });
    tinyCache.set("a", "1");
    tinyCache.set("b", "2");
    tinyCache.set("c", "3");
    tinyCache.set("d", "4");

    expect(tinyCache.get("a")).toBeUndefined();
    expect(tinyCache.get("d")).toBe("4");
  });

  it("should overwrite an existing key", () => {
    cache.set("key", "old");
    cache.set("key", "new");
    expect(cache.get("key")).toBe("new");
  });

  it("should report cache statistics", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a");
    cache.get("a");
    cache.get("miss");

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
  });

  it("should clear all entries", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.getStats().size).toBe(0);
  });

  it("should delete a specific key", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.delete("a");

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
  });

  it("should check if a key exists", () => {
    cache.set("a", "1");
    expect(cache.has("a")).toBe(true);
    expect(cache.has("missing")).toBe(false);
  });
});

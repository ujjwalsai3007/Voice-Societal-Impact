import { logger } from "../lib/logger.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  insertedAt: number;
}

interface CacheOptions {
  defaultTtlMs: number;
  maxEntries: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions) {
    this.defaultTtlMs = options.defaultTtlMs;
    this.maxEntries = options.maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    if (this.store.size >= this.maxEntries) {
      this.evictOldest();
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      insertedAt: now,
    });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.insertedAt < oldestTime) {
        oldestTime = entry.insertedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.info({ key: oldestKey }, "Cache entry evicted");
    }
  }
}

const balanceCacheInstance = new CacheService({
  defaultTtlMs: 5000,
  maxEntries: 1000,
});

export function getBalanceCache(): CacheService {
  return balanceCacheInstance;
}

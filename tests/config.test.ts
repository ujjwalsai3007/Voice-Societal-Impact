import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Config Loader (src/lib/config.ts)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a loadConfig function", async () => {
    const mod = await import("../src/lib/config.js");
    expect(mod.loadConfig).toBeDefined();
    expect(typeof mod.loadConfig).toBe("function");
  });

  it("should return a valid config object when all required env vars are set", async () => {
    vi.stubEnv("PORT", "4000");
    vi.stubEnv("QDRANT_URL", "http://localhost:6333");
    vi.stubEnv("QDRANT_API_KEY", "test-key-123");
    vi.stubEnv("VAPI_SECRET", "secret-abc");

    const { loadConfig } = await import("../src/lib/config.js");
    const config = loadConfig();

    expect(config).toEqual({
      port: 4000,
      qdrantUrl: "http://localhost:6333",
      qdrantApiKey: "test-key-123",
      vapiSecret: "secret-abc",
    });
  });

  it("should default PORT to 3000 when not provided", async () => {
    vi.stubEnv("PORT", "");
    vi.stubEnv("QDRANT_URL", "http://localhost:6333");
    vi.stubEnv("QDRANT_API_KEY", "test-key");
    vi.stubEnv("VAPI_SECRET", "secret");

    const { loadConfig } = await import("../src/lib/config.js");
    const config = loadConfig();

    expect(config.port).toBe(3000);
  });

  it("should throw a descriptive error when QDRANT_URL is missing", async () => {
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("QDRANT_URL", "");
    vi.stubEnv("QDRANT_API_KEY", "key");
    vi.stubEnv("VAPI_SECRET", "secret");

    const { loadConfig } = await import("../src/lib/config.js");
    expect(() => loadConfig()).toThrow();
  });

  it("should throw a descriptive error when VAPI_SECRET is missing", async () => {
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("QDRANT_URL", "http://localhost:6333");
    vi.stubEnv("QDRANT_API_KEY", "key");
    vi.stubEnv("VAPI_SECRET", "");

    const { loadConfig } = await import("../src/lib/config.js");
    expect(() => loadConfig()).toThrow();
  });

  it("should reject PORT values that are not valid integers", async () => {
    vi.stubEnv("PORT", "not-a-number");
    vi.stubEnv("QDRANT_URL", "http://localhost:6333");
    vi.stubEnv("QDRANT_API_KEY", "key");
    vi.stubEnv("VAPI_SECRET", "secret");

    const { loadConfig } = await import("../src/lib/config.js");
    expect(() => loadConfig()).toThrow();
  });

  it("should export the Config type", async () => {
    const mod = await import("../src/lib/config.js");
    expect(mod.loadConfig).toBeDefined();
  });
});

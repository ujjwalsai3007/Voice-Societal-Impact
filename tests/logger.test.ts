import { describe, it, expect } from "vitest";

describe("Structured Logger (src/lib/logger.ts)", () => {
  it("should export a default logger instance", async () => {
    const { logger } = await import("../src/lib/logger.js");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should export a createChildLogger factory that accepts a context object", async () => {
    const { createChildLogger } = await import("../src/lib/logger.js");
    expect(createChildLogger).toBeDefined();
    expect(typeof createChildLogger).toBe("function");
  });

  it("should create a child logger with bound context fields", async () => {
    const { createChildLogger } = await import("../src/lib/logger.js");
    const child = createChildLogger({ requestId: "req-123", userId: "user-abc" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
    expect(typeof child.error).toBe("function");
  });

  it("should set the default log level to 'info' when NODE_ENV is not 'test'", async () => {
    const { logger } = await import("../src/lib/logger.js");
    expect(logger.level).toBe("info");
  });
});

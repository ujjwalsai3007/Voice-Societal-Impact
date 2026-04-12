import pino from "pino";
import type { Logger } from "pino";

export const logger: Logger = pino({
  level: "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

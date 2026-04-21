import { z } from "zod/v4";

const configSchema = z.object({
  port: z
    .string()
    .transform((val) => {
      if (val === "") return 3000;
      const parsed = Number(val);
      if (!Number.isInteger(parsed) || Number.isNaN(parsed)) {
        throw new Error(`Invalid PORT: "${val}" is not a valid integer`);
      }
      return parsed;
    })
    .default(3000),
  qdrantUrl: z.string().min(1, "QDRANT_URL is required"),
  qdrantApiKey: z.string().default(""),
  vapiSecret: z.string().min(1, "VAPI_SECRET is required"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.parse({
    port: process.env["PORT"] ?? "",
    qdrantUrl: process.env["QDRANT_URL"] ?? "",
    qdrantApiKey: process.env["QDRANT_API_KEY"] ?? "",
    vapiSecret: process.env["VAPI_SECRET"] ?? "",
  });

  return result;
}

import { z } from "zod/v4";

export const vapiToolCallSchema = z.object({
  id: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});

export const vapiToolWithToolCallSchema = z.object({
  name: z.string().min(1),
  toolCall: vapiToolCallSchema,
});

export const vapiToolCallRequestSchema = z.object({
  message: z.object({
    type: z.literal("tool-calls"),
    call: z.record(z.string(), z.unknown()),
    toolWithToolCallList: z.array(vapiToolWithToolCallSchema).min(1),
  }),
});

export const vapiToolCallResultSchema = z.object({
  toolCallId: z.string().min(1),
  result: z.string().optional(),
  error: z.string().optional(),
});

export const vapiToolCallResponseSchema = z.object({
  results: z.array(vapiToolCallResultSchema).min(1),
});

export type VapiToolCallRequest = z.infer<typeof vapiToolCallRequestSchema>;
export type VapiToolCallResponse = z.infer<typeof vapiToolCallResponseSchema>;
export type VapiToolWithToolCall = z.infer<typeof vapiToolWithToolCallSchema>;

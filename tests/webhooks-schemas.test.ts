import { describe, it, expect } from "vitest";

describe("Vapi Webhook Schemas (src/webhooks/schemas.ts)", () => {
  it("should export vapiToolCallRequestSchema", async () => {
    const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");
    expect(vapiToolCallRequestSchema).toBeDefined();
  });

  it("should export vapiToolCallResponseSchema", async () => {
    const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");
    expect(vapiToolCallResponseSchema).toBeDefined();
  });

  describe("vapiToolCallRequestSchema", () => {
    it("should accept a valid tool-calls request payload", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");

      const validPayload = {
        message: {
          type: "tool-calls",
          call: { id: "call-123", orgId: "org-1" },
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: {
                id: "tc-001",
                parameters: { userId: "user-abc" },
              },
            },
          ],
        },
      };

      const result = vapiToolCallRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should accept a payload with multiple tool calls", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");

      const payload = {
        message: {
          type: "tool-calls",
          call: { id: "call-456" },
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { id: "tc-001", parameters: { userId: "u1" } },
            },
            {
              name: "sendMoney",
              toolCall: {
                id: "tc-002",
                parameters: { from: "u1", to: "u2", amount: 100 },
              },
            },
          ],
        },
      };

      const result = vapiToolCallRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject a payload missing the message field", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");
      const result = vapiToolCallRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject a payload with wrong message type", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");

      const payload = {
        message: {
          type: "status-update",
          call: {},
          toolWithToolCallList: [],
        },
      };

      const result = vapiToolCallRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject a payload with missing toolCall.id", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");

      const payload = {
        message: {
          type: "tool-calls",
          call: {},
          toolWithToolCallList: [
            {
              name: "checkBalance",
              toolCall: { parameters: { userId: "u1" } },
            },
          ],
        },
      };

      const result = vapiToolCallRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject a payload with empty toolWithToolCallList", async () => {
      const { vapiToolCallRequestSchema } = await import("../src/webhooks/schemas.js");

      const payload = {
        message: {
          type: "tool-calls",
          call: {},
          toolWithToolCallList: [],
        },
      };

      const result = vapiToolCallRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("vapiToolCallResponseSchema", () => {
    it("should accept a valid response with result", async () => {
      const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");

      const response = {
        results: [
          { toolCallId: "tc-001", result: "Balance is Rs 5000" },
        ],
      };

      const result = vapiToolCallResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should accept a valid response with error", async () => {
      const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");

      const response = {
        results: [
          { toolCallId: "tc-001", error: "User not found" },
        ],
      };

      const result = vapiToolCallResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should accept a response with multiple results", async () => {
      const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");

      const response = {
        results: [
          { toolCallId: "tc-001", result: "Balance is Rs 5000" },
          { toolCallId: "tc-002", result: "Money sent successfully" },
        ],
      };

      const result = vapiToolCallResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should reject a response missing toolCallId", async () => {
      const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");

      const response = {
        results: [{ result: "Balance is Rs 5000" }],
      };

      const result = vapiToolCallResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject an empty results array", async () => {
      const { vapiToolCallResponseSchema } = await import("../src/webhooks/schemas.js");

      const response = { results: [] };
      const result = vapiToolCallResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe("Type exports", () => {
    it("should export VapiToolCallRequest and VapiToolCallResponse types via module", async () => {
      const mod = await import("../src/webhooks/schemas.js");
      expect(mod.vapiToolCallRequestSchema).toBeDefined();
      expect(mod.vapiToolCallResponseSchema).toBeDefined();
    });
  });
});

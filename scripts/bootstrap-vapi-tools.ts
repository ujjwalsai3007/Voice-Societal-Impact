/**
 * Creates or updates VoicePay function tools in your Vapi org via the REST API.
 *
 * Prerequisites (Dashboard → API Keys):
 *   VAPI_PRIVATE_KEY   — Private API key. NOT the same as VAPI_SECRET.
 *   VAPI_SECRET        — Webhook verification secret (x-vapi-secret header).
 *   VAPI_TOOL_SERVER_URL — e.g. https://xxx.trycloudflare.com/webhook/vapi
 *
 * Run:
 *   npx tsx --env-file=.env scripts/bootstrap-vapi-tools.ts
 *
 * Flags:
 *   --force   Also PATCH existing tools to sync schema changes (e.g. new params)
 *
 * After success: open your Assistant in Vapi and attach all listed tool IDs.
 */

const VAPI_API = "https://api.vapi.ai";
const FORCE = process.argv.includes("--force");

type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

type ToolSpec = {
  name: string;
  description: string;
  parameters: JsonSchema;
};

const TOOLS: ToolSpec[] = [
  // ─── Balance ──────────────────────────────────────────────────────────────
  {
    name: "checkBalance",
    description: "Returns the user's current account balance.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
      },
      required: ["userId"],
    },
  },

  // ─── PIN management ───────────────────────────────────────────────────────
  {
    name: "checkPinStatus",
    description: "Returns whether the user has configured a 4-digit PIN.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
      },
      required: ["userId"],
    },
  },
  {
    name: "setPin",
    description: "Sets a new 4-digit numeric PIN for the user. Call before first transfer.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        pin: { type: "string", description: "Exactly 4 digits" },
      },
      required: ["userId", "pin"],
    },
  },
  {
    name: "changePin",
    description: "Changes PIN after verifying the current PIN.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        currentPin: { type: "string", description: "Current 4-digit PIN" },
        newPin: { type: "string", description: "New 4-digit PIN" },
      },
      required: ["userId", "currentPin", "newPin"],
    },
  },

  // ─── Transfers ────────────────────────────────────────────────────────────
  {
    name: "sendMoney",
    description:
      "Initiates a transfer (step 1 of 2). Returns a message that may include a new-payee warning and risk level. Always follow up with confirmSendMoney.",
    parameters: {
      type: "object",
      properties: {
        senderId: { type: "string", description: "Sender account id" },
        receiverId: { type: "string", description: "Receiver account id" },
        amount: { type: "number", description: "Amount in rupees (positive number)" },
        groupId: {
          type: "string",
          description: "Optional tenant / group id (defaults to 'default')",
        },
      },
      required: ["senderId", "receiverId", "amount"],
    },
  },
  {
    name: "confirmSendMoney",
    description:
      "Completes a pending transfer (step 2 of 2). Pass the user's 4-digit PIN. If sendMoney returned a new-payee warning, set newPayeeConfirmed=true after user explicitly confirms. For high-value transfers (>=2000), also pass amountConfirmation.",
    parameters: {
      type: "object",
      properties: {
        senderId: { type: "string", description: "Same sender as sendMoney" },
        pin: { type: "string", description: "4-digit PIN spoken by user" },
        newPayeeConfirmed: {
          type: "boolean",
          description:
            "Set to true when the user explicitly confirms they want to send to a new/unregistered payee. Required when sendMoney returned a new-payee warning.",
        },
        amountConfirmation: {
          type: "number",
          description:
            "Exact rupee amount — required for high-value transfers (>=2000 rupees) to prevent mis-hearing errors.",
        },
      },
      required: ["senderId", "pin"],
    },
  },

  // ─── History & memory ─────────────────────────────────────────────────────
  {
    name: "getTransactionHistory",
    description: "Lists recent sent/received transactions for a user.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        limit: { type: "number", description: "Optional max rows (default 10)" },
      },
      required: ["userId"],
    },
  },
  {
    name: "recallContext",
    description:
      "Semantic search over past interactions stored in Qdrant vector memory. Use for questions like 'what was my last payment to Ramesh?'",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        query: { type: "string", description: "Natural language query" },
        topK: { type: "number", description: "Optional number of results (default 3)" },
        groupId: { type: "string", description: "Optional tenant id" },
      },
      required: ["userId", "query"],
    },
  },

  // ─── Beneficiary management ───────────────────────────────────────────────
  {
    name: "addBeneficiary",
    description:
      "Adds a trusted payee to the user's beneficiary list. Future transfers to them skip the new-payee warning. Note: payees are auto-added after a first confirmed transfer.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        beneficiaryId: { type: "string", description: "Payee account id to trust" },
      },
      required: ["userId", "beneficiaryId"],
    },
  },
  {
    name: "listBeneficiaries",
    description: "Returns all trusted payees for the user.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
      },
      required: ["userId"],
    },
  },
  {
    name: "removeBeneficiary",
    description:
      "Removes a payee from the trusted list. Future transfers to them will require new-payee confirmation again.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        beneficiaryId: { type: "string", description: "Payee account id to remove" },
      },
      required: ["userId", "beneficiaryId"],
    },
  },
];

// ─── Vapi API helpers ────────────────────────────────────────────────────────

interface VapiToolRow {
  id?: string;
  type?: string;
  function?: { name?: string };
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env: ${name}`);
  return v.trim();
}

function authHeader(apiKey: string): string {
  return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
}

function buildCreatePayload(
  spec: ToolSpec,
  serverUrl: string,
  webhookSecret: string,
): Record<string, unknown> {
  return {
    type: "function",
    async: false,
    server: {
      url: serverUrl,
      headers: { "x-vapi-secret": webhookSecret },
    },
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
    },
  };
}

function buildUpdatePayload(
  spec: ToolSpec,
  serverUrl: string,
  webhookSecret: string,
): Record<string, unknown> {
  return {
    async: false,
    server: {
      url: serverUrl,
      headers: { "x-vapi-secret": webhookSecret },
    },
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
    },
  };
}

async function listTools(apiKey: string): Promise<VapiToolRow[]> {
  const res = await fetch(`${VAPI_API}/tool`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) throw new Error(`List tools failed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) return data as VapiToolRow[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "tools", "results", "items"]) {
      if (Array.isArray(o[key])) return o[key] as VapiToolRow[];
    }
  }
  return [];
}

async function createTool(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await fetch(`${VAPI_API}/tool`, {
    method: "POST",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create tool failed ${res.status}: ${text}`);
  const json = JSON.parse(text) as { id?: string };
  if (!json.id) throw new Error(`Create tool response missing id: ${text}`);
  return { id: json.id };
}

async function updateTool(
  apiKey: string,
  toolId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${VAPI_API}/tool/${toolId}`, {
    method: "PATCH",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Update tool ${toolId} failed ${res.status}: ${await res.text()}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = getEnv("VAPI_PRIVATE_KEY");
  const serverUrl = getEnv("VAPI_TOOL_SERVER_URL");
  const webhookSecret = getEnv("VAPI_SECRET");

  if (!serverUrl.includes("/webhook/vapi")) {
    console.warn(
      "⚠️  VAPI_TOOL_SERVER_URL should end with /webhook/vapi",
    );
  }

  console.log(`Mode: ${FORCE ? "create + update (--force)" : "create only"}`);
  console.log(`Server URL: ${serverUrl}\n`);

  const existing = await listTools(apiKey);
  console.log(`Found ${existing.length} existing tool(s) in org.`);

  const existingMap = new Map<string, string>();
  for (const t of existing) {
    const name =
      t.function?.name ??
      (typeof (t as { name?: unknown }).name === "string"
        ? (t as { name: string }).name
        : undefined);
    if (name && t.id) existingMap.set(name, t.id);
  }

  const created: { name: string; id: string }[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const spec of TOOLS) {
    if (existingMap.has(spec.name)) {
      if (FORCE) {
        const toolId = existingMap.get(spec.name)!;
        const body = buildUpdatePayload(spec, serverUrl, webhookSecret);
        await updateTool(apiKey, toolId, body);
        updated.push(spec.name);
        console.log(`Updated  ${spec.name} (id: ${toolId})`);
      } else {
        skipped.push(spec.name);
      }
    } else {
      const body = buildCreatePayload(spec, serverUrl, webhookSecret);
      const { id } = await createTool(apiKey, body);
      created.push({ name: spec.name, id });
      existingMap.set(spec.name, id);
      console.log(`Created  ${spec.name} → id: ${id}`);
    }
  }

  console.log("");

  if (skipped.length > 0) {
    console.log(`Skipped (already exist — run with --force to update): ${skipped.join(", ")}`);
  }
  if (updated.length > 0) {
    console.log(`Updated: ${updated.join(", ")}`);
  }
  if (created.length > 0) {
    console.log("\n✅ Attach these NEW tools to your Assistant (Vapi Dashboard → Assistant → Tools):");
    for (const c of created) {
      console.log(`   ${c.name}: ${c.id}`);
    }
  }

  if (created.length === 0 && updated.length === 0 && skipped.length > 0) {
    console.log("\nAll tools already exist. Run with --force to sync schema changes.");
  }

  console.log("\nDone.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Error:", msg);
  process.exit(1);
});

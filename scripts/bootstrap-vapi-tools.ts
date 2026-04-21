/**
 * Creates VoicePay function tools in your Vapi org via the REST API.
 *
 * Prerequisites (Dashboard → API Keys):
 *   VAPI_PRIVATE_KEY   — Private API key (Authorization header). NOT the same as VAPI_SECRET.
 *
 * From your .env (or pass inline):
 *   VAPI_SECRET          — Webhook verification secret (sent as x-vapi-secret).
 *   VAPI_TOOL_SERVER_URL — Full webhook URL, e.g. https://xxx.trycloudflare.com/webhook/vapi
 *
 * Run:
 *   npx tsx --env-file=.env scripts/bootstrap-vapi-tools.ts
 *
 * After success: open your Assistant in Vapi and attach the listed tool IDs.
 */

const VAPI_API = "https://api.vapi.ai";

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
  {
    name: "sendMoney",
    description:
      "Starts a money transfer (pending). Ask for PIN next, then call confirmSendMoney.",
    parameters: {
      type: "object",
      properties: {
        senderId: { type: "string", description: "Sender account id" },
        receiverId: { type: "string", description: "Receiver account id" },
        amount: { type: "number", description: "Amount in rupees" },
        groupId: {
          type: "string",
          description: "Optional tenant / group id (defaults to default)",
        },
      },
      required: ["senderId", "receiverId", "amount"],
    },
  },
  {
    name: "confirmSendMoney",
    description:
      "Completes a pending transfer after the user speaks their 4-digit PIN. For high-value transfers, pass amountConfirmation matching the transfer amount.",
    parameters: {
      type: "object",
      properties: {
        senderId: { type: "string", description: "Same sender as sendMoney" },
        pin: { type: "string", description: "4-digit PIN" },
        amountConfirmation: {
          type: "number",
          description: "Optional: exact amount for high-value confirmation",
        },
      },
      required: ["senderId", "pin"],
    },
  },
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
    description: "Semantic search over past interactions (Qdrant memory).",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Account user id" },
        query: { type: "string", description: "Natural language query" },
        topK: { type: "number", description: "Optional number of hits (default 3)" },
        groupId: { type: "string", description: "Optional tenant id" },
      },
      required: ["userId", "query"],
    },
  },
];

interface VapiToolRow {
  id?: string;
  type?: string;
  function?: { name?: string };
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v.trim();
}

function buildPayload(
  spec: ToolSpec,
  serverUrl: string,
  webhookSecret: string,
): Record<string, unknown> {
  return {
    type: "function",
    async: false,
    server: {
      url: serverUrl,
      headers: {
        "x-vapi-secret": webhookSecret,
      },
    },
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
    },
  };
}

function authHeader(apiKey: string): string {
  if (apiKey.startsWith("Bearer ")) {
    return apiKey;
  }
  return `Bearer ${apiKey}`;
}

async function listTools(apiKey: string): Promise<VapiToolRow[]> {
  const res = await fetch(`${VAPI_API}/tool`, {
    method: "GET",
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List tools failed ${res.status}: ${text}`);
  }
  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) {
    return data as VapiToolRow[];
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "tools", "results", "items"]) {
      const inner = o[key];
      if (Array.isArray(inner)) {
        return inner as VapiToolRow[];
      }
    }
  }
  return [];
}

function existingNameSet(tools: VapiToolRow[]): Set<string> {
  const names = new Set<string>();
  for (const t of tools) {
    const n =
      t.function?.name ??
      (typeof (t as { name?: unknown }).name === "string"
        ? ((t as { name: string }).name)
        : undefined);
    if (n) {
      names.add(n);
    }
  }
  return names;
}

async function createTool(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await fetch(`${VAPI_API}/tool`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Create tool failed ${res.status}: ${text}`);
  }
  const json = JSON.parse(text) as { id?: string };
  if (!json.id) {
    throw new Error(`Create tool response missing id: ${text}`);
  }
  return { id: json.id };
}

async function main(): Promise<void> {
  const apiKey = getEnv("VAPI_PRIVATE_KEY");
  const serverUrl = getEnv("VAPI_TOOL_SERVER_URL");
  const webhookSecret = getEnv("VAPI_SECRET");

  if (!serverUrl.includes("/webhook/vapi")) {
    console.warn(
      "Warning: VAPI_TOOL_SERVER_URL should end with /webhook/vapi (e.g. https://tunnel.trycloudflare.com/webhook/vapi)",
    );
  }

  const existing = await listTools(apiKey);
  const have = existingNameSet(existing);

  console.log(`Found ${existing.length} existing tool(s) in org.`);

  const created: { name: string; id: string }[] = [];
  const skipped: string[] = [];

  for (const spec of TOOLS) {
    if (have.has(spec.name)) {
      skipped.push(spec.name);
      continue;
    }
    const body = buildPayload(spec, serverUrl, webhookSecret);
    const { id } = await createTool(apiKey, body);
    created.push({ name: spec.name, id });
    have.add(spec.name);
    console.log(`Created tool ${spec.name} → id ${id}`);
  }

  if (skipped.length > 0) {
    console.log(`Skipped (already exists): ${skipped.join(", ")}`);
  }

  if (created.length === 0) {
    console.log("Nothing new to create. If tools are missing in the UI, check org/account.");
    return;
  }

  console.log("\nAttach these tools to your Assistant (Dashboard → Assistant → Tools):");
  for (const c of created) {
    console.log(`  ${c.name}: ${c.id}`);
  }
  console.log("\nDone.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});

# VoicePay Assist

> Voice-first AI payments for the visually impaired and low-literacy users of India.

[![Tests](https://img.shields.io/badge/tests-166%20passed-brightgreen)](./tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)
[![License](https://img.shields.io/badge/license-ISC-lightgrey)](#license)

---

## The Problem

Over **285 million people** in India — including 5 million who are blind — are excluded from digital payments because every UPI app requires reading, typing, and navigating a screen.

VoicePay Assist removes that barrier entirely. Users transact by speaking, in Hindi, English, or Hinglish, with no screen required.

---

## Demo

[Watch the live demo →](https://drive.google.com/file/d/1_mjqds6lz4ZYDrsHsT9zEhmLdm0-48bl/view?usp=sharing)

---

## How It Works

```
User speaks
    ↓
Vapi (voice AI — Deepgram Nova 2 + Azure multilingual TTS)
    ↓  tool-call webhook
Hono backend (PIN auth · fraud detection · event logging)
    ↓
UPI engine + Qdrant semantic memory
    ↓
Live dashboard (real-time events, transactions, fraud alerts)
```

**Vapi** handles speech — transcription in any Indian language, natural voice synthesis.  
**Hono backend** validates, authenticates (PIN), checks fraud, and dispatches tool calls.  
**Qdrant** stores every transaction as a vector embedding — enabling queries like *"what was my last payment to Ramesh?"* with semantic search, no keywords.  
**Dashboard** gives operators a live view of every agent decision, transaction, and fraud block.

---

## Features

| Feature | Details |
|---------|---------|
| Voice transactions | Check balance, send money, view history — by speaking |
| PIN 2FA | User-owned 4-digit PIN required for every transfer; hashed in memory; 3-attempt lock |
| Fraud detection | Velocity checks — 3+ transactions in 5 min triggers a block; logged as fraud alert |
| Semantic memory | Qdrant vector search over transaction history; multilingual recall |
| Multi-tenant isolation | `group_id` index on Qdrant; all queries scoped per tenant |
| Live dashboard | Real-time event feed, transaction table, fraud alerts, stats cards |
| Audit trail | Every tool call, PIN verification, and fraud event logged with timestamp |

---

## Tools (Vapi functions)

| Tool | Parameters | What it does |
|------|-----------|--------------|
| `checkBalance` | `userId` | Returns current account balance |
| `checkPinStatus` | `userId` | Returns whether user has set a PIN |
| `setPin` | `userId`, `pin` | Sets a new 4-digit PIN |
| `changePin` | `userId`, `currentPin`, `newPin` | Changes PIN after verifying current |
| `sendMoney` | `senderId`, `receiverId`, `amount` | Initiates a transfer (pending PIN) |
| `confirmSendMoney` | `senderId`, `pin` | Verifies PIN and completes the transfer |
| `getTransactionHistory` | `userId` | Lists recent sent and received transactions |
| `recallContext` | `userId`, `query` | Semantic search over past interactions |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Voice AI | Vapi — Deepgram Nova 2 transcriber, Azure multilingual voice |
| Backend | Node.js · TypeScript · Hono (sub-300ms latency target) |
| Validation | Zod (strict schemas on all external inputs) |
| Vector DB | Qdrant Cloud (semantic memory + multi-tenant isolation) |
| Logging | Pino (structured JSON) |
| Dashboard | Next.js 16 · Tailwind CSS · shadcn/ui |
| Testing | Vitest — 18 test files, 166 tests |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ujjwalsai3007/Voice-Societal-Impact.git
cd Voice-Societal-Impact
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
VAPI_SECRET=your-vapi-webhook-secret
```

### 3. Start the backend

```bash
npm run dev
```

### 4. Start the dashboard

```bash
cd dashboard && npm run dev
# Opens at http://localhost:3001
```

### 5. Expose publicly for Vapi webhooks

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://xxxx.trycloudflare.com` URL — this is your Vapi webhook URL.

### 6. Run tests

```bash
npm test
```

---

## Vapi Setup

### Bootstrap tools via API (recommended)

Add to `.env`:

```env
VAPI_PRIVATE_KEY=your-vapi-private-api-key
VAPI_TOOL_SERVER_URL=https://xxxx.trycloudflare.com/webhook/vapi
```

Then run:

```bash
npm run bootstrap:vapi-tools
```

This creates all 8 tools in your Vapi org automatically.

### Manual setup

1. Go to [dashboard.vapi.ai](https://dashboard.vapi.ai) → **Tools** → create each tool from the table above, all pointing to `https://xxxx.trycloudflare.com/webhook/vapi`
2. Open your assistant → attach all 8 tools
3. Paste the system prompt from [`docs/vapi-system-prompt.md`](docs/vapi-system-prompt.md)

---

## Project Structure

```
src/
  index.ts                # Server entry — Hono app + REST API endpoints
  lib/
    config.ts             # Environment variable loading (Zod)
    logger.ts             # Pino structured logger
  services/
    upi.ts                # UPI engine — balance, initiate/confirm transfer
    upi-tools.ts          # Vapi tool handler registration
    fraud.ts              # Velocity-based fraud detection
    pin.ts                # PIN lifecycle — set, verify, change (hashed)
    event-store.ts        # In-memory event log — transactions, fraud, PIN
    qdrant.ts             # Qdrant client, collection, payload indexes
    memory.ts             # Vector memory upsert, recall, history
    embedding.ts          # Deterministic 384-dim text embeddings
    cache.ts              # TTL cache
  webhooks/
    router.ts             # POST /webhook/vapi — parse and dispatch
    dispatcher.ts         # Tool call registry and execution
    schemas.ts            # Zod schemas for Vapi payloads
    verify.ts             # Webhook signature verification
dashboard/                # Next.js live monitoring dashboard
docs/
  vapi-system-prompt.md   # Copy-paste system prompt for Vapi assistant
scripts/
  bootstrap-vapi-tools.ts # Creates all Vapi tools via REST API
tests/                    # 18 test files — unit, integration, e2e, load
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/webhook/vapi` | Vapi tool-call webhook |
| `GET` | `/api/events` | All logged events (supports `?limit=N`) |
| `GET` | `/api/transactions` | Transaction events only |
| `GET` | `/api/fraud-alerts` | Fraud alert events only |
| `GET` | `/api/stats` | Aggregated stats (totals, volume, blocked count) |

---

## License

ISC

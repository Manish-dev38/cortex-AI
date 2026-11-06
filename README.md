# CortexAI

CortexAI is an AI workspace built as a small MERN monorepo. A React/Vite client talks to a single
Express gateway; the gateway authenticates the session and proxies to four internal services:
auth, chat, agent, and billing.

```
Browser ──cookie──▶ gateway :5000
                      ├─ /api/auth    ─▶ auth    :7001  (sessions, plan, credit ledger)
                      ├─ /api/chat    ─▶ chat    :8002  (conversations, messages)
                      ├─ /api/agent   ─▶ agent   :3001  (LangGraph agents, LLM calls)
                      ├─ /api/billing ─▶ billing :8004  (Razorpay orders, refunds)
                      └─ /api/me      ─▶ auth    :7001
```

## Layout

| Path | What it is |
| --- | --- |
| `backend/geteway` | Public entry point. Session auth, CORS, security headers, proxying. |
| `backend/services/auth` | Firebase login, Redis sessions, plan/credit endpoints, credit ledger. |
| `backend/services/chat` | Conversation and message persistence. |
| `backend/services/agent` | Agent router, LLM providers, file uploads, Qdrant/S3 utilities. |
| `backend/services/billing` | Razorpay orders, verification, webhooks, refunds. |
| `backend/shared` | Shared internal-auth middleware and the Redis client. |
| `frontend` | React + Redux Toolkit + Tailwind UI. |

## Security model

- **The gateway is the only public surface.** Every other service binds to `127.0.0.1` by
  default, rejects browser traffic, and requires `x-service-token` matching
  `INTERNAL_SERVICE_TOKEN` on every route except provider webhooks.
- **Identity is injected, never trusted from the client.** The gateway resolves the opaque
  session cookie (`Redis: { userId }`) and forwards `x-user-id`. Services overwrite any
  client-supplied value.
- **The session carries identity only.** Plan and credits are read from MongoDB on every
  `/api/me`, so they cannot go stale in Redis.
- **Credits move through an append-only ledger.** Every reserve/refund/grant/revoke/restore has
  an idempotency key with a unique index; retries cannot double-charge or double-grant.
- **Charging is reserve-before-generation.** If generation fails, the agent refunds the
  reservation. Insufficient balance fails before any model call.
- **Plan expiry is enforced at read time.** An expired paid plan behaves as `free` without a
  background job.
- **Billing is server-priced.** The client can no longer supply proration, and every credit
  acknowledgement is checked before a payment is treated as applied.

## Prerequisites

- Node.js 20+ and npm (the repo standardises on `package-lock.json`; do not add a second
  lockfile)
- MongoDB (local or Atlas) and Redis 7+
- Firebase project for Google sign-in
- Razorpay account for billing
- Groq / OpenRouter / Tavily / AWS S3 / Qdrant credentials for the agent service

## Setup

1. Install dependencies per workspace (npm workspaces are not configured, so run each):

   ```bash
   cd backend/geteway && npm install
   cd ../services/auth && npm install
   cd ../chat && npm install
   cd ../agent && npm install
   cd ../billing && npm install
   cd ../../../frontend && npm install
   ```

2. Copy each `.env.example` to `.env` and fill it in:

   ```bash
   backend/geteway/.env.example          -> backend/geteway/.env
   backend/services/auth/.env.example    -> backend/services/auth/.env
   backend/services/chat/.env.example    -> backend/services/chat/.env
   backend/services/agent/.env.example   -> backend/services/agent/.env
   backend/services/billing/.env.example -> backend/services/billing/.env
   frontend/.env.example                 -> frontend/.env
   ```

   Generate one `INTERNAL_SERVICE_TOKEN` and use the **same value** in the gateway, auth, chat,
   agent, and billing. Auth additionally needs Firebase Admin credentials in
   `backend/services/auth/serviceAccountKey.json` (never committed).

3. Start everything in separate terminals:

   ```bash
   cd backend/services/auth    && npm run dev
   cd backend/services/chat    && npm run dev
   cd backend/services/agent   && npm run dev
   cd backend/services/billing && npm run dev
   cd backend/geteway          && npm run dev
   cd frontend                 && npm run dev
   ```

   The client runs on `http://localhost:5173`, the gateway on `http://localhost:5000`.

## Tests

Targeted regression tests use the built-in Node test runner and `supertest`, with
`mongodb-memory-server` for Mongo-backed suites.

```bash
cd backend/services/auth && npm test
cd backend/services/chat && npm test
cd backend/services/billing && npm test
cd backend/shared && npm test
cd backend/services/agent && npm test
```

These suites are offline (memory Mongo, no external APIs). They do not replace a live smoke test
of login, chat, upload, and a Razorpay test-mode purchase.

## Operational docs

- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — secret rotation, incident checklist, retention
  behaviour, and the post-deploy smoke test.

## Known follow-ups

- Event-based credit clawback for provider-initiated refunds and disputes.
- Replace the OpenRouter-backed embeddings config if OpenAI embeddings are required.
- Observability (structured logs, metrics, tracing) and CI.
- Containerised deployment and a rename of the `geteway` directory.

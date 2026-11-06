# Operations runbook

## Secret rotation

The repository was previously published with a MongoDB connection string in source comments.
Treat every credential that was ever committed, pasted into a file, or shipped in a client build
as compromised, even after the line is removed. Rotate in this order:

1. **MongoDB Atlas**
   - Create a new database user with the same role, or rotate the existing user's password.
   - Update `MONGODB_URI` in auth, chat, agent, and billing.
   - Delete the old user / revoke the old connection string.
   - Confirm no service logs the URI on boot.
2. **Redis**
   - Change the password or ACL user in `REDIS_URL` for gateway, auth, and agent.
   - Restart all three; sessions are lost, so users must sign in again.
3. **Firebase**
   - Rotate the service-account key for `backend/services/auth/serviceAccountKey.json`.
   - Restrict the browser API key by HTTP referrer in the Firebase console.
4. **Razorpay**
   - Rotate `RAZOR_KEY_SECRET`; update billing.
   - Set a distinct `RAZOR_WEBHOOK_SECRET` in the Razorpay dashboard and in billing.
   - Re-check the webhook URL is `https://<gateway-host>/api/billing/webhook`.
5. **LLM / search / storage**
   - Rotate `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`.
   - Rotate `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` and restrict the IAM policy to the one bucket.
   - Rotate `QDRANT_API_KEY`.
6. **Internal service token**
   - Generate once: `node -e "console.log(require('crypto').randomUUID())"`.
   - Set the same `INTERNAL_SERVICE_TOKEN` in gateway, auth, chat, agent, billing.
   - Restart all five. Any service without it refuses to boot.

After rotation, run the smoke test below and confirm the old credentials no longer authenticate.

## Credential handling rules

- `.env` and `serviceAccountKey.json` are git-ignored. Never paste real values into source,
  tests, issues, PR descriptions, or screenshots.
- Only the gateway port is public. Every service must keep `HOST=127.0.0.1` unless it sits behind
  a private network / reverse proxy that enforces the same boundary.
- `COOKIE_SECURE=true` (or `NODE_ENV=production`) is required whenever the client is served over
  HTTPS. `COOKIE_SAME_SITE=none` also requires `COOKIE_SECURE=true`.
- The browser must use `VITE_SERVER_URL` pointing at the gateway, never at a service port.

## Data retention

- Chat retention intent is **3 days of inactivity**.
- `Conversation.updatedAt` carries the TTL index, and every message write bumps it.
- Messages have no TTL of their own; the chat service sweeps messages whose conversation is gone
  once per hour.
- Agent Redis memory (`message-<conversationId>`) also expires after 48 hours.
- Per-upload Qdrant collections are deleted in a `finally` block after each PDF request.
- Agent uploads under `temp/` are deleted in a `finally` block after every request.

## Post-deploy smoke test

Run against the deployed gateway with a real browser session:

1. Sign in with Google; `/api/me` returns a `planId` and credits.
2. Create a chat, send a message, reload, and confirm history loads.
3. Send a coding prompt; confirm the artifact panel opens and a credit is deducted once.
4. Upload an image; confirm analysis works and the temp upload is gone.
5. Open Billing, complete a **test-mode** payment; confirm plan and credits update without a
   reload, and that a duplicate verify does not grant twice.
6. Request a refund; confirm the order becomes `refunded` and credits are clawed back.
7. Verify an anonymous request to a service port (e.g. `curl http://<host>:7001/me`) is refused.
8. Confirm the Razorpay webhook endpoint accepts a signed event and rejects an unsigned one.

## Incident checklist

1. Rotate the affected credential first, then investigate.
2. Revoke all sessions by rotating `INTERNAL_SERVICE_TOKEN` or flushing Redis session keys.
3. Preserve logs; they intentionally omit request bodies, tokens, and user identifiers.
4. Check the credit ledger for anomalies: `CreditTransaction` rows are append-only with a unique
   idempotency key, so gaps or duplicate grants are visible.
5. For billing incidents, reconcile `Payment` records against the Razorpay dashboard before
   issuing manual credits.

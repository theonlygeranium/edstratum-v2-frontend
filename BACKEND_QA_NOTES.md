# Backend QA Notes — StratumChat Railway Service

**Last updated:** 2026-07-20  
**Applies to:** `stratum-backend-production-a340.up.railway.app`

---

## The Problem This Solves

The escalation flow (`trigger: 'high_intent' | 'explicit' | 'sentiment' | 'confidence'`) currently fires real outbound notifications (email, webhook, or similar) whenever the `done` SSE event carries an escalation payload. This makes it impossible to QA the escalation path safely without triggering live notifications.

---

## Recommended: `X-Stratum-QA` Request Header

Implement a suppression flag on the Railway backend. When present, the backend runs the full escalation logic — building the snapshot, setting the trigger type, streaming the response — but **skips all outbound notifications**.

### Frontend usage (CI / local testing)

The frontend already passes a `sessionId` in the request body. Add the header in `stratumApi.ts` when `VITE_STRATUM_API_URL` is set and a QA flag env var is present:

```ts
// In streamStratumResponse(), add to the fetch headers:
...(import.meta.env.VITE_STRATUM_QA === 'true' && {
  'X-Stratum-QA': 'suppress-notifications',
}),
```

Set `VITE_STRATUM_QA=true` in the Cloudflare Pages **Preview** environment variables only — never in Production.

### Backend implementation (Railway — Python/FastAPI)

```python
# In your /api/chat handler, before any notification dispatch:
is_qa = request.headers.get("X-Stratum-QA") == "suppress-notifications"

# Guard every outbound call:
if not is_qa:
    await send_escalation_email(snapshot)
    await post_discord_webhook(snapshot)
```

Keep the QA header check simple — no auth token needed. The header name itself is the shared secret between frontend and backend; it is not a security boundary, only a safety guardrail for test runs.

---

## CI Integration

In `.github/workflows/ci.yml`, the preview server runs without `VITE_STRATUM_API_URL`, so the frontend uses **mock mode** and never reaches Railway at all. The `X-Stratum-QA` header is therefore only needed when:

1. Running Playwright tests against a **staging** Cloudflare Pages URL that has `VITE_STRATUM_API_URL` set to a staging Railway deployment.
2. Manually QA-ing the escalation path locally with the real backend.

---

## Staging Environment Checklist

When the Railway staging service is provisioned:

- [ ] Set `RAILWAY_ENV=staging` in Railway env vars
- [ ] Configure backend CORS to allow `*.edstratumlabs.pages.dev` (CF Pages preview URLs)
- [ ] Set `VITE_STRATUM_API_URL=https://<staging-service>.up.railway.app` in CF Pages **Preview** env vars
- [ ] Set `VITE_STRATUM_QA=true` in CF Pages **Preview** env vars
- [ ] Confirm staging backend reads `X-Stratum-QA` and suppresses outbound notifications
- [ ] Confirm production Railway service does **not** read `VITE_STRATUM_QA` (it's a frontend-only var)

---

## Notes for Future Agents

- Do not trigger the live Connect button or any escalation path during automated QA unless `X-Stratum-QA` suppression is confirmed active on the backend.
- The mock layer in `stratumMock.ts` already handles escalation events safely — prefer mock mode for all routine frontend testing.
- The Railway backend URL is compiled into the production bundle at build time via `VITE_STRATUM_API_URL`. Changing it requires a new Cloudflare Pages deployment.

---

## Feature Branch Note — `feat/rag-backend`

**Updated:** 2026-07-20

- Backend branch `feat/rag-backend` adds a `citations` SSE event with `{ source, excerpt }` rows for grounded RAG answers, while preserving the existing `source` confidence event and terminal `done` event.
- Frontend branch `feat/rag-backend` parses the new event, stores citations on assistant messages, renders an accessible expandable citation panel, and keeps mock mode representative.
- Local QA completed on the branch:
  - Backend: `./.venv/bin/pytest -q` -> `112 passed, 1 skipped`
  - Frontend: `npm run lint`, `npm run build`, `npm test -- --reporter=list` -> `36 passed`
- This note is branch status only. It does not prove production deployment until both repos are merged/deployed and live QA confirms the production bundle/backend event stream.

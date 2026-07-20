# Backend QA Notes — StratumChat Railway Service

**Last updated:** 2026-07-20  
**Applies to:** `stratum-backend-production-a340.up.railway.app`

---

## The Problem This Solves

The escalation flow (`trigger: 'high_intent' | 'explicit' | 'sentiment' | 'confidence'`) currently fires real outbound notifications (email, webhook, or similar) whenever the `done` SSE event carries an escalation payload. This makes it impossible to QA the escalation path safely without triggering live notifications.

---

## Implemented: `X-Stratum-QA` Request Header

The Railway backend supports a suppression flag. When present, the backend runs the full escalation logic — building the snapshot, setting the trigger type, streaming the response — but **skips all outbound notifications**.

### Frontend usage (CI / local testing)

The frontend passes a `sessionId` in the request body and adds the header in `stratumApi.ts` when `VITE_STRATUM_API_URL` is set and `VITE_STRATUM_QA=true`:

```ts
headers['X-Stratum-QA'] = 'true'
```

Set `VITE_STRATUM_QA=true` in the Cloudflare Pages **Preview** environment variables only — never in Production.

### Backend implementation (Railway — Python/FastAPI)

```python
# The backend treats X-Stratum-QA: true as notification-suppressed QA.
is_qa = request.headers.get("X-Stratum-QA") == "true"
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
- [ ] Configure backend CORS with each exact Cloudflare Pages preview/staging origin, or add a reviewed backend source change for regex-based preview origin support. The current backend uses exact `allow_origins`, not wildcard matching.
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

## Production Note — RAG Citations

**Updated:** 2026-07-20

- Backend commit `cde0dbe` adds a `citations` SSE event with `{ source, excerpt }` rows for grounded RAG answers, while preserving the existing `source` confidence event and terminal `done` event.
- Frontend commit `ec95e8b` parses the new event, stores citations on assistant messages, renders an accessible expandable citation panel, and keeps mock mode representative.
- Local QA completed before merge:
  - Backend: `./.venv/bin/pytest -q` -> `112 passed, 1 skipped`
  - Frontend: `npm run lint`, `npm run build`, `npm test -- --reporter=list` -> `36 passed`
- Production QA completed after merge:
  - Railway public `/api/health` includes `rag: { status: "ok", vectorStoreConnected: true }`.
  - Live `/api/chat` SSE smoke returned HTTP 200, terminal `done`, and `3` citation rows with `X-Stratum-Eval: true`.
  - Live `https://edstratumlabs.ai` rendered the citation panel from the production backend and expanded excerpts successfully.

## Production Note — Escalation Email Safety

**Updated:** 2026-07-20

- Feature 2 is deployed from backend commit `ad1593b` and frontend commits `5955dff` / `371f634`.
- Backend adds structured escalation delivery metadata to terminal `done` SSE events, a safe `/api/escalate` contract route, HTML plus plaintext Resend payloads, session rate limiting, env aliases `ESCALATION_EMAIL_TO` / `ESCALATION_EMAIL_FROM`, and notification suppression for `X-Stratum-QA: true`, `X-Stratum-QA: suppress-notifications`, and `X-Stratum-Eval: true`.
- Frontend consumes delivery metadata and renders success/failure system confirmations without sending any separate duplicate request. Commit `371f634` also restores live Railway connectivity when Cloudflare Pages production builds without `VITE_STRATUM_API_URL`.
- QA completed before and after merge:
  - Backend: `./.venv/bin/pytest -q` -> `116 passed, 1 skipped`
  - Frontend: `npm run lint`, `npm run build`, `npm test -- --reporter=list` -> `42 passed`
  - Production backend: `/api/escalate` with `X-Stratum-QA: true` -> `{ success: true, status: "suppressed", messageId: "qa-suppressed" }`
  - Production chat: `/api/chat` with `X-Stratum-Eval: true` returned terminal `done.escalation.status: "suppressed"` for an explicit escalation prompt
  - Live frontend: rendered success/failure confirmations were verified with intercepted SSE only, so no live handoff email was sent

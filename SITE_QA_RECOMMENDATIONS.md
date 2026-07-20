# EdStratum Frontend QA And Recommendations

Date: 2026-07-20

## Current State

- Source of record: `https://github.com/theonlygeranium/edstratum-v2-frontend`
- Latest frontend production code commit verified: `3372b43`
- Cloudflare Pages project: `edstratumlabs`
- Cloudflare source: GitHub repo `theonlygeranium/edstratum-v2-frontend`
- Production domain: `https://edstratumlabs.ai`
- Backend origin compiled into production build: `https://stratum-backend-production-a340.up.railway.app`
- Current production entry asset: `/assets/index-CAfNfkao.js`
- Current STRATUM chat asset: `/assets/StratumChat-9GA-qGlc.js`

The recovered frontend source now includes the STRATUM chatbot under `src/stratum/`. The previous artifact-only chatbot patch is no longer the only source of truth.

## QA Completed

- `npm run build` passes with TypeScript and Vite.
- Clean production build with `VITE_STRATUM_API_URL` emits `dist/assets/StratumChat-Cl3e2M0J.js`.
- Source and built output scan clean for personal-name, direct-person CTA, and scheduling-link copy.
- Local production preview in mock mode passes desktop and mobile chatbot open/respond checks.
- Live production domain loads the source-built entrypoint `/assets/index-BChwigZm.js`.
- Live production chatbot successfully reaches Railway `/api/chat` with HTTP 200.
- Live completed response contains discretion-safe escalation language using `Founding leadership team`.
- Live production chatbot renders expandable RAG citation panels from backend `citations` SSE events.
- Branch and production QA for RAG citations passed: local `npm run lint`, `npm run build`, `npm test -- --reporter=list` (`36 passed`), GitHub status `CI / build-and-test`, Cloudflare Pages production check, and live rendered smoke on `https://edstratumlabs.ai`.
- Feature 2 escalation delivery UI is deployed. Local, branch, and production CI passed with `42` Playwright tests; live backend suppression endpoints passed; live rendered QA verified a real non-escalation backend chat and intercepted escalation success/failure confirmations without sending email.
- Feature 3 Cloudflare Pages Functions middleware is deployed. Local, branch, and production CI passed with `54` Playwright tests; live `/api/config` and `/api/health` returned HTTP 200 with cache headers from Cloudflare Pages Functions.
- Feature 4 sentiment escalation UI is deployed. Local and hosted CI passed with `64` Playwright tests; production rendered smoke intercepted `/api/chat` and confirmed urgency sends `escalationTrigger: "sentiment"` plus `sentimentSignal: "urgency"` while rendering the leadership handoff UI without sending email.

## Notes For Future Agents

- Do not edit deployed Cloudflare bundle artifacts directly unless source is unavailable and the change is urgent.
- The chatbot uses `VITE_STRATUM_API_URL`; omit it locally to use mock mode and avoid accidental escalation emails.
- Do not trigger live escalation flows during QA unless notifications are explicitly suppressed or the user asks for an email test.
- Cloudflare Pages is connected to the private GitHub frontend repo.
- Pushes to `main` automatically deploy production; pushes to feature branches create preview deployments.
- The frontend has a production-host fallback to `https://stratum-backend-production-a340.up.railway.app` if `VITE_STRATUM_API_URL` is missing on `edstratumlabs.ai` or `www.edstratumlabs.ai`.
- Preview env vars were last verified as unset, so branch previews use mock chat unless the backend URL is added to preview settings.
- CI posts commit status context `CI / build-and-test`; configure branch protection to require it before merges to `main`.
- Production CORS allows `https://edstratumlabs.ai`; localhost requests to Railway are expected to fail unless backend CORS is expanded for local development.

## Completed Feature 1

- Enhancement spec Feature 1 citation UI delta is deployed: frontend `citations` SSE parsing, accessible expandable citation panels, representative mock citations, and `tests/rag.spec.ts`.
- Production Cloudflare deployment for frontend commit `ec95e8b` succeeded, and live citation UI smoke passed against the Railway backend.

## Completed Feature 2

- Enhancement spec Feature 2 is deployed: frontend `done.escalation` parsing, user-visible success/failure system confirmations, mock success/failure coverage, and `tests/escalation.spec.ts`.
- Frontend commits `5955dff` and `371f634` are deployed on Cloudflare Pages production. `371f634` adds a production-host backend fallback for `edstratumlabs.ai` / `www.edstratumlabs.ai` while localhost and branch previews remain mock-mode by default.
- Live rendered QA on 2026-07-20 verified the production site made one real non-escalation backend request for a RAG chat, displayed citations, and rendered escalation success/failure confirmations through intercepted SSE only, so no live handoff email was sent.

## Completed Feature 3

- Enhancement spec Feature 3 is deployed: Cloudflare Pages Functions for `/api/health`, `/api/config`, and best-effort API rate limiting when KV bindings are available.
- Frontend commit `2f95db5` is deployed on Cloudflare Pages production.
- Local, preview, and production QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npx wrangler pages functions build`, `npm test -- --reporter=list` (`54 passed`), `wrangler pages dev dist --port 8788` smoke for `/api/config` and `/api/health`, Cloudflare preview Functions smoke, and production Functions smoke.
- Wrangler is not authenticated in this shell, so KV namespace creation and dashboard binding remain pending: `STRATUM_CONFIG` and `RATE_LIMIT`.
- Until KV is bound, `/api/config` returns safe default runtime flags and `_middleware.ts` skips rate limiting.

## Completed Feature 4

- Enhancement spec Feature 4 is deployed: frontend sentiment detection, frustration handoff CTA, urgency auto-handoff, 10-minute cooldown after escalation events, mock sentiment test mode, and `tests/sentiment.spec.ts`.
- Frontend commit `3372b43` is deployed on Cloudflare Pages production with chat asset `/assets/StratumChat-9GA-qGlc.js`.
- Local QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npm test -- tests/sentiment.spec.ts --reporter=list` (`10 passed`), and `npm test -- --reporter=list` (`64 passed`).
- Hosted branch and main CI passed on 2026-07-20 with `64 passed`; production rendered smoke confirmed urgency auto-handoff UI and captured the safe sentiment payload via intercepted SSE only, so no live handoff email was sent.

## Recommended Next Steps

1. Add/verify Cloudflare preview env var `VITE_STRATUM_API_URL` if preview branches should exercise the live backend instead of mock chat.
2. Keep the lightweight Playwright test suite covering:
   - page loads without console errors
   - chatbot opens on desktop and mobile
   - prompt chips submit without forbidden copy
   - escalation copy remains discretion-safe
3. Keep production `VITE_STRATUM_API_URL` configured in Cloudflare Pages even though the source fallback now protects the live hostname.
4. Create and bind Feature 3 KV namespaces in Cloudflare Pages once Wrangler or dashboard credentials are available.
5. Add a GitHub branch protection rule for `main` requiring `CI / build-and-test`.
6. Create a staging Pages project or preview environment with a backend CORS origin dedicated to agent QA if branch previews should not use production backend.
7. Once a scheduling link is provisioned, add scheduling only through an explicit reviewed config flag rather than hardcoded frontend copy.
8. Add lightweight analytics for chatbot open rate, prompt chip usage, completed readiness checks, and escalation intent without logging sensitive conversation text.

# EdStratum Frontend QA And Recommendations

Date: 2026-07-20

## Current State

- Source of record: `https://github.com/theonlygeranium/edstratum-v2-frontend`
- Latest source commit observed in production deployment metadata: `ec95e8b`
- Cloudflare Pages project: `edstratumlabs`
- Cloudflare source: GitHub repo `theonlygeranium/edstratum-v2-frontend`
- Production domain: `https://edstratumlabs.ai`
- Backend origin compiled into production build: `https://stratum-backend-production-a340.up.railway.app`
- Current production entry asset: `/assets/index-BmMnKl08.js`
- Current STRATUM chat asset: `/assets/StratumChat-DcniEbxZ.js`

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

## Notes For Future Agents

- Do not edit deployed Cloudflare bundle artifacts directly unless source is unavailable and the change is urgent.
- The chatbot uses `VITE_STRATUM_API_URL`; omit it locally to use mock mode and avoid accidental escalation emails.
- Do not trigger live escalation flows during QA unless notifications are explicitly suppressed or the user asks for an email test.
- Cloudflare Pages is connected to the private GitHub frontend repo.
- Pushes to `main` automatically deploy production; pushes to feature branches create preview deployments.
- Production has `VITE_STRATUM_API_URL` configured. Preview env vars were last verified as unset, so branch previews may use mock chat unless the backend URL is added to preview settings.
- CI posts commit status context `CI / build-and-test`; configure branch protection to require it before merges to `main`.
- Production CORS allows `https://edstratumlabs.ai`; localhost requests to Railway are expected to fail unless backend CORS is expanded for local development.

## Completed Feature 1

- Enhancement spec Feature 1 citation UI delta is deployed: frontend `citations` SSE parsing, accessible expandable citation panels, representative mock citations, and `tests/rag.spec.ts`.
- Production Cloudflare deployment for frontend commit `ec95e8b` succeeded, and live citation UI smoke passed against the Railway backend.

## Recommended Next Steps

1. Add/verify Cloudflare preview env var `VITE_STRATUM_API_URL` if preview branches should exercise the live backend instead of mock chat.
2. Keep the lightweight Playwright test suite covering:
   - page loads without console errors
   - chatbot opens on desktop and mobile
   - prompt chips submit without forbidden copy
   - escalation copy remains discretion-safe
3. Add a backend eval-only or staging header path for safe escalation QA without sending email.
4. Add a GitHub branch protection rule for `main` requiring `CI / build-and-test`.
5. Create a staging Pages project or preview environment with a backend CORS origin dedicated to agent QA if branch previews should not use production backend.
6. Once a scheduling link is provisioned, add scheduling only through an explicit reviewed config flag rather than hardcoded frontend copy.
7. Improve the chat control accessibility with Escape-to-close, focus return, and optional transcript reset.
8. Add lightweight analytics for chatbot open rate, prompt chip usage, completed readiness checks, and escalation intent without logging sensitive conversation text.

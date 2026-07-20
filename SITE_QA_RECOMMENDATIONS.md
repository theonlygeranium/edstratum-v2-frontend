# EdStratum Frontend QA And Recommendations

Date: 2026-07-20

## Current State

- Source of record: `https://github.com/theonlygeranium/edstratum-v2-frontend`
- Latest source commit verified and deployed: `6e1f3d5`
- Cloudflare Pages project: `edstratumlabs`
- Production domain: `https://edstratumlabs.ai`
- Backend origin compiled into production build: `https://stratum-backend-production-a340.up.railway.app`

The recovered frontend source now includes the STRATUM chatbot under `src/stratum/`. The previous artifact-only chatbot patch is no longer the only source of truth.

## QA Completed

- `npm run build` passes with TypeScript and Vite.
- Clean production build with `VITE_STRATUM_API_URL` emits `dist/assets/StratumChat-Cl3e2M0J.js`.
- Source and built output scan clean for personal-name, direct-person CTA, and scheduling-link copy.
- Local production preview in mock mode passes desktop and mobile chatbot open/respond checks.
- Live production domain loads the source-built entrypoint `/assets/index-BChwigZm.js`.
- Live production chatbot successfully reaches Railway `/api/chat` with HTTP 200.
- Live completed response contains discretion-safe escalation language using `Founding leadership team`.

## Notes For Future Agents

- Do not edit deployed Cloudflare bundle artifacts directly unless source is unavailable and the change is urgent.
- The chatbot uses `VITE_STRATUM_API_URL`; omit it locally to use mock mode and avoid accidental escalation emails.
- Do not trigger live escalation flows during QA unless notifications are explicitly suppressed or the user asks for an email test.
- Cloudflare Pages is still being deployed by direct Wrangler upload. The repo is private but not yet confirmed as a connected Cloudflare Git integration.
- Production CORS allows `https://edstratumlabs.ai`; localhost requests to Railway are expected to fail unless backend CORS is expanded for local development.

## Recommended Next Steps

1. Connect Cloudflare Pages to the private GitHub repo so `main` deploys automatically from source.
2. Add a lightweight Playwright test suite for:
   - page loads without console errors
   - chatbot opens on desktop and mobile
   - prompt chips submit without forbidden copy
   - escalation copy remains discretion-safe
3. Add a backend eval-only or staging header path for safe escalation QA without sending email.
4. Add a frontend CI workflow that runs `npm ci`, `npm run build`, and forbidden-copy scans before deploy.
5. Create a staging Pages project or preview environment with a backend CORS origin dedicated to agent QA.
6. Once a scheduling link is provisioned, add scheduling only through an explicit reviewed config flag rather than hardcoded frontend copy.
7. Improve the chat control accessibility with Escape-to-close, focus return, and optional transcript reset.
8. Add lightweight analytics for chatbot open rate, prompt chip usage, completed readiness checks, and escalation intent without logging sensitive conversation text.

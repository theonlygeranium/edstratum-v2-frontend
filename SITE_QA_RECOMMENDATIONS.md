# EdStratum Frontend QA And Recommendations

Date: 2026-07-20

## Current State

- Source of record: `https://github.com/theonlygeranium/edstratum-v2-frontend`
- Latest frontend production source/tooling commit verified locally and live: `bb8f3b4`
- Latest verified app code-bearing asset commit: `36f201f`; live-smoke deployment manifest commit `bb8f3b4` left the code-bearing asset hashes unchanged, and later report-only pushes can advance the manifest git SHA while leaving those hashes unchanged.
- GitHub Actions action-migration commit verified: `d01ce68`; frontend CI app-runtime migration commit verified: `f2c969b`; CI Playwright server-ownership fix commit `84e01ce` is already contained in current `main`; Wrangler pin commit `76b97ba` and live-smoke command commit `bb8f3b4` are deployed, but hosted CI proof is pending because GitHub Actions run `29743225634` failed before starting any steps due to an account billing/spending-limit blocker.
- Cloudflare Pages project: `edstratumlabs`
- Cloudflare source: GitHub repo `theonlygeranium/edstratum-v2-frontend`
- Production domain: `https://edstratumlabs.ai`
- Backend origin compiled into production build: `https://stratum-backend-production-a340.up.railway.app`
- Current production entry asset: `/assets/index-Cld5-OrE.js`
- Current production stylesheet asset: `/assets/index-DH0EGGDC.css`
- Current STRATUM chat asset: `/assets/StratumChat-5iN0axbq.js`
- Current PDF snapshot assets: `/assets/stratumPDF-Bgc_chGe.js`, `/assets/pdf-vendor-B7fMFYQc.js`
- Current public build manifest: `https://edstratumlabs.ai/build-manifest.json`

The recovered frontend source now includes the STRATUM chatbot under `src/stratum/`. The previous artifact-only chatbot patch is no longer the only source of truth.

Latest SOT gate status: frontend source, same-origin proxy routes, browser TTS streaming, public build manifest, QA suppression header gating, D1 deletion/retention primitives, TTS runtime fail-closed gating, microphone policy readiness, privacy-safe analytics source readiness, GitHub Actions Node 24 action/app runtime, pinned Wrangler source tooling, repeatable production live-smoke QA, and production rendering are healthy through deployed source/tooling commit `bb8f3b4`; the app code-bearing asset hashes remain those introduced by `36f201f`. Hosted CI proof for `bb8f3b4` is blocked by a GitHub account billing/spending-limit failure, and the full build spec is not yet complete because live Cloudflare/Railway configuration and managed RAG/TTS/persistence/analytics activation remain pending.

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
- Feature 5 D1 persistence scaffolding is deployed. Local, branch, and production CI passed with `84` Playwright tests; live `/api/config` remains `persistenceEnabled: false`, `/api/sessions` fails closed with `d1_not_configured`, and rendered live smoke verified chat works with no session endpoint calls while persistence is disabled.
- Feature 6 voice/TTS scaffolding is deployed and runtime-gated off. Local, branch, and production CI passed with `98` Playwright tests; live `/api/config` returns `voiceEnabled: false`, the production chat asset contains the voice/TTS code, backend health reports `tts.provider: "elevenlabs"` with `tts.status: "unconfigured"`, and rendered live smoke verified no voice controls appear while disabled.
- Feature 7 PDF snapshot download is deployed. Initial local, branch, and production CI passed with `110` Playwright tests; current production at code-bearing commit `3904989` passes `122` tests and still lazy-loads the PDF renderer chunks. Rendered live smoke intercepted `/api/chat` and verified the `Download Summary` control plus a generated PDF download without sending any live handoff email.
- SOT QA gate commit `17124c1` was previously deployed on production. Main CI `29728690249` passed, local `npm run type-check`, real `npm run lint`, `npm run build`, `npx wrangler pages functions build`, and full Playwright suite passed with `112 passed`; rendered production smoke verified intercepted handoff UI, hidden voice controls while disabled, PDF download generation, and no console/page errors.
- Same-origin proxy commit `e1ff6d6` is deployed on production. Main CI `29729914138` passed with `120 passed`; local `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused proxy/voice tests (`44 passed`), full Playwright suite (`120 passed` with one worker after a high-parallelism runner blank-page retry), and rendered production smoke passed.
- Live `https://edstratumlabs.ai/api/escalate` with `X-Stratum-QA: true` returned `200` and `status: "suppressed"`, live `/api/tts` returned backend validation `422` for an invalid payload, and live `/api/tts` returned `503 tts_not_configured` for a valid validation-only payload without invoking ElevenLabs.
- Browser TTS streaming commit `3904989` is deployed on production. Main CI `29731627328` passed with `122 passed`; local `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused voice browser tests (`16 passed`), full Playwright suite (`122 passed` with one worker), and rendered production smoke passed with zero voice controls and zero TTS calls while `voiceEnabled: false`.
- Public build manifest code-bearing commit `c5f6431` is deployed on production. Local QA passed on 2026-07-20: `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused STRATUM browser tests (`28 passed`), and full Playwright suite (`124 passed`). Hosted main CI `29733457960` passed with `124 passed`; Cloudflare Pages production succeeded; live `/build-manifest.json` returned HTTP 200 with `Cache-Control: public, max-age=60, must-revalidate`, backend URL `https://stratum-backend-production-a340.up.railway.app`, 13 assets, and a matching live chat-asset SHA-256 hash. Docs-only pushes can advance the manifest git SHA while leaving the code-bearing asset hashes unchanged.
- QA suppression header and Functions CI gate commit `43ce52e` is deployed on production. Local QA passed on 2026-07-20: `npm run type-check`, `npm run lint`, a QA build with `VITE_STRATUM_QA=true` proving `X-Stratum-QA: true` is emitted for real-backend chat requests, a normal production build proving the production chat asset does not contain `X-Stratum-QA`, `npx wrangler pages functions build`, focused escalation/sentiment tests (`16 passed`), and the full Playwright suite (`124 passed`). Hosted main CI `29735401007` passed with `124 passed` and now includes `npx wrangler pages functions build`; Cloudflare Pages production succeeded; live `/build-manifest.json` returned commit `43ce52e`, 13 assets, chat asset `/assets/StratumChat-Dr5FwyGc.js`, and a matching live chat-asset SHA-256 hash.
- Voice and persistence readiness commit `a2a9551` is deployed on production. It adds scoped `DELETE /api/sessions/:id`, admin-only `POST /api/sessions/purge` with a bounded retention window, reset-time persisted-session deletion, `idx_sessions_last_active`, same-origin microphone policy, and a same-origin `/api/tts` fail-closed gate unless runtime `voiceEnabled` is true. Local QA passed on 2026-07-20: `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused Functions tests (`42 passed`), focused persistence tests (`12 passed`), focused voice tests (`16 passed`), and full Playwright with one worker (`138 passed`). Hosted main CI `29736780944` passed with `138 passed`; live `/build-manifest.json` returned commit `a2a9551`, entry asset `/assets/index-y7cgbAE2.js`, chat asset `/assets/StratumChat-YqNBO1Mg.js`, 13 assets, and `Cache-Control: public, max-age=60, must-revalidate`. Live root headers include `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`, and live `/api/tts` returns `503` with `detail: "tts_disabled"` while `voiceEnabled` is false.
- Privacy-safe analytics commit `36f201f` is deployed on production. It adds typed and property-whitelisted STRATUM analytics events for chat open, first message, readiness completion, backend error, and handoff intent; a same-origin `/api/analytics` Pages Function that stores aggregate daily counters only when `ANALYTICS_EVENTS` is bound; and browser/Functions tests proving prompt text, intake answers, raw session IDs, and unsafe properties are not stored. Local QA passed on 2026-07-20: `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused analytics Functions tests (`10 passed`), rendered analytics browser tests (`8 passed`), and full Playwright with one worker (`156 passed`). Hosted main CI `29738422278` passed with `156 passed`; live `/build-manifest.json` returned commit `36f201f`, entry asset `/assets/index-Cld5-OrE.js`, chat asset `/assets/StratumChat-5iN0axbq.js`, 13 assets, and `Cache-Control: public, max-age=60, must-revalidate`. Live `/api/analytics` currently returns `503` with `error: "analytics_not_configured"` and `Cache-Control: no-store` because the analytics KV binding is not active.
- GitHub Actions Node 24 migration commit `d01ce68` is deployed on production. It updates action pins to `actions/checkout@v5`, `actions/setup-node@v5`, `actions/upload-artifact@v6`, and `actions/github-script@v8`; the separate frontend app runtime was later migrated in `f2c969b`. Hosted main CI `29739390956` passed with `156 passed`; strict log search found no deprecated Node.js 20 JavaScript-action warning. Live `/build-manifest.json` returned commit `d01ce68` with unchanged code-bearing assets: entry `/assets/index-Cld5-OrE.js`, stylesheet `/assets/index-DH0EGGDC.css`, chat asset `/assets/StratumChat-5iN0axbq.js`, and 13 total assets.
- Frontend CI app-runtime Node 24 commit `f2c969b` is deployed on production. It updates hosted `actions/setup-node` `node-version` and the build-step `NODE_VERSION` marker from `20` to `24` while leaving frontend source output unchanged. Local Node 24 QA passed on 2026-07-20 with `node v24.18.0`, `npm ci`, `npm run type-check`, `npm run lint`, `npm run build`, Wrangler `4.112.0` Pages Functions build, and full Playwright with one worker (`156 passed`). Hosted main CI `29741097306` passed with `156 passed`; logs confirm `node-version: 24`, `node: v24.18.0`, and `wrangler 4.112.0`. Live `/build-manifest.json` returned commit `f2c969b` with unchanged code-bearing assets: entry `/assets/index-Cld5-OrE.js`, stylesheet `/assets/index-DH0EGGDC.css`, chat asset `/assets/StratumChat-5iN0axbq.js`, and 13 total assets.
- CI Playwright server-ownership fix commit `84e01ce` is included in current `main`. It removes the workflow-managed background preview server, relies on Playwright `webServer`, switches the mobile project to `Mobile Chrome`, keeps HTML artifacts for CI failures, and scopes brittle chat button locators inside the dialog.
- Wrangler pin commit `76b97ba` is deployed on production. It adds exact devDependency `wrangler@4.112.0`, switches hosted CI and guarded `deploy.sh` to `./node_modules/.bin/wrangler`, and adds a deploy-helper preflight that asks operators to run `npm ci` if the pinned binary is absent. Local Node 24 QA passed on 2026-07-20 with `node v24.18.0`, `npm ci`, `bash -n deploy.sh`, guarded non-deploy smoke, `./node_modules/.bin/wrangler --version` returning `4.112.0`, `npm run type-check`, `npm run lint`, `npm run build`, `./node_modules/.bin/wrangler pages functions build`, and full Playwright with one worker (`156 passed`). Cloudflare Pages deployment succeeded; live `/build-manifest.json` returned commit `76b97ba`, unchanged code-bearing assets `/assets/index-Cld5-OrE.js`, `/assets/index-DH0EGGDC.css`, `/assets/StratumChat-5iN0axbq.js`, 13 total assets, and `Cache-Control: public, max-age=60, must-revalidate`. Live `/api/config` remains `ragEnabled: true`, `voiceEnabled: false`, `persistenceEnabled: false`; live `/api/tts` returns `503 tts_disabled`; live `/api/analytics` returns `503 analytics_not_configured`. Hosted GitHub Actions run `29742456851` did not start any steps because of a GitHub account billing/spending-limit failure.
- Production live-smoke command commit `bb8f3b4` is deployed on production. It adds `npm run qa:live`, a cache-busted and optional `EXPECTED_MANIFEST_COMMIT` assertion for `/build-manifest.json`, forbidden-copy scans on root HTML plus the current STRATUM chat asset, same-origin `/api/config`, `/api/health`, `/api/tts`, `/api/analytics` checks, and direct Railway `/api/health` plus `/api/runtime` checks. Local QA passed on 2026-07-20 with `npm run lint`, Node 24 `npm run type-check`, `npm run build`, `./node_modules/.bin/wrangler pages functions build`, Node 24 `EXPECTED_MANIFEST_COMMIT=7bf0df6 npm run qa:live`, and post-deploy `EXPECTED_MANIFEST_COMMIT=bb8f3b4 npm run qa:live`. Cloudflare Pages deployment succeeded; live smoke verified manifest commit `bb8f3b4`, unchanged code-bearing assets, `ragEnabled: true`, `voiceEnabled: false`, `persistenceEnabled: false`, same-origin and direct Railway healthy RAG, `tts_disabled` no-store, `analytics_not_configured` no-store, and direct runtime providers `hash` / `chroma` / `writer`. Hosted GitHub Actions run `29743225634` did not start any steps because of the GitHub billing/spending-limit blocker.
- Backend production live-smoke command commit `5793eee` is deployed on Railway. It adds `scripts/live_backend_smoke.py` for public `/api/health`, production CORS, `/api/runtime`, grounded RAG SSE with citations, and `X-Stratum-Eval: true` suppressed escalation SSE checks. Backend local QA passed with full pytest (`129 passed, 1 skipped`), RAG eval (`passed: true`, recall@10 `1.0`, groundedness proxy `1.0`), and pre/post-deploy backend live smoke; frontend `EXPECTED_MANIFEST_COMMIT=50fc7b0 npm run qa:live` also passed after the Railway deploy.

## Notes For Future Agents

- Do not edit deployed Cloudflare bundle artifacts directly unless source is unavailable and the change is urgent.
- The chatbot uses `VITE_STRATUM_API_URL`; omit it locally to use mock mode and avoid accidental escalation emails.
- Set `VITE_STRATUM_QA=true` only for preview/staging/live QA builds that intentionally need `X-Stratum-QA: true`; keep it unset in production.
- Do not trigger live escalation flows during QA unless notifications are explicitly suppressed or the user asks for an email test.
- Cloudflare Pages is connected to the private GitHub frontend repo.
- Pushes to `main` automatically deploy production; pushes to feature branches create preview deployments.
- `deploy.sh` is an emergency direct-upload fallback only and requires explicit confirmation env vars; normal production releases should stay source-driven through GitHub-connected Cloudflare Pages.
- The frontend has a production-host fallback to `https://stratum-backend-production-a340.up.railway.app` if `VITE_STRATUM_API_URL` is missing on `edstratumlabs.ai` or `www.edstratumlabs.ai`.
- Preview env vars were last verified as unset, so branch previews use mock chat unless the backend URL is added to preview settings.
- CI posts commit status context `CI / build-and-test`; configure branch protection to require it before merges to `main`.
- Production CORS allows `https://edstratumlabs.ai` and `http://localhost:5173`; other local or preview origins need explicit expansion.
- D1 persistence is source-ready but inactive until Cloudflare D1 binding `STRATUM_DB`, env var `SESSION_SECRET`, schema execution, and KV runtime flag `persistenceEnabled: true` are configured. Source now includes scoped session deletion and admin retention purge primitives.
- Voice/TTS is source-ready, including same-origin browser playback through MediaSource when supported, but inactive until Railway `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, Cloudflare Pages `VITE_TTS_ENABLED=true`, and runtime config `voiceEnabled: true` are configured. Same-origin `/api/tts` returns `tts_disabled` until runtime voice is enabled.
- PDF snapshot generation is client-side and lazy-loaded from `src/lib/stratumPDF.tsx`; there is no server round-trip or Node `fs`/`path`/`crypto` import in the client source.
- Production same-origin Cloudflare Functions currently exist for `/api/config`, `/api/health`, `/api/sessions`, `/api/escalate`, `/api/tts`, and `/api/analytics`. The TTS player now targets same-origin `/api/tts` when voice playback is enabled.
- Analytics is source-ready but inactive until the Cloudflare KV binding `ANALYTICS_EVENTS` exists. The browser analytics client emits only allowlisted event/property values, and the server stores aggregate daily counters rather than prompt text, intake answers, raw session IDs, or PII.
- Frontend CI now runs the pinned project binary `./node_modules/.bin/wrangler pages functions build` after `npm run build` so Pages Functions syntax errors fail before deployment without resolving Wrangler dynamically.
- Browser TTS playback streams `ReadableStream` chunks through MediaSource/Web Audio when supported, with the existing `arrayBuffer()` decode path kept as a fallback for unsupported browsers.
- Public deployment metadata is available at `/build-manifest.json`. It intentionally includes only non-secret build data: git SHA, branch, build timestamp, backend URL, hashed asset paths, sizes, and SHA-256 hashes.
- Frontend CI action pins and app runtime are now Node 24-native by commit `f2c969b`; hosted CI logs confirm Node `v24.18.0`. Wrangler is pinned as exact devDependency `4.112.0` by commit `76b97ba`, and CI plus `deploy.sh` use `./node_modules/.bin/wrangler`.
- Use `EXPECTED_MANIFEST_COMMIT="$(git rev-parse --short HEAD)" npm run qa:live` after Cloudflare deploys a frontend `main` push. The command is safe by default: it does not send handoff email or generate voice audio while production voice remains disabled.
- Backend deploys now have a matching safe smoke: `.venv/bin/python scripts/live_backend_smoke.py` from the backend repo. It uses `X-Stratum-Eval: true` for the escalation contract check so no live notification is sent.

## Completed Feature 1

- Enhancement spec Feature 1 citation UI delta is deployed: frontend `citations` SSE parsing, accessible expandable citation panels, representative mock citations, and `tests/rag.spec.ts`.
- Production Cloudflare deployment for frontend commit `ec95e8b` succeeded, and live citation UI smoke passed against the Railway backend.

## Completed Feature 2

- Enhancement spec Feature 2 is deployed: frontend `done.escalation` parsing, user-visible success/failure system confirmations, mock success/failure coverage, and `tests/escalation.spec.ts`.
- Frontend commits `5955dff` and `371f634` are deployed on Cloudflare Pages production. `371f634` adds a production-host backend fallback for `edstratumlabs.ai` / `www.edstratumlabs.ai` while localhost and branch previews remain mock-mode by default.
- Live rendered QA on 2026-07-20 verified the production site made one real non-escalation backend request for a RAG chat, displayed citations, and rendered escalation success/failure confirmations through intercepted SSE only, so no live handoff email was sent.

## Completed Feature 3

- Enhancement spec Feature 3 is deployed: Cloudflare Pages Functions for `/api/health`, `/api/config`, `/api/escalate`, `/api/tts`, and best-effort API rate limiting when KV bindings are available.
- Frontend commit `2f95db5` is deployed on Cloudflare Pages production.
- Local, preview, and production QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npx wrangler pages functions build`, `npm test -- --reporter=list` (`54 passed`), `wrangler pages dev dist --port 8788` smoke for `/api/config` and `/api/health`, Cloudflare preview Functions smoke, and production Functions smoke.
- Wrangler is not authenticated in this shell, so KV namespace creation and dashboard binding remain pending: `STRATUM_CONFIG` and `RATE_LIMIT`.
- Until KV is bound, `/api/config` returns safe default runtime flags and `_middleware.ts` skips rate limiting.
- Frontend commit `e1ff6d6` adds same-origin `/api/escalate` and `/api/tts` proxy Functions. Production QA passed on 2026-07-20 with QA-suppressed `/api/escalate` and validation-only `/api/tts` probes.

## Completed Feature 4

- Enhancement spec Feature 4 is deployed: frontend sentiment detection, frustration handoff CTA, urgency auto-handoff, 10-minute cooldown after escalation events, mock sentiment test mode, and `tests/sentiment.spec.ts`.
- Frontend commit `3372b43` is deployed on Cloudflare Pages production with chat asset `/assets/StratumChat-9GA-qGlc.js`.
- Local QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npm test -- tests/sentiment.spec.ts --reporter=list` (`10 passed`), and `npm test -- --reporter=list` (`64 passed`).
- Hosted branch and main CI passed on 2026-07-20 with `64 passed`; production rendered smoke confirmed urgency auto-handoff UI and captured the safe sentiment payload via intercepted SSE only, so no live handoff email was sent.

## Completed Feature 5

- Enhancement spec Feature 5 is deployed in source and production-gated off: D1 schema, typed `/api/sessions` Pages Function, scoped per-session auth tokens signed by edge-only `SESSION_SECRET`, local session helper, refresh hydration, best-effort message/flag sync, and `tests/persistence.spec.ts`.
- Frontend commit `87c4d5d` is deployed on Cloudflare Pages production with chat asset `/assets/StratumChat-CKo-w4OW.js`.
- Local QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npx wrangler pages functions build`, `npm test -- tests/cf-functions.spec.ts --reporter=list` (`22 passed`), `npm test -- tests/persistence.spec.ts --reporter=list` (`10 passed`), and `npm test -- --reporter=list` (`84 passed`).
- Hosted branch and main CI passed on 2026-07-20 with `84 passed`; production smoke verified `/api/config` returns `persistenceEnabled: false`, `/api/sessions` returns `503 d1_not_configured`, and chat renders without session endpoint calls while persistence remains disabled.

## Completed Feature 6

- Enhancement spec Feature 6 is deployed in source and production-gated off: Web Speech API controller, mic UI with live/final transcript handling, TTS toggle with localStorage persistence, markdown-stripped assistant playback payloads, reduced-motion guardrails, and `tests/voice.spec.ts`.
- Frontend commit `e079033` is deployed on Cloudflare Pages production with chat asset `/assets/StratumChat-CzklqdIB.js`.
- Local QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused voice browser tests (`14 passed`), and full frontend suite (`98 passed`).
- Hosted branch and main CI passed on 2026-07-20 with `98 passed`; production smoke verified `/api/config` returns `voiceEnabled: false`, the live chat chunk contains the voice/TTS code, and rendered production chat shows zero voice playback or mic controls while disabled.
- Follow-up frontend commit `3904989` streams successful `/api/tts` responses through MediaSource when supported and retains buffered `arrayBuffer()` playback as a fallback. Local QA passed with `npm run type-check`, `npm run lint`, `npm run build`, `npx wrangler pages functions build`, focused voice browser tests (`16 passed`), and full Playwright (`122 passed`); hosted main CI `29731627328` passed with `122 passed`, and Cloudflare Pages deployed `/assets/StratumChat-Dc9NE68U.js`.

## Completed Feature 7

- Enhancement spec Feature 7 is deployed in source and production: client-side `@react-pdf/renderer` session summary generation, `ChatPhase` completion/escalation gating, `Download Summary` UI with aria-label `Download session summary as PDF`, lazy PDF renderer chunking, and `tests/pdf-snapshot.spec.ts`.
- Frontend commit `395d0b8` initially deployed the feature; current production code-bearing commit `3904989` serves chat asset `/assets/StratumChat-Dc9NE68U.js` and PDF chunks `/assets/stratumPDF-Bgc_chGe.js` plus `/assets/pdf-vendor-B7fMFYQc.js`.
- Local QA passed on 2026-07-20: `npm run lint`, `npm run build`, `npx wrangler pages functions build`, no client `fs`/`path`/`crypto` imports, focused PDF browser tests (`12 passed`), and full frontend suite (`110 passed`).
- Hosted branch and main CI passed on 2026-07-20 with `110 passed`; production rendered smoke intercepted `/api/chat`, verified the download button after an escalation state, generated `edstratum-intake-...pdf`, and produced no console errors or live notification traffic.

## Current SOT Blockers

- GitHub branch protection for frontend `main` is not configured to require `CI / build-and-test`; branch protection check returned unprotected with no required status checks. A GitHub API attempt on 2026-07-20 returned HTTP 403 requiring GitHub Pro or a public repository before branch protection can be enabled.
- GitHub Actions currently has an account billing/spending-limit blocker. Frontend run `29743225634` for commit `bb8f3b4` and backend run `29743747239` for commit `5793eee` failed before starting any workflow steps. Hosted CI proof for later pushes is pending until billing/settings are corrected and the workflows are rerun.
- Cloudflare KV rate limiting is not active in production. Live rapid `/api/config` probes did not return HTTP 429, and `_middleware.ts` skips enforcement until `RATE_LIMIT` is bound.
- Cloudflare analytics aggregation is not active in production. Live `/api/analytics` returns `503 analytics_not_configured` until `ANALYTICS_EVENTS` is bound.
- D1 persistence is not active in production. `/api/config` returns `persistenceEnabled: false`, and `/api/sessions/.../messages` returns `503` with `d1_not_configured`.
- Voice/TTS is not active in production. `/api/config` returns `voiceEnabled: false`, `/api/health` reports `tts.status: "unconfigured"`, and live same-origin `/api/tts` fails closed with `503 tts_disabled` while runtime voice is disabled.
- Wrangler is unauthenticated in this shell, and no Cloudflare deploy/control-plane token is present, so KV/D1 bindings and Pages env vars cannot be created or verified from here.

## Recommended Next Steps

1. Add/verify Cloudflare preview env var `VITE_STRATUM_API_URL` if preview branches should exercise the live backend instead of mock chat.
2. Keep the lightweight Playwright test suite covering:
   - page loads without console errors
   - chatbot opens on desktop and mobile
   - prompt chips submit without forbidden copy
   - escalation copy remains discretion-safe
3. Keep production `VITE_STRATUM_API_URL` configured in Cloudflare Pages even though the source fallback now protects the live hostname.
4. Create and bind Feature 3 KV namespaces in Cloudflare Pages once Wrangler or dashboard credentials are available.
5. Create D1 database `stratum-conversations`, run `schema.sql`, bind it as `STRATUM_DB`, add `SESSION_SECRET`, choose an operational purge cadence using `/api/sessions/purge`, then set KV runtime `persistenceEnabled: true` only after a live smoke plan is ready.
6. Configure voice/TTS only after a safe rollout plan: set Railway `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, Cloudflare Pages `VITE_TTS_ENABLED=true`, then KV runtime `voiceEnabled: true`.
7. Resolve the GitHub Actions account billing/spending-limit blocker, then rerun `CI / build-and-test` for `bb8f3b4` or the latest frontend commit.
8. Add a GitHub branch protection rule for `main` requiring `CI / build-and-test`.
9. Create a staging Pages project or preview environment with a backend CORS origin dedicated to agent QA if branch previews should not use production backend.
10. Once a scheduling link is provisioned, add scheduling only through an explicit reviewed config flag rather than hardcoded frontend copy.
11. Bind Cloudflare KV namespace `ANALYTICS_EVENTS` to activate the source-ready aggregate chatbot analytics counters, then verify `/api/analytics` returns `202` for an allowlisted test event.
12. Keep `EXPECTED_MANIFEST_COMMIT=<short-sha> npm run qa:live` as the first source-controlled deploy verification check before deeper rendered QA on future frontend pushes.

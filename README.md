# EdStratum Labs — V2 Frontend

React 19 + Vite 6 + Tailwind CSS v4 SPA deployed to Cloudflare Pages at [edstratumlabs.ai](https://edstratumlabs.ai).

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (strict mode) |
| Build tool | Vite 6 (`es2022` target) |
| Styling | Tailwind CSS v4 (`@theme` directive, no config file) |
| Animation | `motion/react` v12 — `LazyMotion` + `m.*` strict mode |
| SEO | `react-helmet-async` + static JSON-LD in `index.html` |
| Deployment | Cloudflare Pages via GitHub-connected `main` branch |
| Edge API | Cloudflare Pages Functions under `functions/` |

## Local Development

```bash
npm install
npm run dev
```

Leaving `VITE_STRATUM_API_URL` unset runs the STRATUM chat against its local demo stream on localhost and Cloudflare preview branches, which is safest for UI work because it cannot send escalation emails. On `edstratumlabs.ai` and `www.edstratumlabs.ai`, the source includes a production-host fallback to the public Railway backend so the live site keeps real STRATUM responses even if Cloudflare Pages builds without the env var.

## Production Build

```bash
VITE_STRATUM_API_URL=https://stratum-backend-production-a340.up.railway.app npm run build
# Output: dist/
```

## Live QA

```bash
npm run qa:live
EXPECTED_MANIFEST_COMMIT="$(git rev-parse --short HEAD)" npm run qa:live
EXPECTED_MANIFEST_COMMIT="$(git rev-parse --short HEAD)" npm run qa:live:rendered
npm run qa:activation
npm run qa:activation -- --profile persistence --plan
npm run qa:activation -- --profile voice --runtime-config-json
npm run qa:activation -- --profile full-activation
npm run qa:activation -- --profile full-activation --plan
```

The live smoke checks production without sending handoff email or generating
voice audio. It verifies `/build-manifest.json`, safe runtime flags,
same-origin `/api/health`, disabled `/api/tts` fail-closed behavior,
privacy-safe `/api/analytics` fail-closed behavior while KV is unbound, direct
Railway `/api/health` and `/api/runtime`, and forbidden-copy scans on the root
HTML plus current STRATUM chat asset.

The rendered live smoke uses Playwright against the production URL. It verifies
the page shell, console/page/request health, desktop STRATUM chat open and a
non-escalation live RAG response with expandable citations, hidden voice
controls while disabled, and mobile dialog bounds. Screenshots are written under
`/tmp` by default, or to `LIVE_RENDER_SCREENSHOT_DIR` when set. Override
`FRONTEND_URL`, `BACKEND_URL`, `LIVE_RENDER_PROMPT`, and `EXPECTED_*` env vars
only when intentionally testing a staged rollout state.

The activation readiness audit is safe for production by default. It checks the
source-controlled Cloudflare binding names, public `/api/config`, a zero-event
analytics probe, an auth-gated D1 sessions probe, fail-closed or validation-only
TTS behavior, and backend runtime providers. Use `--profile current`,
`analytics`, `managed-rag`, `persistence`, `voice`, or `full-activation` to make
the intended rollout state explicit. Use `--plan` to print the non-secret
Cloudflare/Railway activation checklist for that profile, or
`--runtime-config-json` to print only the JSON intended for the `STRATUM_CONFIG`
key named `runtime`. Add `--probe-analytics-write` only after binding
`ANALYTICS_EVENTS`, because it writes one synthetic allowlisted analytics event.
Add `--probe-persistence-write` only after binding `STRATUM_DB`, setting
`SESSION_SECRET`, and intentionally enabling runtime persistence, because it
creates, writes, reads, and deletes one synthetic D1 session. Add
`--probe-rate-limit` only after binding `RATE_LIMIT`, because it intentionally
sends a bounded burst to prove HTTP 429.

## Deployment

Cloudflare Pages is connected to this GitHub repo. The normal production path is:

```bash
git push origin main
```

Pushes to feature branches create Cloudflare preview deployments. Before merging
or pushing production behavior, require/verify GitHub status `CI / build-and-test`.

`deploy.sh` is retained only as an explicit emergency direct-upload fallback and
does not deploy production unless confirmation environment variables are set.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `VITE_STRATUM_API_URL` | Public STRATUM backend origin, without trailing slash |
| `VITE_STRATUM_QA` | Preview/staging only. When `true`, real-backend chat requests include `X-Stratum-QA: true` to suppress outbound notifications. Never enable in production. |
| `VITE_ANALYTICS_ENDPOINT` | Optional privacy-safe analytics endpoint override. Defaults to same-origin `/api/analytics`; set to an empty string to disable browser beacons. |
| `VITE_TTS_ENABLED` | Voice rollout only. Keep unset/false until Railway TTS credentials and Cloudflare runtime `voiceEnabled` are both intentionally enabled. |

## Architecture notes

- **Lazy loading**: All below-fold sections are `React.lazy` + `Suspense` — only `Navbar` and `Hero` are in the critical path.
- **Motion constraint**: `LazyMotion strict` is set at the app root. Only `m.*` components (from `motion/react-m`) are permitted inside the tree. Bare `motion.div` etc. will throw at runtime.
- **Design tokens**: All color, typography, and spacing tokens are defined in `src/index.css` under `@theme {}`. No `tailwind.config.js` exists.
- **STRATUM chat**: The floating intake advisor lives in `src/stratum/`. It uses `VITE_STRATUM_API_URL` to stream `/api/chat` SSE events from Railway. If the URL is omitted outside the production hostnames, it falls back to the local demo stream and does not send escalation emails.
- **Pages Functions**: `/api/health` proxies Railway `/api/health`, `/api/config` returns non-secret runtime flags, and `_middleware.ts` applies best-effort KV rate limiting when the `RATE_LIMIT` binding exists.
- **Analytics readiness**: STRATUM emits privacy-safe funnel events for chat open, first message, readiness completion, backend errors, and handoff intent. `/api/analytics` stores aggregate daily counters only when the `ANALYTICS_EVENTS` KV binding exists; it does not store prompt text, answers, raw session IDs, or PII.
- **Persistence readiness**: `/api/sessions` stores D1 conversation state only when `STRATUM_DB`, `SESSION_SECRET`, and runtime `persistenceEnabled` are configured. The reset control calls scoped session deletion, and admin-only `/api/sessions/purge` can remove sessions older than a bounded retention window.
- **Voice readiness**: Browser voice controls require runtime `voiceEnabled`, build-time `VITE_TTS_ENABLED`, and same-origin microphone permission. The same-origin `/api/tts` Function also fails closed unless runtime `voiceEnabled` is true.
- **Escalation discretion**: Client-facing copy should refer to the `Founding leadership team` until the backend confirms that a notification has been sent. Do not add personal names or scheduling links in the frontend unless they are explicitly provisioned and approved.
- **Deployment note**: This repo is the frontend source of truth. Cloudflare Pages production deploys from GitHub `main`; do not patch generated Cloudflare artifacts or use direct uploads for normal releases.

## Project structure

```
src/
  App.tsx                  # Root — LazyMotion, MotionConfig, SEO head
  main.tsx                 # React 19 entry, HelmetProvider
  index.css                # Tailwind v4 @import + @theme tokens + @utility
  vite-env.d.ts
  components/
    Navbar.tsx             # Fixed nav with AnimatePresence mobile menu
  lib/
    motionVariants.ts      # Shared Motion variant definitions
  stratum/
    StratumChat.tsx        # Floating STRATUM intake advisor
    stratumApi.ts          # Fetch + SSE adapter for Railway /api/chat
    stratumConfig.ts       # Prompt chips, intake questions, public runtime config
    stratumMock.ts         # Local fallback stream when no backend URL is provided
    stratumTypes.ts        # Frontend mirror of the backend chat/SSE contract
  sections/
    Hero.tsx
    Services.tsx
    About.tsx
    FAQ.tsx
    Contact.tsx
    Footer.tsx
public/
  logo.png                 # Canonical brand logo (1157x272 transparent PNG)
  og-image.png             # Social preview image (1200x630)
  robots.txt
  sitemap.xml
  _headers                 # Cloudflare Pages security headers
  404.html                 # Real 404 so missing hashed assets do not fall through to index.html
functions/
  api/                      # Cloudflare Pages Functions API routes
  _middleware.ts            # API middleware and optional KV rate limiting
```

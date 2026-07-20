<div align="center">

# EdStratum Labs — V2 Frontend

### AI Strategy Intake & Discovery Advisor — production SPA on Cloudflare Pages

[![Live Site](https://img.shields.io/badge/live-edstratumlabs.ai-7c3aed?style=flat-square&logo=cloudflare&logoColor=white)](https://edstratumlabs.ai)
[![CI](https://img.shields.io/github/actions/workflow/status/theonlygeranium/edstratum-v2-frontend/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/theonlygeranium/edstratum-v2-frontend/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license)

**React 19** · **Vite 6** · **TypeScript** · **Tailwind CSS v4** · **Framer Motion** · **Cloudflare Pages** · **Playwright**

</div>

---

## Overview

EdStratum Labs is an AI consultancy that helps educational institutions assess their readiness for AI adoption. This repository contains the production frontend — a React 19 single-page application deployed to Cloudflare Pages at **[edstratumlabs.ai](https://edstratumlabs.ai)**.

The centerpiece is **StratumChat**, a floating AI intake advisor that guides visitors through a structured discovery conversation. It streams grounded responses from a FastAPI/LangGraph backend, surfaces real source citations, detects sentiment escalation triggers, and can optionally persist conversations to Cloudflare D1 and synthesize voice via ElevenLabs TTS — all behind runtime feature flags that gate safely off by default.

> **Architecture principle:** All frontend code runs in the browser. There is no Node.js server runtime. The app uses Web APIs exclusively (`fetch`, Web Crypto, Web Speech, MediaSource) and `import.meta.env.VITE_*` for configuration. Server-side logic lives in Cloudflare Pages Functions (Workers runtime) and the Railway backend.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|--------|
| Framework | React | 19 (strict mode) |
| Build tool | Vite | 6 (`es2022` target) |
| Language | TypeScript | strict |
| Styling | Tailwind CSS | v4 (`@theme` directive, no config file) |
| Animation | Framer Motion | 12 (`LazyMotion` + `m.*` strict mode) |
| SEO | react-helmet-async + JSON-LD | — |
| Hosting | Cloudflare Pages | edge CDN, auto-deploy from `main` |
| Edge API | Cloudflare Pages Functions | Workers runtime (V8 isolate) |
| Testing | Playwright | 170 tests (desktop + mobile) |
| CI | GitHub Actions | Node 24, pinned Wrangler 4.112.0 |

---

## Features

- **StratumChat AI advisor** — SSE-streamed intake conversation with real-time typing, prompt chips, and a seven-question discovery flow
- **RAG citations** — expandable source-citation panels rendered inline from backend `citations` SSE events
- **Escalation handoff** — discretion-safe leadership-team handoff UI with success/failure confirmation (email suppressed during QA)
- **Sentiment escalation** — client-side frustration/urgency signal detection that auto-triggers escalation with a 10-minute cooldown
- **D1 persistence** — opt-in conversation history saved to Cloudflare D1, keyed by session ID (gated off until control-plane activation)
- **Voice input + TTS** — Web Speech API microphone input and ElevenLabs text-to-speech playback via MediaSource streaming (gated off until activation)
- **PDF snapshot** — client-side `@react-pdf/renderer` session summary download, lazy-loaded, no server round-trip
- **Privacy-safe analytics** — allowlisted aggregate funnel counters stored in Cloudflare KV (gated off until KV binding)
- **Same-origin API proxy** — all backend calls route through Cloudflare Pages Functions (`/api/chat`, `/api/config`, `/api/health`, etc.), keeping the Railway origin out of browser requests

---

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173 (mock chat, no backend needed)
```

Leaving `VITE_STRATUM_API_URL` unset runs StratumChat against its local demo stream — safest for UI work because it cannot send escalation emails.

### Production Build

```bash
VITE_STRATUM_API_URL=https://stratum-backend-production-a340.up.railway.app npm run build
# Output: dist/
```

---

## Project Structure

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
    Hero.tsx  Services.tsx  About.tsx  FAQ.tsx  Contact.tsx  Footer.tsx
public/
  logo.png  og-image.png  robots.txt  sitemap.xml  _headers  404.html
functions/
  api/                     # Cloudflare Pages Functions API routes
  _middleware.ts           # API middleware and optional KV rate limiting
```

---

## Live QA

```bash
# Endpoint smoke (safe — no email, no audio)
EXPECTED_MANIFEST_COMMIT="$(git rev-parse --short HEAD)" npm run qa:live

# Rendered production smoke (Playwright)
EXPECTED_MANIFEST_COMMIT="$(git rev-parse --short HEAD)" npm run qa:live:rendered

# Activation readiness audit
npm run qa:activation -- --profile edge-voice --plan
npm run qa:activation -- --profile full-activation --runtime-config-json
```

The live smoke verifies `/build-manifest.json`, safe runtime flags, same-origin `/api/health`, disabled `/api/tts` fail-closed behavior, privacy-safe `/api/analytics`, direct Railway health/runtime, and forbidden-copy scans. The rendered smoke uses Playwright against the production URL — it checks page identity, console health, desktop StratumChat open, a real non-escalation RAG response with citations, hidden voice controls while disabled, and mobile dialog bounds.

---

## Deployment

Cloudflare Pages is connected to this GitHub repo. The normal production path is:

```bash
git push origin main    # auto-deploys to edstratumlabs.ai
```

Pushes to feature branches create Cloudflare preview deployments at `<branch>.edstratumlabs.pages.dev`. Before merging, verify GitHub status `CI / build-and-test`.

`deploy.sh` is retained only as an explicit emergency direct-upload fallback and does not deploy production unless confirmation environment variables are set.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_STRATUM_API_URL` | Public STRATUM backend origin, without trailing slash |
| `VITE_STRATUM_QA` | Preview/staging only. When `true`, real-backend chat requests include `X-Stratum-QA: true` to suppress outbound notifications. Never enable in production. |
| `VITE_ANALYTICS_ENDPOINT` | Optional privacy-safe analytics endpoint override. Defaults to same-origin `/api/analytics`; set to empty string to disable. |
| `VITE_TTS_ENABLED` | Voice rollout only. Keep unset/false until Railway TTS credentials and Cloudflare runtime `voiceEnabled` are both intentionally enabled. |

---

## Architecture Notes

- **Lazy loading**: All below-fold sections are `React.lazy` + `Suspense` — only `Navbar` and `Hero` are in the critical path
- **Motion constraint**: `LazyMotion strict` is set at the app root. Only `m.*` components (from `motion/react-m`) are permitted inside the tree
- **Design tokens**: All color, typography, and spacing tokens are defined in `src/index.css` under `@theme {}`. No `tailwind.config.js` exists
- **Escalation discretion**: Client-facing copy refers to the `Founding leadership team` until the backend confirms a notification has been sent. No personal names or scheduling links in frontend copy unless explicitly provisioned and approved
- **Production chat routing**: Uses same-origin `https://edstratumlabs.ai/api/chat` on `edstratumlabs.ai` and `www.edstratumlabs.ai`; the Pages Function proxies to Railway using `RAILWAY_API_URL`

---

## Related Repository

| Repository | Description |
|-----------|-------------|
| [stratum-backend](https://github.com/theonlygeranium/stratum-backend) | FastAPI + LangGraph backend — RAG retrieval, SSE streaming, escalation, TTS proxy |

---

## License

MIT

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
| Deployment | Cloudflare Pages (direct upload via Wrangler) |

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

## Deployment

Copy `deploy.sh.example` to `deploy.sh`, fill in your Cloudflare credentials, then:

```bash
chmod +x deploy.sh
./deploy.sh
```

### Required environment variables

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_KEY` | Cloudflare Global API Key |
| `CLOUDFLARE_EMAIL` | Cloudflare account email |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (`f69a...`) |
| `VITE_STRATUM_API_URL` | Public STRATUM backend origin, without trailing slash |

## Architecture notes

- **Lazy loading**: All below-fold sections are `React.lazy` + `Suspense` — only `Navbar` and `Hero` are in the critical path.
- **Motion constraint**: `LazyMotion strict` is set at the app root. Only `m.*` components (from `motion/react-m`) are permitted inside the tree. Bare `motion.div` etc. will throw at runtime.
- **Design tokens**: All color, typography, and spacing tokens are defined in `src/index.css` under `@theme {}`. No `tailwind.config.js` exists.
- **STRATUM chat**: The floating intake advisor lives in `src/stratum/`. It uses `VITE_STRATUM_API_URL` to stream `/api/chat` SSE events from Railway. If the URL is omitted outside the production hostnames, it falls back to the local demo stream and does not send escalation emails.
- **Escalation discretion**: Client-facing copy should refer to the `Founding leadership team` until the backend confirms that a notification has been sent. Do not add personal names or scheduling links in the frontend unless they are explicitly provisioned and approved.
- **Deployment note**: This repo is now the frontend source of truth. The previous Cloudflare Pages deployment was a direct-upload artifact-only deploy (no Git integration). Connect this repo to Cloudflare Pages via the dashboard or continue using `deploy.sh` for direct uploads.

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
  _redirects               # SPA fallback: /* -> /index.html 200
```

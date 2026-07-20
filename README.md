# EdStratum Labs — V2 Frontend

React 19 + Vite 8 + Tailwind CSS v4 SPA deployed to Cloudflare Pages at [edstratumlabs.ai](https://edstratumlabs.ai).

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (strict mode) |
| Build tool | Vite 8 (`es2022` target) |
| Styling | Tailwind CSS v4 (`@theme` directive, no config file) |
| Animation | `motion/react` v12 — `LazyMotion` + `m.*` strict mode |
| SEO | `react-helmet-async` + static JSON-LD in `index.html` |
| Deployment | Cloudflare Pages (direct upload via Wrangler) |

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
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

## Architecture notes

- **Lazy loading**: All below-fold sections are `React.lazy` + `Suspense` — only `Navbar` and `Hero` are in the critical path.
- **Motion constraint**: `LazyMotion strict` is set at the app root. Only `m.*` components (from `motion/react-m`) are permitted inside the tree. Bare `motion.div` etc. will throw at runtime.
- **Design tokens**: All color, typography, and spacing tokens are defined in `src/index.css` under `@theme {}`. No `tailwind.config.js` exists.
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

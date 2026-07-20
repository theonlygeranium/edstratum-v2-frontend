#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy.sh — EdStratum Labs V2 emergency direct upload
#
# Normal production deploys come from GitHub-connected Cloudflare Pages:
#   git push origin main
#
# This script is an emergency fallback only. It refuses to run unless
# CONFIRM_DIRECT_CLOUDFLARE_DEPLOY=yes is set, and it deploys to the
# non-production "manual" branch unless CLOUDFLARE_PAGES_BRANCH is overridden.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

if [[ "${CONFIRM_DIRECT_CLOUDFLARE_DEPLOY:-}" != "yes" ]]; then
  echo "Direct Cloudflare deploys bypass GitHub CI and are disabled by default." >&2
  echo "Use: git push origin main" >&2
  echo "For an emergency direct upload, set CONFIRM_DIRECT_CLOUDFLARE_DEPLOY=yes." >&2
  exit 2
fi

branch="${CLOUDFLARE_PAGES_BRANCH:-manual}"
if [[ "${branch}" == "main" && "${CONFIRM_PRODUCTION_DIRECT_DEPLOY:-}" != "yes" ]]; then
  echo "Direct production upload to branch main requires CONFIRM_PRODUCTION_DIRECT_DEPLOY=yes." >&2
  exit 2
fi

echo "=== EdStratum Labs V2 — Emergency Direct Upload ==="
echo ""

echo "▶  Type-checking..."
npm run type-check

echo ""
echo "▶  Linting..."
npm run lint

echo "▶  Building..."
npm run build

echo ""
echo "▶  Building Cloudflare Pages Functions..."
npx wrangler pages functions build

echo ""
echo "▶  Deploying to Cloudflare Pages branch ${branch}..."
npx wrangler pages deploy dist \
  --project-name edstratumlabs \
  --branch "${branch}" \
  --commit-message "Emergency direct upload: $(date -u '+%Y-%m-%d %H:%M UTC')"

echo ""
echo "✅  Deploy complete."
if [[ "${branch}" == "main" ]]; then
  echo "    Production: https://edstratumlabs.ai"
else
  echo "    Branch:     ${branch}"
  echo "    Preview:    https://edstratumlabs.pages.dev"
fi

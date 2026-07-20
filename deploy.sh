#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy.sh — EdStratum Labs V2 one-command deploy
# Uses Cloudflare Global API Key authentication
#
# Usage:
#   export CLOUDFLARE_API_KEY="your-global-api-key"
#   export CLOUDFLARE_EMAIL="your@email.com"
#   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
#   ./deploy.sh
#
# Or copy this file to deploy.local.sh (gitignored), hard-code
# your credentials there, and run that file instead.
# ──────────────────────────────────────────────────────────────
set -e

: "${CLOUDFLARE_API_KEY:?CLOUDFLARE_API_KEY is required}"
: "${CLOUDFLARE_EMAIL:?CLOUDFLARE_EMAIL is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

export CLOUDFLARE_API_KEY
export CLOUDFLARE_EMAIL
export CLOUDFLARE_ACCOUNT_ID

echo "=== EdStratum Labs V2 — Build & Deploy ==="
echo ""

echo "▶  Building..."
npm run build

echo ""
echo "▶  Deploying to Cloudflare Pages (production)..."
npx wrangler pages deploy dist \
  --project-name edstratumlabs \
  --branch main \
  --commit-message "Release: $(date -u '+%Y-%m-%d %H:%M UTC')"

echo ""
echo "✅  Deploy complete."
echo "    Live:    https://edstratumlabs.ai"
echo "    Preview: https://edstratumlabs.pages.dev"

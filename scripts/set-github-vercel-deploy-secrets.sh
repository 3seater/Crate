#!/usr/bin/env bash
# Set GitHub Actions secrets for Deploy (Vercel CLI). Requires: gh auth login, VERCEL_TOKEN in env.
# Usage:
#   VERCEL_TOKEN='your-token' ./scripts/set-github-vercel-deploy-secrets.sh
#   VERCEL_TOKEN='your-token' ./scripts/set-github-vercel-deploy-secrets.sh --repo kzndotsh/doji
set -euo pipefail

REPO="${1:-kzndotsh/doji}"
if [[ "${1:-}" == "--repo" ]]; then
  REPO="${2:?--repo requires owner/name}"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: install GitHub CLI (gh) and run: gh auth login" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: run: gh auth login" >&2
  exit 1
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "error: set VERCEL_TOKEN in the environment (do not commit it)" >&2
  exit 1
fi

# Project IDs are in .github/workflows/deploy.yml (not secret). Org id is workflow env.
VERCEL_ORG_ID="team_uFjyxuuasdE7p77Rg5jl6uYh"

gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN" --repo "$REPO"
# Optional override if you change teams; deploy.yml defaults to dojibet team id above.
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID" --repo "$REPO"

echo "Set VERCEL_TOKEN (and optional VERCEL_ORG_ID) on $REPO"

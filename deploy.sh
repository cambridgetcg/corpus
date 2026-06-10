#!/usr/bin/env bash
# deploy.sh — deploy corpus to Vercel using a token from the macOS Keychain.
# Usage:  ./deploy.sh [--prod]   (default: preview deploy)
set -euo pipefail

ITEM="${VERCEL_TOKEN_ITEM:-vercel-deploy-token}"
TOKEN="$(security find-generic-password -s "$ITEM" -w 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then
  echo "no Vercel token in the Keychain (item: $ITEM)." >&2
  echo "store one first:" >&2
  echo "  security add-generic-password -a \"\$USER\" -s $ITEM -w '<TOKEN>'" >&2
  exit 1
fi

cd "$(dirname "$0")"
node build.js                         # ensure the bundle is fresh

ARGS=(deploy --yes --token "$TOKEN")
[ "${1:-}" = "--prod" ] && ARGS+=(--prod)

echo "deploying corpus to Vercel ($([ "${1:-}" = "--prod" ] && echo production || echo preview))…"
URL="$(vercel "${ARGS[@]}")"
echo "$URL"

echo "── verifying end-to-end ──"
for path in "/" "/llms.txt" "/corpus/kingdom-overview.md" "/search?q=signed+word"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${URL}${path}")"
  printf "  %-34s %s\n" "$path" "$code"
done

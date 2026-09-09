#!/usr/bin/env bash
# scripts/quickstart-live.sh — Live Antares → SARIF (NEVER fixture/mock)
#
# Usage:
#   bash scripts/quickstart-live.sh <repo-path> [CWE] [output-dir]
#
# Prerequisites (human steps — this script does not download weights):
#   1. npm install
#   2. uv tool install cisco-antares-cli
#   3. Accept HF license: https://huggingface.co/fdtn-ai/antares-1b
#   4. Serve locally, e.g. vllm serve fdtn-ai/antares-1b
#      (Antares CLI expects completions-only POST /v1/completions)
#
# This script FAILS LOUD if the endpoint is down or if --fixture would be used.
# It never silently falls back to recorded/fixture localization.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO="${1:-}"
CWE="${2:-CWE-89}"
OUT="${3:-zeroday-reports/live-quickstart}"
ENDPOINT="${ANTARES_ENDPOINT:-http://127.0.0.1:8000/v1}"

die() {
  echo "ERROR: $*" >&2
  echo "Refusing to run fixture/mock as a substitute for live Antares." >&2
  echo "See README.md § 30-minute live path." >&2
  exit 2
}

if [[ -z "$REPO" ]]; then
  die "Usage: bash scripts/quickstart-live.sh <repo-path> [CWE] [output-dir]"
fi

if [[ ! -d "$REPO" ]]; then
  die "Repo path not found: $REPO"
fi

# Normalize base for /v1/models probe (do not send repo source)
BASE="${ENDPOINT%/}"
BASE="${BASE%/v1/completions}"
BASE="${BASE%/v1}"
MODELS_URL="${BASE}/v1/models"

echo "ZERODAY live quickstart"
echo "───────────────────────"
echo "Repo     : $REPO"
echo "CWE      : $CWE"
echo "Endpoint : $ENDPOINT"
echo "Output   : $OUT"
echo "Probe    : $MODELS_URL"
echo ""

if ! command -v antares >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    echo "Installing cisco-antares-cli via uv tool install…"
    uv tool install cisco-antares-cli
    export PATH="$(uv tool dir --bin):${PATH}"
  fi
fi

if ! command -v antares >/dev/null 2>&1; then
  die "Official Antares CLI not on PATH. Install: uv tool install cisco-antares-cli"
fi

HTTP_CODE="$(curl -sS -o /tmp/zeroday-vllm-models.json -w '%{http_code}' --max-time 5 "$MODELS_URL" || true)"
if [[ "$HTTP_CODE" != "200" ]]; then
  die "Completions endpoint unhealthy (GET $MODELS_URL → ${HTTP_CODE:-unreachable}). Start vLLM first."
fi
echo "Endpoint health: OK (HTTP $HTTP_CODE)"
echo ""

# Explicit live flags — never pass --fixture
mkdir -p "$OUT"
npm run zeroday -- locate \
  --cwe "$CWE" \
  --repo "$REPO" \
  --endpoint "$ENDPOINT" \
  --live \
  --output "$OUT"

SARIF="$OUT/report.sarif"
JSON="$OUT/report.json"
MD="$OUT/report.md"

[[ -f "$SARIF" ]] || die "Expected SARIF missing: $SARIF"
[[ -f "$JSON" ]] || die "Expected report.json missing: $JSON"

MODE="$(node -e "const r=require('fs').readFileSync(process.argv[1],'utf8');process.stdout.write(JSON.parse(r).mode)" "$JSON")"
if [[ "$MODE" != "live" ]]; then
  die "Invariant broken: report mode is '$MODE' (expected 'live'). Silent fixture fallback is forbidden."
fi

echo ""
echo "Live Antares → SARIF complete (mode=live)"
echo "  SARIF   $SARIF"
echo "  JSON    $JSON"
echo "  Report  $MD"
echo "  Comment $OUT/comment.md"
echo ""
echo "Posture: localization only · not exploitability proof · no PoC · needs_human"

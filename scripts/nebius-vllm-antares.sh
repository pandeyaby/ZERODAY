#!/usr/bin/env bash
# Nebius / CUDA vLLM scaffold for fdtn-ai/antares-1b (operator-run).
#
# ZERODAY never creates paid Nebius resources. This script only prints or
# starts vLLM on a machine YOU already provisioned. Do not run --serve from CI.
#
# Usage:
#   bash scripts/nebius-vllm-antares.sh --print-only
#   bash scripts/nebius-vllm-antares.sh --serve          # on a pre-provisioned GPU host
#   bash scripts/nebius-vllm-antares.sh --smoke-env      # check env vars (no network spend)
set -euo pipefail

MODEL="${ANTARES_MODEL:-fdtn-ai/antares-1b}"
HOST="${ZERODAY_VLLM_HOST:-0.0.0.0}"
PORT="${ZERODAY_VLLM_PORT:-8000}"

print_help() {
  cat <<'EOF'
Nebius / vLLM Antares scaffold (completions-only)

  --print-only   Print operator checklist (default; safe, no spend)
  --serve        Run `vllm serve` on THIS machine (you must have GPU + HF access)
  --smoke-env    Validate local env var names are set (no API calls)
  -h, --help     This help

Requires POST /v1/completions (not chat). Prefer self-managed vLLM on CUDA.
See docs/nebius-antares.md.
EOF
}

print_checklist() {
  cat <<EOF
=== ZERODAY Nebius / vLLM Antares checklist (operator) ===

1) Provision a Nebius CUDA VM or k8s GPU job YOURSELF (this script will not).
2) On that host, accept HF terms for ${MODEL}:
     https://huggingface.co/fdtn-ai/antares-1b
   then:  huggingface-cli login   # or HUGGING_FACE_HUB_TOKEN on the GPU host
3) Install vLLM 0.19.1+ (Antares CLI expectation) on the GPU host.
4) Serve completions:
     vllm serve ${MODEL} --host ${HOST} --port ${PORT}
   Expect:  http://<host>:${PORT}/v1/completions
5) On the operator laptop (authorized repo only):
     export ZERODAY_INFERENCE_PROVIDER=nebius
     export ZERODAY_ANTARES_BASE_URL=https://<host>:${PORT}/v1
     export ZERODAY_REMOTE_INFERENCE_ACK=1
     npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \\
       --endpoint \"\$ZERODAY_ANTARES_BASE_URL\" --remote-inference

Token Factory: use only if it exposes /v1/completions (not chat-only).
Mac MPS is unsupported for schema-faithful live locate — prefer this CUDA path.
CI must stay fixture-only (never call this --serve from GitHub Actions).
EOF
}

smoke_env() {
  echo "ZERODAY_INFERENCE_PROVIDER=${ZERODAY_INFERENCE_PROVIDER:-<unset>}"
  echo "ZERODAY_ANTARES_BASE_URL=${ZERODAY_ANTARES_BASE_URL:-<unset>}"
  echo "ZERODAY_ANTARES_API_KEY set? $([ -n "${ZERODAY_ANTARES_API_KEY:-}" ] && echo yes || echo no)"
  echo "ZERODAY_REMOTE_INFERENCE_ACK=${ZERODAY_REMOTE_INFERENCE_ACK:-<unset>}"
  echo "ANTARES_MODEL=${ANTARES_MODEL:-<default ${MODEL}>}"
  if [ "${ZERODAY_INFERENCE_PROVIDER:-}" = "nebius" ] && \
     [ "${ZERODAY_REMOTE_INFERENCE_ACK:-}" != "1" ] && \
     [ "${ZERODAY_REMOTE_INFERENCE_ACK:-}" != "true" ]; then
    echo "WARN: nebius provider without ZERODAY_REMOTE_INFERENCE_ACK — ZERODAY will refuse remote endpoints."
    exit 2
  fi
  echo "OK: env smoke (no network)."
}

do_serve() {
  if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "Refusing --serve under CI. Fixture path only."
    exit 2
  fi
  if ! command -v vllm >/dev/null 2>&1; then
    echo "vllm not on PATH. Install vLLM 0.19.1+ on the GPU host, then retry."
    exit 2
  fi
  echo "Starting: vllm serve ${MODEL} --host ${HOST} --port ${PORT}"
  echo "Completions: http://${HOST}:${PORT}/v1/completions"
  exec vllm serve "${MODEL}" --host "${HOST}" --port "${PORT}"
}

MODE="print-only"
case "${1:-}" in
  --serve) MODE="serve" ;;
  --smoke-env) MODE="smoke-env" ;;
  --print-only|"") MODE="print-only" ;;
  -h|--help) print_help; exit 0 ;;
  *) echo "Unknown arg: $1"; print_help; exit 2 ;;
esac

case "$MODE" in
  print-only) print_checklist ;;
  smoke-env) smoke_env ;;
  serve) do_serve ;;
esac

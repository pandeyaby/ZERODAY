#!/usr/bin/env bash
# RunPod / CUDA vLLM scaffold for fdtn-ai/antares-1b (operator-run).
#
# ZERODAY never creates or starts paid RunPod pods. This script only prints
# setup commands or starts vLLM on a machine YOU already provisioned.
#
# Usage:
#   bash scripts/runpod-vllm-antares.sh --print-only
#   bash scripts/runpod-vllm-antares.sh --smoke-env
#   bash scripts/runpod-vllm-antares.sh --serve   # only on a pre-provisioned GPU pod
set -euo pipefail

MODEL="${ANTARES_MODEL:-fdtn-ai/antares-1b}"
HOST="${ZERODAY_VLLM_HOST:-0.0.0.0}"
PORT="${ZERODAY_VLLM_PORT:-8000}"

print_help() {
  cat <<'EOF'
RunPod / vLLM Antares scaffold (completions-only)

  --print-only   Print RunPod operator checklist (default; safe, no spend)
  --smoke-env    Validate local env var names (no API / RunPod calls)
  --serve        Run `vllm serve` on THIS machine (you must already have a GPU pod)
  -h, --help     This help

Requires POST /v1/completions (not chat). See docs/runpod-antares.md.
ZERODAY never creates paid RunPod pods.
EOF
}

print_checklist() {
  cat <<EOF
=== ZERODAY RunPod / vLLM Antares checklist (operator) ===

1) In the RunPod console, create a CUDA GPU pod YOURSELF (this script will not).
   Guidance for ${MODEL}: single modern NVIDIA GPU with ≥16 GB VRAM is a
   reasonable starting point; raise VRAM if long-context tool traces OOM.
2) Expose port ${PORT} via RunPod TCP / HTTP proxy (your choice).
3) On that pod, accept HF terms for ${MODEL}:
     https://huggingface.co/fdtn-ai/antares-1b
   then:  export HUGGING_FACE_HUB_TOKEN=hf_...
          huggingface-cli login --token \"\$HUGGING_FACE_HUB_TOKEN\"
4) Install vLLM 0.19.1+ on the pod, then serve completions:
     vllm serve ${MODEL} --host ${HOST} --port ${PORT}
   Expect:  http://${HOST}:${PORT}/v1/completions
5) On the operator laptop (authorized repo only):
     export ZERODAY_INFERENCE_PROVIDER=remote
     export ZERODAY_ANTARES_BASE_URL=https://<runpod-proxy-host>/v1
     export ZERODAY_ANTARES_API_KEY=          # if your proxy requires it
     export ZERODAY_REMOTE_INFERENCE_ACK=1
     npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \\
       --endpoint \"\$ZERODAY_ANTARES_BASE_URL\" --remote-inference

Mac MPS is unsupported for schema-faithful live locate — prefer this CUDA path.
CI must stay fixture-only (never call this --serve from GitHub Actions).
Host-agnostic notes: docs/remote-antares-vllm.md
EOF
}

smoke_env() {
  echo "ZERODAY_INFERENCE_PROVIDER=${ZERODAY_INFERENCE_PROVIDER:-<unset>}"
  echo "ZERODAY_ANTARES_BASE_URL=${ZERODAY_ANTARES_BASE_URL:-<unset>}"
  echo "ZERODAY_ANTARES_API_KEY set? $([ -n "${ZERODAY_ANTARES_API_KEY:-}" ] && echo yes || echo no)"
  echo "ZERODAY_REMOTE_INFERENCE_ACK=${ZERODAY_REMOTE_INFERENCE_ACK:-<unset>}"
  echo "ANTARES_MODEL=${ANTARES_MODEL:-<default ${MODEL}>}"
  case "${ZERODAY_INFERENCE_PROVIDER:-}" in
    remote|runpod|nebius)
      if [ "${ZERODAY_REMOTE_INFERENCE_ACK:-}" != "1" ] && \
         [ "${ZERODAY_REMOTE_INFERENCE_ACK:-}" != "true" ]; then
        echo "WARN: remote provider without ZERODAY_REMOTE_INFERENCE_ACK — ZERODAY will refuse remote endpoints."
        exit 2
      fi
      ;;
  esac
  echo "OK: env smoke (no network / no RunPod API)."
}

do_serve() {
  if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "Refusing --serve under CI. Fixture path only."
    exit 2
  fi
  if ! command -v vllm >/dev/null 2>&1; then
    echo "vllm not on PATH. Install vLLM 0.19.1+ on the GPU pod, then retry."
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

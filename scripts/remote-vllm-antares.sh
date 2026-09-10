#!/usr/bin/env bash
# Host-agnostic CUDA / vLLM Antares checklist (operator-run).
# Recommended remote host: RunPod — see scripts/runpod-vllm-antares.sh
# ZERODAY never creates paid GPU resources.
set -euo pipefail

MODEL="${ANTARES_MODEL:-fdtn-ai/antares-1b}"
HOST="${ZERODAY_VLLM_HOST:-0.0.0.0}"
PORT="${ZERODAY_VLLM_PORT:-8000}"

cat <<EOF
=== ZERODAY remote CUDA / vLLM Antares (host-agnostic) ===

Recommended product path: RunPod → bash scripts/runpod-vllm-antares.sh --print-only
                          docs/runpod-antares.md

Any GPU host (Lambda, Vast, cloud VM, own box, Nebius appendix):

1) Provision the host YOURSELF (this script will not).
2) Accept HF terms for ${MODEL} on that host; set HUGGING_FACE_HUB_TOKEN there.
3) Serve completions:
     vllm serve ${MODEL} --host ${HOST} --port ${PORT}
   Expect POST /v1/completions
4) Operator laptop:
     export ZERODAY_INFERENCE_PROVIDER=remote
     export ZERODAY_ANTARES_BASE_URL=https://<host>/v1
     export ZERODAY_REMOTE_INFERENCE_ACK=1
     npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \\
       --endpoint \"\$ZERODAY_ANTARES_BASE_URL\" --remote-inference

Docs: docs/remote-antares-vllm.md · docs/runpod-antares.md
EOF

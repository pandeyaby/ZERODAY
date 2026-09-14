#!/usr/bin/env bash
# Local OpenAI-compatible brain checklist (Keyless K4) — print-only.
#
# ZERODAY never downloads models, never starts Ollama/vLLM/LM Studio, and never
# provisions RunPod from this script. Safe for CI ($0).
#
# Usage:
#   bash scripts/local-brain-doctor.sh --print-only
#   bash scripts/local-brain-doctor.sh -h
set -euo pipefail

print_help() {
  cat <<'EOF'
Local OpenAI-compatible brain doctor (print-only)

  --print-only   Print local-brain checklist (default; $0, no network)
  -h, --help     This help

Requires POST /v1/completions (not chat). See docs/local-brain.md.
Antares-1B remains the recommended live brain when HF+CUDA available.
Arbitrary local models are NOT Antares File F1.
EOF
}

print_checklist() {
  cat <<'EOF'
=== ZERODAY local-brain checklist (Keyless K4, operator) ===

Print-only. Does NOT download models, start Ollama/vLLM/LM Studio, create
RunPod pods, or probe the network. $0.

Honesty: arbitrary local models are NOT Antares File F1. Antares-1B remains
the recommended live brain when HF gated terms + CUDA/vLLM are available.
Localization ≠ exploitability.

1) Completions-only (hard lock)
   Required: POST /v1/completions
   Refused:  /v1/chat/completions
   Endpoint shape: http://127.0.0.1:<port>/v1  (or …/v1/completions)
   locate --endpoint → still mode: "live" (no new locate modes)

2) Loopback vs remote ACK
   Loopback: no --remote-inference
   Non-loopback: --remote-inference or ZERODAY_REMOTE_INFERENCE_ACK=1

3) Sample probe steps (YOU run — this script only prints)
   curl -sS http://127.0.0.1:8000/v1/models
   curl -sS http://127.0.0.1:8000/v1/completions \
     -H 'Content-Type: application/json' \
     -d '{"model":"<your-model-id>","prompt":"ping","max_tokens":8}'

4) Example hosts (you start them)
   local vLLM / Ollama OpenAI compat / LM Studio local server
   Mac MPS: unreliable for schema-faithful Antares tool_call — prefer CUDA

5) Point locate
   npm run zeroday -- locate --cwe CWE-89 --repo <authorized-repo> \
     --endpoint http://127.0.0.1:8000/v1 --model <your-model-id>

6) Recommended Antares path (HF + CUDA)
   npm run zeroday -- antares doctor
   docs/runpod-antares.md · docs/antares.md

Full one-pager: docs/local-brain.md
CLI twin: npm run zeroday -- doctor
EOF
}

mode="print-only"
case "${1:-}" in
  ""|--print-only) mode="print-only" ;;
  -h|--help) print_help; exit 0 ;;
  *)
    echo "Unknown flag: $1" >&2
    print_help >&2
    exit 2
    ;;
esac

if [ "$mode" = "print-only" ]; then
  print_checklist
fi

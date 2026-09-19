#!/usr/bin/env bash
# scripts/stranger-verify.sh — prove-doors card for first-time visitors
#
# Keyless only. Reuses npm run trust-loop (locate SARIF → paired-probe).
# Does NOT run live GPU, provision pods, or invent AUROC / F1 / latency SLAs.
#
# Door A: what just ran (PASS + artifact pointers)
# Door B: cite docs/gpu-claims.md § Live re-proof (2026-09-19) — dated measured
#         citation only; never spend GPU money from this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_ROOT="${TRUST_LOOP_OUT:-zeroday-reports/trust-loop}"
SAMPLE_GRADE_MD="docs/reports/diptych-sample-grade.md"
GPU_CLAIMS="docs/gpu-claims.md"

usage() {
  cat <<'EOF'
Usage: npm run stranger:verify   (alias: npm run doors)

  Keyless prove-doors path for strangers:
    1. Runs npm run trust-loop (fixture SARIF → paired-probe:from-sarif)
    2. Prints Door A / Door B honest card (Door B = citation only — no GPU)

  Options forwarded to trust-loop:
    --mvp    Run npm run mvp first, then from-sarif on zeroday-reports/mvp
    --help   Show this help

Never provisions pods. Never calls RunPod. Never invents AUROC / File-F1 / SLAs.
EOF
}

FORWARD_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --mvp) FORWARD_ARGS+=(--mvp) ;;
    *)
      echo "Unknown arg: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

echo "ZERODAY prove-doors (keyless · no GPU spend)"
echo "════════════════════════════════════════════"
echo ""

# ── Door A: run keyless trust-loop ──────────────────────────────────────────
if [[ ${#FORWARD_ARGS[@]} -gt 0 ]]; then
  npm run trust-loop -- "${FORWARD_ARGS[@]}"
else
  npm run trust-loop
fi

MATRIX="$OUT_ROOT/paired-probe/coverage/matrix.json"
ENVELOPES="$OUT_ROOT/paired-probe/"

echo ""
echo "════════════════════════════════════════════"
echo "PROVE-DOORS CARD"
echo "════════════════════════════════════════════"
echo ""
echo "Door A — Keyless (just ran · PASS)"
echo "  Ran: npm run trust-loop → paired-probe:from-sarif (offline fixture SARIF)"
echo "  Artifacts:"
echo "    envelopes : $ENVELOPES"
echo "    matrix    : $MATRIX"
echo "    sample md : $SAMPLE_GRADE_MD"
echo "  Also see: npm run mvp → zeroday-reports/mvp/ (fixture locate → SARIF)"
echo "  CI badge story: docs/ci-trust.md"
echo ""
echo "Door B — Live GPU (citation only · NOT run here)"
echo "  Do not provision pods from this command. Cite the dated operator re-proof:"
echo "  → $GPU_CLAIMS § Live re-proof (2026-09-19 PT)"
echo "  Measured facts already on that page (quote only — invent nothing):"
echo "    · pod id        d65ny3xqf7bwza"
echo "    · tier / GPU    RunPod Secure Cloud · NVIDIA A40"
echo "    · estimated \$   ~\$0.034 (under ≤\$0.50 ceiling; rate \$0.49/hr at create)"
echo "    · models ping   GET /v1/models → 200"
echo "    · completions   POST /v1/completions → 200"
echo "    · live locate   ranked file src/users.js (CWE-89 fixture; localization-only)"
echo "  To re-run Door B yourself: docs/runpod-antares.md (you provision + terminate)."
echo ""
echo "Non-claims (honest)"
echo "  · localization ≠ exploitability · needs_human stays true"
echo "  · CI badge ≠ vuln proof (see docs/ci-trust.md)"
echo "  · no AUROC / File-F1 / org-scale latency SLAs invented here"
echo "  · DIPTYCH grades separately · ZeroDay emits"
echo "  · sample grade is illustrative (not a live DIPTYCH harness run)"
echo ""
echo "Docs: docs/stranger-verify.md · docs/ci-trust.md · docs/gpu-claims.md · SUPPORT.md"
echo "PASS — Door A keyless path verified locally."

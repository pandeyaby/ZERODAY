#!/usr/bin/env bash
# scripts/stranger-verify.sh — prove-doors card for first-time visitors
#
# Keyless only. Reuses npm run trust-loop (locate SARIF → paired-probe).
# Does NOT run live GPU, provision pods, or invent AUROC / F1 / latency SLAs.
#
# Door A: what just ran (PASS + artifact pointers)
# Door B: cite docs/gpu-claims.md § Live re-proof (2026-09-19) — dated measured
#         citation only; never spend GPU money from this script.
#
# Machine-readable: --json or ZERODAY_STRANGER_JSON=1 → single JSON object on stdout
# (trust-loop prose on stderr). Default remains the human prove-doors card.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_ROOT="${TRUST_LOOP_OUT:-zeroday-reports/trust-loop}"
SAMPLE_GRADE_MD="docs/reports/diptych-sample-grade.md"
GPU_CLAIMS="docs/gpu-claims.md"
SCHEMA_VERSION="zeroday-stranger-verify/v1"

# Door B citation facts — quote only what docs/gpu-claims.md § Live re-proof already records.
DOOR_B_SECTION="Live re-proof (2026-09-19 PT)"
DOOR_B_POD_ID="d65ny3xqf7bwza"
DOOR_B_TIER="RunPod Secure Cloud · NVIDIA A40"
DOOR_B_ESTIMATED_SPEND='~$0.034'
DOOR_B_MODELS_HTTP=200
DOOR_B_COMPLETIONS_HTTP=200
DOOR_B_LOCATE_FILE="src/users.js"

usage() {
  cat <<'EOF'
Usage: npm run stranger:verify   (alias: npm run doors)

  Keyless prove-doors path for strangers:
    1. Runs npm run trust-loop (fixture SARIF → paired-probe:from-sarif)
    2. Prints Door A / Door B honest card (Door B = citation only — no GPU)

  Options:
    --json     Print a single JSON object to stdout (schemaVersion + doorA/doorB/nonClaims)
               Same as ZERODAY_STRANGER_JSON=1. Trust-loop prose goes to stderr.
    --human    Force human-readable card (default when --json is not set)
    --mvp      Forwarded to trust-loop (run npm run mvp first)
    --help     Show this help

Never provisions pods. Never calls RunPod. Never invents AUROC / File-F1 / SLAs.
EOF
}

JSON_MODE=0
if [[ "${ZERODAY_STRANGER_JSON:-}" == "1" ]]; then
  JSON_MODE=1
fi

FORWARD_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --json) JSON_MODE=1 ;;
    --human) JSON_MODE=0 ;;
    --mvp) FORWARD_ARGS+=(--mvp) ;;
    *)
      echo "Unknown arg: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

DOOR_A_COMMAND="npm run trust-loop"
if [[ ${#FORWARD_ARGS[@]} -gt 0 ]]; then
  DOOR_A_COMMAND="npm run trust-loop -- ${FORWARD_ARGS[*]}"
fi

# ── Door A: run keyless trust-loop ──────────────────────────────────────────
run_trust_loop() {
  if [[ ${#FORWARD_ARGS[@]} -gt 0 ]]; then
    npm run trust-loop -- "${FORWARD_ARGS[@]}"
  else
    npm run trust-loop
  fi
}

if [[ "$JSON_MODE" -eq 1 ]]; then
  # Keep stdout clean for jq / CI parsers — trust-loop prose on stderr.
  run_trust_loop >&2
else
  echo "ZERODAY prove-doors (keyless · no GPU spend)"
  echo "════════════════════════════════════════════"
  echo ""
  run_trust_loop
fi

MATRIX="$OUT_ROOT/paired-probe/coverage/matrix.json"
ENVELOPES="$OUT_ROOT/paired-probe/"

emit_json() {
  # Single object on stdout. doorB.ran is always false — citation only; no live GPU.
  # shellcheck disable=SC2016
  node -e '
const payload = {
  schemaVersion: process.env.SCHEMA_VERSION,
  doorA: {
    status: "pass",
    ran: true,
    command: process.env.DOOR_A_COMMAND,
    artifacts: {
      envelopes: process.env.ENVELOPES,
      matrix: process.env.MATRIX,
      sampleGradeMd: process.env.SAMPLE_GRADE_MD,
    },
  },
  doorB: {
    mode: "citation",
    ran: false,
    citation: {
      doc: process.env.GPU_CLAIMS,
      section: process.env.DOOR_B_SECTION,
      factsDocumented: {
        podId: process.env.DOOR_B_POD_ID,
        tierGpu: process.env.DOOR_B_TIER,
        estimatedSpend: process.env.DOOR_B_ESTIMATED_SPEND,
        modelsHttp: Number(process.env.DOOR_B_MODELS_HTTP),
        completionsHttp: Number(process.env.DOOR_B_COMPLETIONS_HTTP),
        liveLocateRankedFile: process.env.DOOR_B_LOCATE_FILE,
      },
    },
    note: "Door B was not executed by this command — quote docs/gpu-claims.md only; do not invent $ / pod / latency.",
  },
  nonClaims: {
    localizationNotExploitability: true,
    needsHuman: true,
    noAurocFileF1OrgLatencySla: true,
    ciBadgeNotVulnProof: true,
    diptychGradesSeparately: true,
    sampleGradeIllustrative: true,
  },
};
process.stdout.write(JSON.stringify(payload) + "\n");
'
}

if [[ "$JSON_MODE" -eq 1 ]]; then
  SCHEMA_VERSION="$SCHEMA_VERSION" \
  DOOR_A_COMMAND="$DOOR_A_COMMAND" \
  ENVELOPES="$ENVELOPES" \
  MATRIX="$MATRIX" \
  SAMPLE_GRADE_MD="$SAMPLE_GRADE_MD" \
  GPU_CLAIMS="$GPU_CLAIMS" \
  DOOR_B_SECTION="$DOOR_B_SECTION" \
  DOOR_B_POD_ID="$DOOR_B_POD_ID" \
  DOOR_B_TIER="$DOOR_B_TIER" \
  DOOR_B_ESTIMATED_SPEND="$DOOR_B_ESTIMATED_SPEND" \
  DOOR_B_MODELS_HTTP="$DOOR_B_MODELS_HTTP" \
  DOOR_B_COMPLETIONS_HTTP="$DOOR_B_COMPLETIONS_HTTP" \
  DOOR_B_LOCATE_FILE="$DOOR_B_LOCATE_FILE" \
    emit_json
  exit 0
fi

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
echo "    · pod id        $DOOR_B_POD_ID"
echo "    · tier / GPU    $DOOR_B_TIER"
echo "    · estimated \$   $DOOR_B_ESTIMATED_SPEND (under ≤\$0.50 ceiling; rate \$0.49/hr at create)"
echo "    · models ping   GET /v1/models → $DOOR_B_MODELS_HTTP"
echo "    · completions   POST /v1/completions → $DOOR_B_COMPLETIONS_HTTP"
echo "    · live locate   ranked file $DOOR_B_LOCATE_FILE (CWE-89 fixture; localization-only)"
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

#!/usr/bin/env bash
# scripts/trust-loop.sh — stranger trust loop (keyless / no GPU)
#
# One-screen story for design partners:
#   locate (mvp or fixture SARIF) → paired-probe:from-sarif → sample grade docs
#
# Default uses the in-repo ingest sample SARIF (instant, offline).
# Pass --mvp to run fixture locate first, then feed zeroday-reports/mvp.
#
# Honest non-claims: emit-only · localization ≠ exploitability · no AUROC ·
# DIPTYCH grades · ZeroDay emits · sample grade is illustrative (not live DIPTYCH).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

USE_MVP=0
OUT_ROOT="${TRUST_LOOP_OUT:-zeroday-reports/trust-loop}"
SAMPLE_SARIF="fixtures/locate/ingest-sample/sample.sarif"
SAMPLE_GRADE_MD="docs/reports/diptych-sample-grade.md"
SAMPLE_GRADE_JSON="docs/reports/diptych-sample-grade.json"

usage() {
  cat <<'EOF'
Usage: npm run trust-loop [-- --mvp] [-- --help]

  (default)  Use fixtures/locate/ingest-sample/sample.sarif → paired-probe:from-sarif
  --mvp      Run npm run mvp first, then from-sarif on zeroday-reports/mvp
  --help     Show this help

Keyless / offline / no GPU. Prints artifact paths + checked-in sample grade.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --mvp) USE_MVP=1 ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Unknown arg: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

echo "ZERODAY stranger trust loop (keyless · no GPU)"
echo "──────────────────────────────────────────────"
echo "Story: mvp/locate → SARIF → paired-probe:from-sarif → sample grade docs"
echo ""

SARIF_INPUT="$SAMPLE_SARIF"
if [[ "$USE_MVP" -eq 1 ]]; then
  echo "① fixture locate (npm run mvp) → zeroday-reports/mvp/"
  npm run mvp
  SARIF_INPUT="zeroday-reports/mvp"
  echo ""
else
  echo "① fixture SARIF (in-repo sample — skip mvp for speed)"
  echo "   $SAMPLE_SARIF"
  echo "   (same door with live mvp output: npm run trust-loop -- --mvp)"
  echo ""
fi

test -e "$SARIF_INPUT" || {
  echo "Missing SARIF input: $SARIF_INPUT" >&2
  exit 2
}

echo "② paired-probe:from-sarif → $OUT_ROOT/"
npm run paired-probe:from-sarif -- --sarif "$SARIF_INPUT" --output "$OUT_ROOT"
echo ""

MATRIX="$OUT_ROOT/paired-probe/coverage/matrix.json"
echo "③ paths (open these — no DIPTYCH clone required)"
echo "   envelopes : $OUT_ROOT/paired-probe/"
echo "   matrix    : $MATRIX"
echo "   sample md : $SAMPLE_GRADE_MD"
echo "   sample js : $SAMPLE_GRADE_JSON"
echo ""
echo "Honest non-claims:"
echo "  · localization ≠ exploitability · needs_human stays true"
echo "  · no AUROC / PoC / exploit theater"
echo "  · DIPTYCH grades · ZeroDay emits"
echo "  · checked-in sample grade is illustrative (not a live DIPTYCH harness run)"
echo ""
echo "Docs: docs/paired-probes.md · docs/design-partner-trust.md · SUPPORT.md"

#!/usr/bin/env bash
# Opt-in pre-commit gate: keyless Door A `npm run stranger:verify`.
# No GPU / HF / live Antares. Door B stays citation-only (inside stranger:verify).
#
# Install (opt-in — not auto via prepare):
#   npm run hooks:install
# Skip once:
#   SKIP=stranger-verify git commit …
#   git commit --no-verify
#
# CI remains source of truth — this is a local soft convenience only.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pre-commit-stranger-verify.sh [--help] [--dry-run]

  Opt-in git pre-commit hook for ZERODAY Door A (keyless stranger:verify).

  Options:
    --help, -h   Show this help and exit 0
    --dry-run    Print the gate command; do not run stranger:verify

  Skip:
    SKIP=stranger-verify   Skip this hook (exit 0)
    git commit --no-verify Bypass all hooks

  Never runs live Antares, RunPod, or HF downloads.
  CI stranger-verify job remains the authoritative prove-doors gate.
EOF
}

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --dry-run) DRY_RUN=1 ;;
    *)
      echo "Unknown arg: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# Honors SKIP=stranger-verify (and comma-lists like SKIP=foo,stranger-verify,bar)
if [[ -n "${SKIP:-}" ]]; then
  IFS=',' read -r -a _skip_parts <<< "${SKIP}"
  for _s in "${_skip_parts[@]}"; do
    if [[ "${_s}" == "stranger-verify" ]]; then
      echo "ZERODAY pre-commit: SKIP=stranger-verify — skipping Door A gate"
      exit 0
    fi
  done
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "ZERODAY pre-commit: no package.json — skip"
  exit 0
fi

GATE_CMD=(npm run stranger:verify)

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "ZERODAY pre-commit: dry-run — would run: ${GATE_CMD[*]}"
  echo "ZERODAY pre-commit: keyless only (no GPU / no live Antares)"
  exit 0
fi

if [[ ! -d node_modules ]]; then
  echo "ZERODAY pre-commit: node_modules missing — run npm ci (or npm install)"
  exit 1
fi

echo "ZERODAY pre-commit: npm run stranger:verify (Door A keyless · Door B citation-only)…"
"${GATE_CMD[@]}"
echo "ZERODAY pre-commit: ok (local soft gate — CI remains source of truth)"
exit 0

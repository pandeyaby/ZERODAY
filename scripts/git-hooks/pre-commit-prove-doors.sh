#!/usr/bin/env bash
# Opt-in pre-commit gate: keyless `npm run prove-doors` (Door A + cassette + Door D + Door E).
# No --live-url / GPU / HF / live Antares / RunPod.
#
# Install (opt-in — not auto via prepare):
#   npm run hooks:install-prove-doors
# Skip once:
#   SKIP=prove-doors git commit …
#   git commit --no-verify
#
# CI remains source of truth — this is a local soft convenience only.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pre-commit-prove-doors.sh [--help] [--dry-run]

  Opt-in git pre-commit hook for ZERODAY keyless prove-doors
  (Door A stranger:verify + cassette:replay + Door D historical A40 evidence; Door B skipped).

  Options:
    --help, -h   Show this help and exit 0
    --dry-run    Print the gate command; do not run prove-doors

  Skip:
    SKIP=prove-doors   Skip this hook (exit 0)
    git commit --no-verify Bypass all hooks

  Never passes --live-url. Never runs live Antares, RunPod, or HF downloads.
  Fail-closed: non-zero exit when the gate fails or node_modules is missing.
  CI prove-doors / stranger-verify jobs remain the authoritative gate.
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

# Honors SKIP=prove-doors (and comma-lists like SKIP=foo,prove-doors,bar)
if [[ -n "${SKIP:-}" ]]; then
  IFS=',' read -r -a _skip_parts <<< "${SKIP}"
  for _s in "${_skip_parts[@]}"; do
    if [[ "${_s}" == "prove-doors" ]]; then
      echo "ZERODAY pre-commit: SKIP=prove-doors — skipping Door A + cassette gate"
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

# Keyless only — never append --live-url
GATE_CMD=(npm run prove-doors)

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "ZERODAY pre-commit: dry-run — would run: ${GATE_CMD[*]}"
  echo "ZERODAY pre-commit: keyless only (Door A + cassette · no --live-url / no GPU)"
  exit 0
fi

if [[ ! -d node_modules ]]; then
  echo "ZERODAY pre-commit: node_modules missing — run npm ci (or npm install)"
  exit 1
fi

echo "ZERODAY pre-commit: npm run prove-doors (Door A + cassette · no --live-url)…"
"${GATE_CMD[@]}"
echo "ZERODAY pre-commit: ok (local soft gate — CI remains source of truth)"
exit 0

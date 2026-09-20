#!/usr/bin/env bash
# Opt-in installer for the stranger:verify pre-commit hook.
# Does not run on npm install / prepare — call explicitly:
#   npm run hooks:install
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

HOOK_SRC="$ROOT/scripts/git-hooks/pre-commit-stranger-verify.sh"
HOOK_DST="$ROOT/.git/hooks/pre-commit"

usage() {
  cat <<'EOF'
Usage: npm run hooks:install   (or: bash scripts/git-hooks/install-stranger-verify-hook.sh)

  Installs an opt-in local pre-commit hook that runs:
    npm run stranger:verify

  Keyless Door A only. No GPU / live Antares. Skip with SKIP=stranger-verify
  or git commit --no-verify. CI remains source of truth.

  Options:
    --help, -h   Show this help
    --dry-run    Print install steps; do not write .git/hooks
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

if [[ ! -f "$HOOK_SRC" ]]; then
  echo "Missing hook script: $HOOK_SRC" >&2
  exit 1
fi

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Not a git checkout (.git missing) — nothing to install" >&2
  exit 1
fi

mkdir -p "$ROOT/.git/hooks"

# Prefer relative symlink so the hook stays portable within this clone.
REL_SRC="../../scripts/git-hooks/pre-commit-stranger-verify.sh"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "dry-run: would chmod +x $HOOK_SRC"
  echo "dry-run: would ln -sfn $REL_SRC $HOOK_DST"
  exit 0
fi

chmod +x "$HOOK_SRC" "$ROOT/scripts/git-hooks/install-stranger-verify-hook.sh"

if [[ -e "$HOOK_DST" || -L "$HOOK_DST" ]]; then
  echo "Note: replacing existing .git/hooks/pre-commit"
fi

ln -sfn "$REL_SRC" "$HOOK_DST"
echo "Installed: .git/hooks/pre-commit → scripts/git-hooks/pre-commit-stranger-verify.sh"
echo "Skip: SKIP=stranger-verify git commit …  ·  or  git commit --no-verify"
echo "Docs: docs/stranger-verify.md § Optional local pre-commit"

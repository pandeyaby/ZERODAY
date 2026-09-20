#!/usr/bin/env bash
# Codespaces / devcontainer tip — keyless Door A (+ cassette / Door D / Door E via prove-doors).
# Does NOT run stranger:verify, pull HF weights, or spend GPU.
set -euo pipefail

cat <<'EOF'

════════════════════════════════════════════
ZERODAY Codespace — clone-free Door A
════════════════════════════════════════════

  1. Wait for postCreate (`npm install`) if still running
  2. Run Task → “ZERODAY: prove-doors (keyless)”
     (or: npm run prove-doors -- --json)
     Door A + cassette + Door D + Door E · no --live-url
  3. Or: npm run stranger:verify  (alias: npm run doors)
  4. Expect Door A PASS + Door B citation (no GPU here)

Honest non-claims:
  · localization ≠ exploitability · needs_human always
  · no AUROC / File-F1 invented here
  · Codespace ≠ live Antares (Door B stays citation-only)
  · Door E = dry-run Code Scanning check, not live upload
  · no HF gated weights · no RunPod auto-provision

Docs: docs/stranger-verify.md · README “What a stranger can verify today”
Tasks: Terminal → Run Task → “ZERODAY: prove-doors (keyless)”
       or “ZERODAY: prove-doors (stranger:verify)”

EOF

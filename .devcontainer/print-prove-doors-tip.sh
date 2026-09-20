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
     (or: npm run prove-doors -- --json --out prove-doors.json)
     writes prove-doors.json · Door A + cassette + Door D + Door E · no --live-url
  3. Or: npm run stranger:verify  (alias: npm run doors)
  4. Optional: Run Task → “ZERODAY: upload-sarif (dry-run)” (fixture only; no live upload)
  5. Optional: Run Task → “ZERODAY: gpu-evidence”
     (or: npm run gpu-evidence -- --json --out gpu-evidence.json)
     writes gpu-evidence.json · historical Measured A40 only; does not start RunPod
  6. Expect Door A PASS + Door B citation (no GPU here)

Honest non-claims:
  · localization ≠ exploitability · needs_human always
  · no AUROC / File-F1 invented here
  · Codespace ≠ live Antares (Door B stays citation-only)
  · Door E / upload-sarif task = dry-run Code Scanning check, not live upload
  · gpu-evidence task = --out gpu-evidence.json · historical Measured A40 only; does not start RunPod
  · live upload stays CLI + security_events: write
  · no HF gated weights · no RunPod auto-provision

Docs: docs/stranger-verify.md · README “What a stranger can verify today”
Tasks: Terminal → Run Task → “ZERODAY: prove-doors (keyless)”
       or “ZERODAY: prove-doors (stranger:verify)”
       or “ZERODAY: upload-sarif (dry-run)”
       or “ZERODAY: gpu-evidence”

EOF

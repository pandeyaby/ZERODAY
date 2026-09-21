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
  6. Optional: Run Task → “ZERODAY: evidence-pack”
     (or: npm run evidence-pack -- --json --out out/evidence)
     writes out/evidence/ (prove-doors.json + gpu-evidence.json + report.json + report.md + manifest.json); does not start RunPod
     tip: add --top N for a short CISO cut in packed report.json / report.md (same as report --top)
  7. Optional: Run Task → “ZERODAY: doctor”
     (or: npm run doctor -- --json --out out/doctor.json)
     writes out/doctor.json · workstation readiness (zeroday.doctor/v1); does not start RunPod
  8. Optional: Run Task → “ZERODAY: report”
     (or: npm run report -- --from fixtures/locate/report-sample/prove-doors.json --out out/report.md)
     writes out/report.md + out/report.json · CISO localization summary (zeroday.report/v1); does not start RunPod
     tip: add --top N for a short CISO cut of the top N ranked findings (e.g. --top 5)
  9. Expect Door A PASS + Door B citation (no GPU here)

Honest non-claims:
  · localization ≠ exploitability · needs_human always
  · no AUROC / File-F1 invented here
  · Codespace ≠ live Antares (Door B stays citation-only)
  · Door E / upload-sarif task = dry-run Code Scanning check, not live upload
  · gpu-evidence task = --out gpu-evidence.json · historical Measured A40 only; does not start RunPod
  · evidence-pack task = --out out/evidence · historical gpu-evidence only; optional --top N; does not start RunPod
  · doctor task = --out out/doctor.json · local workstation readiness only; does not start RunPod
  · report task = --out out/report.md + out/report.json · localization only; optional --top N; does not start RunPod
  · live upload stays CLI + security_events: write
  · no HF gated weights · no RunPod auto-provision

Docs: docs/stranger-verify.md · README “What a stranger can verify today”
Tasks: Terminal → Run Task → “ZERODAY: prove-doors (keyless)”
       or “ZERODAY: prove-doors (stranger:verify)”
       or “ZERODAY: upload-sarif (dry-run)”
       or “ZERODAY: gpu-evidence”
       or “ZERODAY: evidence-pack”
       or “ZERODAY: doctor”
       or “ZERODAY: report”

EOF

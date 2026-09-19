# Prove-doors — what a stranger can verify today

Thin companion to the root README section **What a stranger can verify today**.
Keyless only. Defensive localization — no PoC / exploit theater.

## One command

```bash
npm install
npm run stranger:verify
# alias: npm run doors
```

Runs `npm run trust-loop` (fixture SARIF → `paired-probe:from-sarif`) and prints
an honest Door A / Door B card. Optional: `npm run stranger:verify -- --mvp` to
run fixture locate first.

| Door | This command | Evidence |
|------|--------------|----------|
| **A — Keyless** | **Runs** locally · $0 · no GPU · no HF | PASS + SARIF / paired-probe paths under `zeroday-reports/trust-loop/` · sample grade [`reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md) |
| **B — Live GPU** | **Does not run** · citation only | Dated measured session in [`gpu-claims.md`](./gpu-claims.md) § Live re-proof (2026-09-19 PT) |

## Door B facts (already on `gpu-claims.md` — invent nothing)

Quote only what that page already records for the 2026-09-19 Secure A40 session:

- Pod `d65ny3xqf7bwza` · Secure Cloud · NVIDIA A40
- Estimated spend ~$0.034 (under ≤$0.50 ceiling)
- `GET /v1/models` → 200 · `POST /v1/completions` → 200
- Live locate ranked `src/users.js` (CWE-89 fixture) · localization-only

No auto-provision. No GPU spend from `stranger:verify`. To re-run yourself:
[`runpod-antares.md`](./runpod-antares.md) (you provision + terminate).

## Non-claims

- Localization ≠ exploitability · `needs_human` always
- CI badge ≠ vuln proof — [`ci-trust.md`](./ci-trust.md)
- No AUROC / File-F1 / org-scale latency SLAs
- DIPTYCH grades separately · ZeroDay emits
- Sample grade is illustrative (not a live DIPTYCH harness run)

## Related

| Doc | Role |
|-----|------|
| [`ci-trust.md`](./ci-trust.md) | What the Actions badge proves / does not |
| [`gpu-claims.md`](./gpu-claims.md) | Proven vs deferred + dated live GPU re-proof |
| [`paired-probes.md`](./paired-probes.md) | Trust-loop / from-sarif detail |
| Root [`README.md`](../README.md) | Skim path + prove-doors section |

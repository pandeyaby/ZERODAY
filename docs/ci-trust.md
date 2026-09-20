# CI trust — what the badge proves (and does not)

One-pager for strangers and design partners who see the GitHub Actions badge on
the [README](../README.md) and want the honest story without reading CI YAML.

**Badge → workflow:**
[![ZERODAY locate](https://github.com/pandeyaby/ZERODAY/actions/workflows/zeroday-locate.yml/badge.svg)](https://github.com/pandeyaby/ZERODAY/actions/workflows/zeroday-locate.yml)

| Field | Value |
|-------|--------|
| Workflow file | [`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml) |
| Workflow `name:` (badge label) | `ZERODAY locate` |
| Required paired-probe job | `paired-probe` — all 8 operators + `gate_axis_mutate` |
| Stranger prove-doors job | `stranger-verify` — runs `npm run --silent stranger:verify -- --json` (Door A keyless + Door B citation-only; no GPU) **and** `npm run --silent prove-doors -- --json --out prove-doors.json` (Door A + cassette + Door D historical A40 evidence + Door E upload-sarif dry-run; Door B skipped) **and** `npm run --silent gpu-evidence -- --json --out gpu-evidence.json` (CI validates historical evidence JSON; does not start RunPod) **and** `npm run --silent evidence-pack -- --json --out out/evidence` (design-partner pack; does not start RunPod) **and** `npm run --silent doctor -- --json --out out/doctor.json` (zeroday.doctor/v1 workstation readiness; does not start RunPod) **and** `npm run --silent report -- --from fixtures/locate/report-sample/prove-doors.json --json --out out/report.json` (+ `--out out/report.md`; zeroday.report/v1 CISO localization summary; does not start RunPod); uploads artifacts `stranger-verify-json` + `prove-doors-json` + `gpu-evidence-json` + `evidence-pack` + `doctor` + `report` (**not** vuln / AUROC proof) |
| Reusable workflow (other repos) | [`stranger-verify.yml`](../.github/workflows/stranger-verify.yml) — `uses: pandeyaby/ZERODAY/.github/workflows/stranger-verify.yml@main` (checks out ZERODAY, not caller source; same JSON artifact; see [`stranger-verify.md`](./stranger-verify.md)) |
| Posture | Keyless · fixture / offline adapters · **no GPU** · no HF pull · never auto-merge |

Deep paired-probe detail: [`paired-probes.md`](./paired-probes.md).
Trust pack: [`design-partner-trust.md`](./design-partner-trust.md).

---

## What the badge **does** prove

When the workflow is green on `main` / `pull_request`, CI has exercised the
keyless locate gate **and** the `paired-probe` job:

| Gate | Honest meaning |
|------|----------------|
| Fixture / keyless locate → SARIF | Factory **shape** on in-repo fixtures (human gate still required) |
| **`paired-probe`** (all 8 ops × conforming/violating) | Emit-only DIPTYCH adapters (`diptych_schema` 0.2) under `zeroday-reports/paired-probe/` |
| **`gate_axis_mutate`** (inside `npm run test:paired-probes`) | Every claimed-green cell fails when only its hyperproperty axis is mutated |
| **`stranger-verify`** (`npm run stranger:verify -- --json`) | Door A keyless trust-loop PASS + Door B citation card; CI uploads `stranger-verify-json` (not vuln / AUROC proof; no RunPod / HF / live Antares in CI) |
| **`prove-doors`** (`npm run prove-doors -- --json --out prove-doors.json`) | In-process Door A + cassette:replay + Door D (historical Measured A40 evidence, not live GPU) + Door E (dry-run Code Scanning check, not live upload); Door B skipped without `--live-url`; CI uploads `prove-doors-json` (not vuln / AUROC proof) |
| **`gpu-evidence`** (`npm run gpu-evidence -- --json --out gpu-evidence.json`) | CI validates checked-in historical Measured A40 evidence JSON; does not start RunPod; uploads `gpu-evidence-json` (not live GPU / AUROC proof) |
| **`evidence-pack`** (`npm run evidence-pack -- --json --out out/evidence`) | CI builds design-partner folder (`prove-doors.json` + historical `gpu-evidence.json` + `report.json`/`report.md` + `manifest.json`); fail-closed `assert-evidence-pack-report.mjs` requires packed `zeroday.report/v1` + markdown non-claims (`runpod: false`); does not start RunPod; uploads `evidence-pack` (not live GPU / AUROC proof) |
| **`doctor`** (`npm run doctor -- --json --out out/doctor.json`) | CI validates `zeroday.doctor/v1` workstation readiness (Node / scripts / historical gpu-evidence / cassette / entrypoints); does not start RunPod; uploads `doctor` (not live GPU / AUROC proof) |
| **`report`** (`npm run report -- --from fixtures/locate/report-sample/prove-doors.json --json --out out/report.json`) | CI validates `zeroday.report/v1` CISO localization summary from checked-in prove-doors fixture (+ `out/report.md`); does not start RunPod; uploads `report` (not vuln / AUROC proof) |

Operators covered when claimed green: FREEZEDRY · RESEED · SCHEMAX · SIGNFLIP ·
SATEXTEND · HISTSWAP · TRAJSWAP · VARSCALE. Prefer honest `deferred` over
cosmetic greens.

---

## What the badge does **not** prove

| Non-claim | Why |
|-----------|-----|
| ≠ vulnerability / exploitability proof | Localization candidates only; `needs_human` always |
| ≠ live Antares File F1 | Live Antares is **not** wired into this workflow; no GPU / no HF in this gate |
| ≠ DIPTYCH live harness grade | ZeroDay **emits** paired-probe envelopes; **DIPTYCH grades** separately ([DIPTYCH](https://github.com/pandeyaby/DIPTYCH)) |
| ≠ AUROC-as-product-grade | No marketing F1 / AUROC theater from fixture greens |
| ≠ customer-source assessment | Public OSS CI ≠ your private tree; assess only what you are authorized to touch |
| ≠ auto-merge / auto-patch | Never merges; patch drafts only with explicit operator ACK |

---

## How to verify locally (keyless)

```bash
npm ci
npm run test:paired-probes          # includes gate_axis_mutate
npm run paired-probe                # emit all-8 envelopes
```

Stranger trust loop (after locate): `npm run trust-loop` · sample grade:
[`reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md).

Prove both doors (keyless run + Door B citation): `npm run stranger:verify`
(alias `npm run doors`) · [`stranger-verify.md`](./stranger-verify.md).

From another repo (Actions, no GPU):  
`uses: pandeyaby/ZERODAY/.github/workflows/stranger-verify.yml@main` — snippet in
[`stranger-verify.md`](./stranger-verify.md).

Help: [`SUPPORT.md`](../SUPPORT.md).

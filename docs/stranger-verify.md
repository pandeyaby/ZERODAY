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
run fixture locate first. CI runs the same keyless command in the
`stranger-verify` job on
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)
(badge ≠ vuln proof — see [`ci-trust.md`](./ci-trust.md)).

### Clone-free — GitHub Codespaces (Door A)

No local Node install. Default Codespace is CPU / keyless only — **not** live
Antares (Door B stays citation-only; no GPU / no HF gated weights by default).

1. [Open in GitHub Codespaces](https://codespaces.new/pandeyaby/ZERODAY) (create codespace; waits for `postCreateCommand`: `npm install`)
2. Terminal: `npm run stranger:verify` (or `npm run doors`) — or VS Code task **ZERODAY: prove-doors (stranger:verify)**
3. Expect **Door A PASS** + **Door B citation**

Dev container: [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json).
`postStartCommand` only prints a tip card — it does **not** auto-run GPU or pull weights.

### Reusable Actions workflow (other repos)

Another org can prove Door A without inventing metrics or provisioning GPU by
calling ZERODAY’s reusable workflow. It **checks out ZERODAY** (scripts +
fixtures), not your app tree — public product door only, not a scan of caller
source.

```yaml
# .github/workflows/zeroday-doors.yml  (in YOUR repo)
name: Prove ZERODAY doors
on:
  workflow_dispatch:
  # schedule:
  #   - cron: "0 12 * * 1"

jobs:
  stranger-verify:
    uses: pandeyaby/ZERODAY/.github/workflows/stranger-verify.yml@main
    # Optional pin (prefer same ref as uses:):
    # with:
    #   zeroday_ref: main
    #   zeroday_repository: pandeyaby/ZERODAY
```

Workflow file:
[`.github/workflows/stranger-verify.yml`](../.github/workflows/stranger-verify.yml)
(`on: workflow_call`). ZERODAY’s own locate badge keeps its inline job (names
unchanged); strangers use this `uses:` entry point.

Browser: `npm run play` → http://localhost:3333/play → **Prove doors** tab
(same honesty card; copy-paste the command — Desk does not shell out to npm).

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
- Codespace ≠ live Antares (default Codespace has no GPU brain)
- No AUROC / File-F1 / org-scale latency SLAs
- DIPTYCH grades separately · ZeroDay emits
- Sample grade is illustrative (not a live DIPTYCH harness run)

## Related

| Doc | Role |
|-----|------|
| [`design-partner-day1.md`](./design-partner-day1.md) | Day-1 water-flow checklist (clone → mvp → trust-loop → this door → optional Door B cite) |
| [`ci-trust.md`](./ci-trust.md) | What the Actions badge proves / does not |
| [`gpu-claims.md`](./gpu-claims.md) | Proven vs deferred + dated live GPU re-proof |
| [`paired-probes.md`](./paired-probes.md) | Trust-loop / from-sarif detail |
| Root [`README.md`](../README.md) | Skim path + prove-doors section |

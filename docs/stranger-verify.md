# Prove-doors — what a stranger can verify today

Thin companion to the root README section **What a stranger can verify today**.
Keyless only. Defensive localization — no PoC / exploit theater.

## One command

```bash
npm install
npm run doctor          # local workstation readiness (fail-closed; no RunPod / no network)
npm run stranger:verify
# alias: npm run doors
```

Runs `npm run trust-loop` (fixture SARIF → `paired-probe:from-sarif`) and prints
an honest Door A / Door B card. Optional: `npm run stranger:verify -- --mvp` to
run fixture locate first.

### Machine-readable JSON (--json)

For CI / partners / parsers:

```bash
npm run --silent stranger:verify -- --json
# or: ZERODAY_STRANGER_JSON=1 npm run --silent stranger:verify
```

Single JSON object on stdout (`schemaVersion` `zeroday-stranger-verify/v1`,
`doorA` / `doorB` / `nonClaims`; Door B `mode: "citation"`, `ran: false` — no
live GPU). Prefer `--silent` so npm’s script banner does not precede the JSON.
Expected top-level keys: `schemaVersion`, `doorA`, `doorB`, `nonClaims`.

CI runs the same keyless `--json` command in the
`stranger-verify` job on
[`.github/workflows/zeroday-locate.yml`](../.github/workflows/zeroday-locate.yml)
and uploads artifact **`stranger-verify-json`** (`stranger-verify.json`) — Door A
proof card + Door B citation; **not** vuln / AUROC proof (badge ≠ vuln proof —
see [`ci-trust.md`](./ci-trust.md)). Same job also runs
`npm run prove-doors -- --json --out prove-doors.json` → artifact **`prove-doors-json`**
(`prove-doors.json`; A + cassette + Door D historical A40 evidence + Door E upload-sarif dry-run, B skipped) and
`npm run gpu-evidence -- --json --out gpu-evidence.json` → artifact **`gpu-evidence-json`** (CI validates historical evidence JSON; does not start RunPod) and
`npm run evidence-pack -- --json --out out/evidence` → artifact **`evidence-pack`** (`out/evidence/` incl. `report.json`/`report.md`; fail-closed `assert-evidence-pack-report.mjs`; does not start RunPod) and
`npm run doctor -- --json --out out/doctor.json` → artifact **`doctor`** (`out/doctor.json`; `zeroday.doctor/v1` workstation readiness; does not start RunPod) and
`npm run report -- --from fixtures/locate/report-sample/prove-doors.json --json --out out/report.json` (+ `--out out/report.md`) → artifact **`report`** (`out/report.json` + `out/report.md`; `zeroday.report/v1` CISO localization summary; does not start RunPod). Generated `out/` artifacts are gitignored (`fixtures/` / `docs/` historical evidence stay tracked). The reusable
[`stranger-verify.yml`](../.github/workflows/stranger-verify.yml) uploads the
same artifacts for external `workflow_call` callers.

Desk **Prove doors** tab: **Run all doors** → `POST /api/prove-doors`
(aggregates Door A + cassette:replay + Door D Measured A40 evidence + Door E upload-sarif dry-run + optional Door B; Door B
`status: "skipped"` when `liveUrl` omitted — not failed). After a successful Run-all, **Download prove-doors.json** (client-side from the last response; same shape as CLI `--out` / CI artifact). Measured A40 card: **Download gpu-evidence.json** (client-side from loaded `GET /api/gpu-evidence`; same shape as CLI `--out` / CI artifact; historical only; does not start RunPod). **Download evidence-pack** → `POST /api/evidence-pack` (in-process `runEvidencePack`; browser downloads `manifest.json` + `prove-doors.json` + `gpu-evidence.json` + `report.json` + `report.md` matching CLI `out/evidence/`; historical only; does not start RunPod). **Run doctor** → `POST /api/doctor` (in-process `runDoctor`; download `doctor.json` / `zeroday.doctor/v1`; local only; does not start RunPod). **Generate report** → `POST /api/report` (in-process `runReport`; download `report.json` + `report.md` / `zeroday.report/v1`; uses last Run-all or fixture; Desk then renders a ranked findings panel from `findings[]` — path / rank·score if present / evidence snippet / per-row Copy path + localization ≠ exploitability; never invents rows; localization only; does not start RunPod). Desk filesystem inputs (`from` / sarif / recording / gpuEvidenceFrom) are fail-closed via `assertAllowedReadPath` under the package root (`fixtures/` · `out/` · `docs/reports/` · `zeroday-reports/`) — path traversal / absolute escape → HTTP 400 `PATH_POLICY` (extends `src/lib/path-policy.ts`; no PoC). CLI `--from` / `--sarif` / `--recording` use the same gate (non-zero exit + `PATH_POLICY`). Door E = dry-run Code Scanning check, not live upload. CLI one-command:
`npm run prove-doors` / `zeroday prove-doors` (`--json`; optional
`--live-url` for Door B; `--out prove-doors.json` for CI / local file write). Design-partner pack: `npm run evidence-pack` → `out/evidence/` (`prove-doors.json` + historical `gpu-evidence.json` + `report.json`/`report.md` + `manifest.json`; no RunPod). Individual:
**Run Door A** → `POST /api/stranger-verify`
(in-process; citation Door B). **Run Door B live-url probe** →
`POST /api/live-url-probe` with `{ "liveUrl": "https://…/v1" }`
(`GET /v1/models` only; fail-closed on unreachable / non-200;
`provisioned: false`; probe ≠ A40 re-proof). **Run cassette:replay** →
`POST /api/cassette-replay` (pinned mode/findings/ranked file/SARIF/exit;
fail-closed). CLI copy-paste remains secondary.

### Opt-in Door B probe (`--live-url`) — operator endpoint only

When **you** already host an OpenAI-compatible `/v1` (loopback or remote you
pay for), you may ask `stranger:verify` to **probe** it — no RunPod create, no
HF token / weight pull, no auto-spend:

```bash
npm run stranger:verify -- --live-url http://127.0.0.1:8000/v1
npm run --silent stranger:verify -- --json --live-url http://127.0.0.1:8000/v1
```

Behavior:

- `GET <base>/v1/models` (same health convention as live doctor / completions probe)
- Human card + `--json` record `doorB.mode: "operator_endpoint"`,
  `doorB.probe` with HTTP status + latencyMs,
  `provisioned: false`, `spendUsd: null`
- Without `--live-url`, Door B stays **citation-only** (current default)

**Probe ≠ measured Secure A40 re-proof.** Historical pod / spend / models+completions
200 facts stay on [`gpu-claims.md`](./gpu-claims.md) § Live re-proof (2026-09-19 PT).
This flag only validates *your* endpoint reachability.

### Clone-free — GitHub Codespaces (Door A)

No local Node install. Default Codespace is CPU / keyless only — **not** live
Antares (Door B stays citation-only; no GPU / no HF gated weights by default).

1. [Open in GitHub Codespaces](https://codespaces.new/pandeyaby/ZERODAY) (create codespace; waits for `postCreateCommand`: `npm install`)
2. Terminal → Run Task → **ZERODAY: prove-doors (keyless)** (`npm run prove-doors -- --json --out prove-doors.json` — writes local `prove-doors.json`; Door A + cassette + Door D + Door E; no `--live-url`) — or `npm run stranger:verify` / task **ZERODAY: prove-doors (stranger:verify)**
3. Optional: Run Task → **ZERODAY: upload-sarif (dry-run)** (fixture SARIF only; live upload stays CLI with `security_events: write`)
4. Optional: Run Task → **ZERODAY: gpu-evidence** (`npm run gpu-evidence -- --json --out gpu-evidence.json` — historical Measured A40 only; does not start RunPod)
5. Optional: Run Task → **ZERODAY: evidence-pack** (`npm run evidence-pack -- --json --out out/evidence` — design-partner folder; does not start RunPod)
6. Optional: Run Task → **ZERODAY: doctor** (`npm run doctor -- --json --out out/doctor.json` — workstation readiness; does not start RunPod)
7. Optional: Run Task → **ZERODAY: report** (`npm run report -- --from fixtures/locate/report-sample/prove-doors.json --out out/report.md` (+ `--json --out out/report.json`) — CISO localization summary; does not start RunPod)
8. Expect **Door A PASS** + **Door B citation**

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
(same honesty card; copy-paste `stranger:verify` and `--json` — Desk does not
shell out to npm; schema preview is static, not live output).

| Door | This command | Evidence |
|------|--------------|----------|
| **A — Keyless** | **Runs** locally · $0 · no GPU · no HF | PASS + SARIF / paired-probe paths under `zeroday-reports/trust-loop/` · sample grade [`reports/diptych-sample-grade.md`](./reports/diptych-sample-grade.md) |
| **B — Live GPU** | **Does not run** · citation only (default) | Dated measured session in [`gpu-claims.md`](./gpu-claims.md) § Live re-proof (2026-09-19 PT) |
| **B — Opt-in probe** | `--live-url <your /v1>` · GET `/v1/models` only | `doorB.probe` status + latency · `provisioned: false` · `spendUsd: null` · **not** A40 re-proof |

## Door B facts (already on `gpu-claims.md` — invent nothing)

Quote only what that page already records for the 2026-09-19 Secure A40 session:

- Pod `d65ny3xqf7bwza` · Secure Cloud · NVIDIA A40
- Estimated spend ~$0.034 (under ≤$0.50 ceiling)
- `GET /v1/models` → 200 · `POST /v1/completions` → 200
- Live locate ranked `src/users.js` (CWE-89 fixture) · localization-only

No auto-provision. No GPU spend from `stranger:verify`. Opt-in `--live-url`
probes a URL you already host (`operator_endpoint`) — still no pod create.
To re-run a full live Door B yourself:
[`runpod-antares.md`](./runpod-antares.md) (you provision + terminate).

## Optional local pre-commit (opt-in)

Local soft gate only — **CI remains source of truth** (Actions
`stranger-verify` job). Not installed by `npm install` / `prepare`.

```bash
npm run hooks:install
# → .git/hooks/pre-commit → scripts/git-hooks/pre-commit-stranger-verify.sh
```

Runs keyless `npm run stranger:verify` before each commit (no GPU / no live
Antares). Opt-in alternate: `npm run hooks:install-prove-doors` runs keyless
`npm run prove-doors` (Door A + cassette, no `--live-url`). Skip anytime:

```bash
SKIP=stranger-verify git commit …
SKIP=prove-doors git commit …   # when using hooks:install-prove-doors
git commit --no-verify
```

Dry-run / help (no commit required):

```bash
bash scripts/git-hooks/pre-commit-stranger-verify.sh --help
bash scripts/git-hooks/pre-commit-stranger-verify.sh --dry-run
npm run hooks:install -- --dry-run
bash scripts/git-hooks/pre-commit-prove-doors.sh --dry-run
npm run hooks:install-prove-doors -- --dry-run
```

Repo already ships a separate fixture-locate sample under `hooks/pre-commit`
(manual `core.hooksPath` / symlink) — prefer this Door A hook for the
stranger/daily-driver path.

## Non-claims

- Localization ≠ exploitability · `needs_human` always
- CI badge ≠ vuln proof — [`ci-trust.md`](./ci-trust.md)
- Codespace ≠ live Antares (default Codespace has no GPU brain)
- `--live-url` probe ≠ dated Secure A40 re-proof (see [`gpu-claims.md`](./gpu-claims.md))
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

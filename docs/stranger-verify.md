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
see [`ci-trust.md`](./ci-trust.md)). The reusable
[`stranger-verify.yml`](../.github/workflows/stranger-verify.yml) uploads the
same artifact for external `workflow_call` callers.

Desk **Prove doors** tab shows a static example shape + copy-paste for this
command (no shell-out / no live Antares from the browser).

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
(same honesty card; copy-paste `stranger:verify` and `--json` — Desk does not
shell out to npm; schema preview is static, not live output).

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

## Optional local pre-commit (opt-in)

Local soft gate only — **CI remains source of truth** (Actions
`stranger-verify` job). Not installed by `npm install` / `prepare`.

```bash
npm run hooks:install
# → .git/hooks/pre-commit → scripts/git-hooks/pre-commit-stranger-verify.sh
```

Runs keyless `npm run stranger:verify` before each commit (no GPU / no live
Antares). Skip anytime:

```bash
SKIP=stranger-verify git commit …
git commit --no-verify
```

Dry-run / help (no commit required):

```bash
bash scripts/git-hooks/pre-commit-stranger-verify.sh --help
bash scripts/git-hooks/pre-commit-stranger-verify.sh --dry-run
npm run hooks:install -- --dry-run
```

Repo already ships a separate fixture-locate sample under `hooks/pre-commit`
(manual `core.hooksPath` / symlink) — prefer this Door A hook for the
stranger/daily-driver path.

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

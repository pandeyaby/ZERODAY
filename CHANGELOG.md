# Changelog

All notable changes to ZERODAY. The stable surface is defined in
[`docs/stability.md`](./docs/stability.md).

## Unreleased

### Supply chain
- **Signed releases with SBOMs** ([`docs/verify-release.md`](./docs/verify-release.md)).
  The Docker image is signed with cosign (keyless, GitHub OIDC → Sigstore),
  carries a GitHub build-provenance attestation, and has BuildKit's SPDX SBOM and
  SLSA provenance attached. The release also ships a CycloneDX SBOM of the CLI
  tarball's runtime dependencies and `SHA256SUMS`, both attested. No signing keys
  or new secrets.

### Docs
- **Live `--samples 2` benchmark row** in [`docs/antares-benchmark.md`](./docs/antares-benchmark.md):
  Antares-1B with two runs merged, run live on all 36 advisories (RunPod A40,
  2026-09-28), ranks the fixed file first in 36% of cases and in the top 3 in
  42% (single run: 25% / 32%; rules: 14% / 19%).

## 0.10.0

### Security
- **Desk web UI review** ([`docs/desk-security.md`](./docs/desk-security.md)). Fixed:
  a `cwd` field in `/api/desk`, `/api/live` and `/api/reports` request bodies
  replaced the path-sandbox root (scan any folder, write reports anywhere);
  cross-site `text/plain` POSTs were accepted (CSRF); any `Host` header was
  served (DNS rebinding) and `npm run dev` listened on all interfaces. The Desk
  now binds `127.0.0.1`, answers only for loopback hosts, requires same-origin
  JSON for state-changing calls, and can be shared only with
  `ZERODAY_UI_TOKEN` + `ZERODAY_UI_ALLOWED_HOSTS`. `/api/settings` stores known
  fields only; anti-framing headers added.

### Added
- **`zeroday antares up | down | status`:** Antares-1B on a RunPod Secure GPU
  in one command with your `RUNPOD_API_KEY` + `HF_TOKEN` (never saved) —
  confirms first, installs `cisco-antares-cli` if missing, waits until the
  model answers, saves the endpoint for `--live` / scan / the Desk, and a
  detached watchdog deletes the pod at `--max-minutes` (default 30).
- **`zeroday scan --repo <path>`:** scan for anything, no CWE — rules run all
  10 CWEs; with Antares available, `antares plan` picks the CWEs that fit the
  repository and `antares sweep` investigates them with the rules findings as
  context. One ranked list (both / Antares only / rules only), per-CWE table,
  SARIF, report.md, verifiable evidence.
- **Antares benchmark on real advisories** ([`docs/antares-benchmark.md`](./docs/antares-benchmark.md)):
  36 recent GitHub-reviewed advisories across 12 CWEs (4 the rules cannot
  model), vulnerable commit = fix parent, ground truth = fixed files; arms
  rules / Antares alone / Antares + ZERODAY context (`npm run bench:antares`).
- **Antares with no setup:** `locate --live` without `--endpoint` finds the
  Desk's saved endpoint (last good Antares first) or a local vLLM / Ollama /
  LM Studio serving an Antares model (loopback, `GET /v1/models` only), and the
  Desk's Live brain does the same when nothing is saved.
- **Hybrid Antares runs:** ZERODAY's static pass (dependency verdict,
  vulnerable functions, rules candidates) is passed to Antares via the official
  `antares query --query`; results mark files both flagged (`sources`,
  `summary.hybrid`), list rules candidates Antares did not confirm, and live
  CVE / GHSA runs now show the dependency verdict. Sending the static pass to
  Antares as context (`--context`) is opt-in: on the benchmark it did not help.
- **`--samples N`** runs Antares N times and merges files by vote
  (`summary.samples`); on the benchmark 2 runs lifted top-3 hits from 32% to 47%.
- CWE-502 / CWE-94 rules for ML model loading: `torch.load` without
  `weights_only=True`, `numpy.load(allow_pickle=True)`, joblib /
  `pandas.read_pickle`, Keras `load_model(safe_mode=False)`, Hugging Face
  `from_pretrained` / `pipeline` with `trust_remote_code=True`.
- Desk results show each finding's line, code excerpt and reason, and CVE / GHSA
  scans show the dependency verdict with the version to upgrade to.
- [`docs/demo.md`](./docs/demo.md): 3-minute demo script;
  `scripts/desk-ui-advisory-demo.mjs` rehearses the browser part.

### Changed
- Findings in tests, specs, fixtures and vendored / minified code rank after
  application code (still reported).
- `zeroday scan` merges 2 Antares sweeps by default (`--samples`).
- README rewritten for a first-time reader; trust / reproducibility material
  (Prove doors, DIPTYCH, live Antares in depth) moved to
  [`docs/trust.md`](./docs/trust.md). Desk labels in plain language
  (*Verify it yourself*, *Demo data*).

### Fixed
- PR comments and SARIF rule text said "Antares localization" for runs where no
  model was involved (rules / ingest / recording).
- Advisory matching no longer reports a fix commit's regression test
  (`test_…`) as the vulnerable function.

## 0.9.0

### Added
- **Advisory matching** — `locate --rules --cve / --ghsa` answers *"which files
  matter for this advisory?"*: public OSV advisory data (only the id is sent;
  cached; nothing fetched with `--offline`) → pinned versions from lockfiles
  (npm / yarn / pnpm, requirements / Poetry / Pipfile / uv, go.mod incl. the Go
  toolchain, Maven incl. `${properties}` / Gradle) → verdict *affected /
  possibly affected / not affected / not used* with the version to upgrade to →
  calls to the vulnerable functions (from OSV Go symbols, the fix commit, or the
  advisory text) ranked above imports and the lockfile line. CLI **Exposure**
  block, `report.md` *Dependency exposure* table, `summary.advisoryMatch`.
- **Cross-file tracking** — request input passed to a function imported from
  another file is followed into it (JS/TS relative imports, Python module
  imports, Go packages, Java classes); the finding lands in the right file and
  names the origin (*Request input from routes/users.js line 2 …*).
- **Baseline and diff mode** — stable finding fingerprints; `--baseline
  <report.json>` marks findings new / unchanged (SARIF `baselineState`) and
  `--fail-on-findings` then counts only new ones; `--changed-since <ref>` keeps
  findings in files changed since the merge base.
- **The GitHub Action works from any repository**
  (`uses: pandeyaby/ZERODAY/.github/actions/zeroday-locate-gate@v0.9.0`): it runs
  its own ZERODAY (the published `zeroday-cli` for release tags), scans the
  caller's workspace, and adds `advisory`, `baseline`, `changed-since` and
  `offline` inputs plus a `new-finding-count` output. Guide:
  [`docs/github-action.md`](./docs/github-action.md).
- CWE-611: libxml2 `NOENT` / `DTDLOAD` flags are a configuration candidate.

### Changed
- `locate --rules --cve` no longer fails for CVEs outside the bundled map: the
  CWE comes from OSV, and dependency matching runs even when the CWE has no code
  rules (instead of *NOT SCANNED*).
- SARIF `partialFingerprints.primaryLocationLineHash` is now the stable
  fingerprint (was CWE + file + rank). **Existing Code Scanning alerts from
  ZERODAY are re-keyed once** on the first 0.9 upload.
- Action: `run-unit-tests` now defaults to `false` (it runs ZERODAY's own test
  suite); `working-directory` is deprecated and ignored for the CLI location.

## 0.8.0

### Added
- **Code-aware rules engine** for `locate --rules`: JavaScript / TypeScript, Python,
  Java and Go are parsed with tree-sitter (bundled WASM grammars in `grammars/`,
  no native build) and request input is traced to dangerous calls through
  assignments, string building, branches (with constant folding), switch / match,
  loops, collections and same-file helper functions. Validation guards with an
  early exit and per-CWE sanitizers (HTML escaping protects HTML output, not SQL)
  are understood.
- **10 CWEs** in rules mode (was 3): 89 SQL injection, 79 XSS, 22 path traversal,
  78 OS command injection, 94 code injection, 502 unsafe deserialization,
  918 SSRF, 611 XXE, 798 hard-coded credentials, 601 open redirect.
- Evidence notes name where the input came from: *Request input from line 3
  (`req.query.name`) reaches this call.* Request-input findings (score 92) rank
  above dynamically built values (~72) and dangerous-API use (60).
- **`npm run bench`** and [`docs/benchmark.md`](./docs/benchmark.md): precision /
  recall on OWASP Benchmark Java and Python (downloaded on demand, not
  redistributed) and a maintainer-written JS/TS + Go corpus (`bench/corpus`).
  High-confidence scores: Java 57.7, Python 53.7. CI fails if the corpus score
  drops below 95.

### Changed
- CWE-89 / 79 / 22 findings in JS/TS, Python, Java and Go now come from the new
  engine (different titles and scores); Ruby, PHP and C# keep the line heuristics.
- `runRulesLocalization()` is now async.
- npm package `zeroday-cli` adds the `web-tree-sitter` dependency (pure WASM).

## 0.7.0

### Breaking
- `locate --rules` with a CWE that has no rules (anything but CWE-89 / CWE-79 /
  CWE-22) now prints **NOT SCANNED** and exits `2` instead of reporting
  `0 findings`. `report.json` / SARIF carry `summary.unsupportedCwe: true`.

### Added
- **npm package `zeroday-cli`**: `npx zeroday-cli <command>` or
  `npm i -g zeroday-cli` → `zeroday`. CLI-only (commander + tsx), no Next.js.
- **Docker image on GHCR** (`ghcr.io/pandeyaby/zeroday`) published on version tags.
- **Stability contract** ([`docs/stability.md`](./docs/stability.md)): stable
  core commands `mvp`, `locate`, `verify`, `operate`, `doctor`; output files;
  exit codes. `zeroday --help` groups core vs experimental commands.
- Release workflow (`.github/workflows/release.yml`) and a CI `quality` job:
  typecheck, lint, Next.js build, Docker build, npm pack + install smoke test.

### Fixed
- `npm run build` and `docker build` failed (TypeScript import extensions,
  missing `public/`).
- CWE-22 rules flagged every `require('../x')` / `import … from '../x'`; they now
  skip module loading and only count `../` inside filesystem calls. Also catches
  `path.resolve(…req…)` and `readFileSync(a + b)`.
- One version everywhere: CLI `--version`, SARIF `tool.driver.version`, inventory
  SARIF and `/api/health` all read `package.json` (were 0.6.0 / 0.3.0 / 0.5.0).

### Changed
- README leads with what ZERODAY does, a keyless "scan your own repo" path,
  coverage, outputs and exit codes; trust / reproducibility material moved to
  "Verify it yourself".
- Example ownership output uses a placeholder maintainer identity.

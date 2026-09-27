# Changelog

All notable changes to ZERODAY. The stable surface is defined in
[`docs/stability.md`](./docs/stability.md).

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

# Changelog

All notable changes to ZERODAY. The stable surface is defined in
[`docs/stability.md`](./docs/stability.md).

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

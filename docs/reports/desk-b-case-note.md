# ZERODAY Desk B — inventory case note

> Fixture/static defensive inventory. Localization + evidence only. **No PoC / exploit / payload.** Secret *values* redacted; patterns/names only. Source never leaves the machine on this path.

| | |
|--|--|
| Generated | 2026-09-13T21:32:22.681Z |
| Repos scanned | **6** |
| Skipped | `EternalEcho` (parked — skip this desk pass); `snipercore-external` (optional path missing: <repo>/SniperCore) |
| Findings | **29** (excl. raw surfaces) |
| Config hotspots | 52 |
| Posture | inventory only · needs human · no auto-merge |

## Repos

| Id | Files | Languages | Hotspots | Findings |
|----|------:|-----------|---------:|---------:|
| `webuzz` | 5 | Dockerfile, JavaScript, YAML | 4 | 6 |
| `galileo` | 7 | YAML, Dockerfile, Python | 6 | 4 |
| `aomb` | 5 | TypeScript | 4 | 3 |
| `cosmic-fusion` | 5 | Rust, YAML | 4 | 0 |
| `zeroday` | 254 | TypeScript, JSON, YAML | 32 | 16 |
| `snipercore` | 2 | YAML | 2 | 0 |

## Findings list (stranger-readable)

| Severity | Kind | Repo | Path | Pattern |
|----------|------|------|------|---------|
| note | `env_example_honesty` | `webuzz` | `.env.example` | `—` |
| note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `GITHUB_TOKEN` |
| note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `NPM_TOKEN` |
| note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` |
| note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `secrets.NPM_TOKEN` |
| warning | `dependency_harness` | `webuzz` | `package.json` | `scripts.postinstall` |
| note | `env_example_honesty` | `galileo` | `.env.example` | `—` |
| note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `HF_TOKEN` |
| note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` |
| note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `secrets.HF_TOKEN` |
| note | `agent_harness` | `aomb` | `AGENTS.md` | `remote-fetch-hint` |
| note | `agent_harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` |
| note | `agent_harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` |
| note | `env_example_honesty` | `zeroday` | `.env.example` | `—` |
| note | `ci_secret_pattern` | `zeroday` | `docker-compose.yml` | `ANTHROPIC_API_KEY` |
| note | `ci_secret_pattern` | `zeroday` | `docker-compose.yml` | `OPENAI_API_KEY` |
| note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/AGENTS.md` | `remote-fetch-hint` |
| note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` |
| note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` |
| note | `env_example_honesty` | `zeroday` | `fixtures/inventory/desk-b/galileo/.env.example` | `—` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HF_TOKEN` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `secrets.HF_TOKEN` |
| note | `env_example_honesty` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.env.example` | `—` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `GITHUB_TOKEN` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `NPM_TOKEN` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` |
| note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.NPM_TOKEN` |
| warning | `dependency_harness` | `zeroday` | `fixtures/inventory/desk-b/webuzz/package.json` | `scripts.postinstall` |

## Locate hints

- **`webuzz`:** `.github/workflows/ci.yml`, `Dockerfile`, `package.json`, `.env.example`, `src/app.js`
- **`galileo`:** `.github/workflows/lint.yml`, `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `requirements.txt`
- **`aomb`:** `.cursor/rules/ops.mdc`, `AGENTS.md`, `skills/ops-skill/SKILL.md`, `package.json`, `src/index.ts`
- **`cosmic-fusion`:** `compose.yaml`, `AGENTS.md`, `skills/merge-skill/SKILL.md`, `package.json`, `src/lib.rs`
- **`zeroday`:** `.github/workflows/zeroday-locate.yml`, `.github/actions/zeroday-locate-gate/action.yml`, `Dockerfile`, `fixtures/inventory/desk-b/galileo/Dockerfile`, `fixtures/inventory/desk-b/webuzz/Dockerfile`
- **`snipercore`:** `.github/workflows/ci.yml`, `package.json`

## Hard limits

- Inventory / localization / evidence / harden notes only
- No PoC, exploit, payload, or attack procedure
- No live Antares / RunPod spend on this desk
- Never exfiltrate source; redact secrets in exports
- `npm run mvp` remains the stranger door

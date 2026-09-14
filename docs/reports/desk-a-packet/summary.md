# ZERODAY Desk A — security packet

> Offline security packet for sharing localization findings with a security team. **Generate only — no auto-post** to Slack / GitHub / email. Localization + evidence + harden notes only. **No PoC / exploit / payload.** Secret *values* redacted; patterns/names only.

| | |
|--|--|
| Generated | 2026-09-14T00:55:44.984Z |
| Schema | `zeroday-security-packet/v1` |
| Desk | **A** (security packet) |
| Findings | **29** |
| Labels | agent-misfire **6** · config **21** · dependency **2** · unknown **0** |
| Posture | localize + evidence + harden · needs human · no auto-merge · no auto-send |

## Source (Desk B inventory — not reinvented)

| Artifact | Path |
|----------|------|
| Reports dir | `docs/reports` |
| Inventory JSON | `desk-b-inventory.json` |
| Case note | `desk-b-case-note.md` |
| SARIF | `desk-b-inventory.sarif` |

## Classification (evidence-backed only)

Labels are assigned **only** when inventory finding kind maps clearly. Otherwise `unknown` — **no guessing**.

| Label | When |
|-------|------|
| `agent-misfire` | Inventory `agent_harness` (agent/skill exec or fetch hint) |
| `config` | Inventory `ci_secret_pattern` or `env_example_honesty` |
| `dependency` | Inventory `dependency_harness` |
| `unknown` | No evidence-backed mapping |

## Findings list

| Classification | Severity | Kind | Repo | Path | Pattern |
|----------------|----------|------|------|------|---------|
| `agent-misfire` | note | `agent_harness` | `aomb` | `AGENTS.md` | `remote-fetch-hint` |
| `agent-misfire` | note | `agent_harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` |
| `agent-misfire` | note | `agent_harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` |
| `agent-misfire` | note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/AGENTS.md` | `remote-fetch-hint` |
| `agent-misfire` | note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` |
| `agent-misfire` | note | `agent_harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` |
| `config` | note | `env_example_honesty` | `galileo` | `.env.example` | `—` |
| `config` | note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `HF_TOKEN` |
| `config` | note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `galileo` | `.github/workflows/lint.yml` | `secrets.HF_TOKEN` |
| `config` | note | `env_example_honesty` | `webuzz` | `.env.example` | `—` |
| `config` | note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `GITHUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `NPM_TOKEN` |
| `config` | note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `webuzz` | `.github/workflows/ci.yml` | `secrets.NPM_TOKEN` |
| `config` | note | `env_example_honesty` | `zeroday` | `.env.example` | `—` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `docker-compose.yml` | `ANTHROPIC_API_KEY` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `docker-compose.yml` | `OPENAI_API_KEY` |
| `config` | note | `env_example_honesty` | `zeroday` | `fixtures/inventory/desk-b/galileo/.env.example` | `—` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HF_TOKEN` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `secrets.HF_TOKEN` |
| `config` | note | `env_example_honesty` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.env.example` | `—` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `GITHUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `NPM_TOKEN` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` |
| `config` | note | `ci_secret_pattern` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.NPM_TOKEN` |
| `dependency` | warning | `dependency_harness` | `webuzz` | `package.json` | `scripts.postinstall` |
| `dependency` | warning | `dependency_harness` | `zeroday` | `fixtures/inventory/desk-b/webuzz/package.json` | `scripts.postinstall` |

## Placeholders (fill before sharing)

| Field | Value |
|-------|-------|
| Module / product link | _TBD — fill before sharing_ |
| PR link | _TBD — fill before sharing_ |
| Ticket link | _TBD — fill before sharing_ |

## Next human action

1. Review each finding label; change `unknown` only with new evidence.
2. Fill module / PR / ticket placeholders before sending to security.
3. Share the packet directory (or zip) **manually** — ZERODAY does not auto-send.
4. Treat as localization evidence, not exploitability proof. Never auto-merge.

## Hard limits

- Localization + evidence + harden notes only
- No PoC / exploit / payload (localization only — not exploitability proof)
- No Slack / GitHub / email auto-post
- No live Antares / RunPod spend on this desk
- Never exfiltrate source; redact secrets in exports
- `npm run mvp` remains the stranger door

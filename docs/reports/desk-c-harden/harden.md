# ZERODAY Desk C — agent/package harden

> Recommend-only hardening from Desk B inventory + Desk A packet evidence. **No auto-apply · no auto-PR · no auto-merge.** Localization + evidence + harden notes only. **No PoC / exploit / payload.** Secret *values* redacted; patterns/names only.

| | |
|--|--|
| Generated | 2026-09-14T03:22:27.030Z |
| Schema | `zeroday-harden-recommendations/v1` |
| Desk | **C** (agent/package harden) |
| Recommendations | **81** |
| Categories | agent-harness **6** · package-scripts **2** · secrets-hygiene **21** · config-surface **52** |
| Draft notes | none (default recommend-only) |
| Posture | recommendations only · needs human · no auto-apply · no auto-PR · no auto-merge |

## Source (Desk B / Desk A — not re-scanned)

| Artifact | Path |
|----------|------|
| Reports dir | `docs/reports` |
| Inventory JSON | `desk-b-inventory.json` |
| Packet JSON | `—` |
| Findings JSON | `—` |
| Case note | `desk-b-case-note.md` |
| SARIF | `desk-b-inventory.sarif` |

## Categories (evidence-backed only)

Recommendations are emitted **only** when inventory/packet finding kinds map clearly. Unmapped kinds are skipped — **no guessing**.

| Category | Evidence kinds |
|----------|----------------|
| `agent-harness` | `agent_harness` |
| `package-scripts` | `dependency_harness` (install/lifecycle scripts) |
| `secrets-hygiene` | `ci_secret_pattern` · `env_example_honesty` |
| `config-surface` | `config_surface` (already localized) |

## Recommendations

| Priority | Category | Repo | Path | Pattern | Title |
|----------|----------|------|------|---------|-------|
| high | `agent-harness` | `aomb` | `AGENTS.md` | `remote-fetch-hint` | Harden agent/skill harness (`remote-fetch-hint`) at `AGENTS.md` |
| high | `agent-harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` | Harden agent/skill harness (`code-exec-hint`) at `skills/ops-skill/SKILL.md` |
| high | `agent-harness` | `aomb` | `skills/ops-skill/SKILL.md` | `code-exec-hint` | Harden agent/skill harness (`code-exec-hint`) at `skills/ops-skill/SKILL.md` |
| high | `agent-harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/AGENTS.md` | `remote-fetch-hint` | Harden agent/skill harness (`remote-fetch-hint`) at `fixtures/inventory/desk-b/aomb/AGENTS.md` |
| high | `agent-harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` | Harden agent/skill harness (`code-exec-hint`) at `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` |
| high | `agent-harness` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `code-exec-hint` | Harden agent/skill harness (`code-exec-hint`) at `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` |
| high | `package-scripts` | `webuzz` | `package.json` | `scripts.postinstall` | Review package script harness `scripts.postinstall` in `package.json` |
| high | `package-scripts` | `zeroday` | `fixtures/inventory/desk-b/webuzz/package.json` | `scripts.postinstall` | Review package script harness `scripts.postinstall` in `fixtures/inventory/desk-b/webuzz/package.json` |
| medium | `secrets-hygiene` | `galileo` | `.github/workflows/lint.yml` | `HF_TOKEN` | Secrets hygiene for CI pattern `HF_TOKEN` in `.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `galileo` | `.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` | Secrets hygiene for CI pattern `HUGGING_FACE_HUB_TOKEN` in `.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `galileo` | `.github/workflows/lint.yml` | `secrets.HF_TOKEN` | Secrets hygiene for CI pattern `secrets.HF_TOKEN` in `.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `webuzz` | `.github/workflows/ci.yml` | `GITHUB_TOKEN` | Secrets hygiene for CI pattern `GITHUB_TOKEN` in `.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `webuzz` | `.github/workflows/ci.yml` | `NPM_TOKEN` | Secrets hygiene for CI pattern `NPM_TOKEN` in `.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `webuzz` | `.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` | Secrets hygiene for CI pattern `secrets.GITHUB_TOKEN` in `.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `webuzz` | `.github/workflows/ci.yml` | `secrets.NPM_TOKEN` | Secrets hygiene for CI pattern `secrets.NPM_TOKEN` in `.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `zeroday` | `docker-compose.yml` | `ANTHROPIC_API_KEY` | Secrets hygiene for CI pattern `ANTHROPIC_API_KEY` in `docker-compose.yml` |
| medium | `secrets-hygiene` | `zeroday` | `docker-compose.yml` | `OPENAI_API_KEY` | Secrets hygiene for CI pattern `OPENAI_API_KEY` in `docker-compose.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HF_TOKEN` | Secrets hygiene for CI pattern `HF_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `HUGGING_FACE_HUB_TOKEN` | Secrets hygiene for CI pattern `HUGGING_FACE_HUB_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` | `secrets.HF_TOKEN` | Secrets hygiene for CI pattern `secrets.HF_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `GITHUB_TOKEN` | Secrets hygiene for CI pattern `GITHUB_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `NPM_TOKEN` | Secrets hygiene for CI pattern `NPM_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.GITHUB_TOKEN` | Secrets hygiene for CI pattern `secrets.GITHUB_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` |
| medium | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` | `secrets.NPM_TOKEN` | Secrets hygiene for CI pattern `secrets.NPM_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml` |
| low | `config-surface` | `aomb` | `.cursor/rules/ops.mdc` | `agent_config` | Track config surface `agent_config` at `.cursor/rules/ops.mdc` |
| low | `config-surface` | `aomb` | `AGENTS.md` | `agent_config` | Track config surface `agent_config` at `AGENTS.md` |
| low | `config-surface` | `aomb` | `package.json` | `package_manifest` | Track config surface `package_manifest` at `package.json` |
| low | `config-surface` | `aomb` | `skills/ops-skill/SKILL.md` | `skill_config` | Track config surface `skill_config` at `skills/ops-skill/SKILL.md` |
| low | `config-surface` | `cosmic-fusion` | `AGENTS.md` | `agent_config` | Track config surface `agent_config` at `AGENTS.md` |
| low | `config-surface` | `cosmic-fusion` | `compose.yaml` | `compose` | Track config surface `compose` at `compose.yaml` |
| low | `config-surface` | `cosmic-fusion` | `package.json` | `package_manifest` | Track config surface `package_manifest` at `package.json` |
| low | `config-surface` | `cosmic-fusion` | `skills/merge-skill/SKILL.md` | `skill_config` | Track config surface `skill_config` at `skills/merge-skill/SKILL.md` |
| low | `config-surface` | `galileo` | `.env.example` | `env_example` | Track config surface `env_example` at `.env.example` |
| low | `config-surface` | `galileo` | `.github/workflows/lint.yml` | `github_actions` | Track config surface `github_actions` at `.github/workflows/lint.yml` |
| low | `config-surface` | `galileo` | `docker-compose.yml` | `compose` | Track config surface `compose` at `docker-compose.yml` |
| low | `config-surface` | `galileo` | `Dockerfile` | `docker` | Track config surface `docker` at `Dockerfile` |
| low | `config-surface` | `galileo` | `pyproject.toml` | `package_manifest` | Track config surface `package_manifest` at `pyproject.toml` |
| low | `config-surface` | `galileo` | `requirements.txt` | `package_manifest` | Track config surface `package_manifest` at `requirements.txt` |
| low | `config-surface` | `snipercore` | `.github/workflows/ci.yml` | `github_actions` | Track config surface `github_actions` at `.github/workflows/ci.yml` |
| low | `config-surface` | `snipercore` | `package.json` | `package_manifest` | Track config surface `package_manifest` at `package.json` |
| low | `config-surface` | `webuzz` | `.env.example` | `env_example` | Track config surface `env_example` at `.env.example` |
| low | `config-surface` | `webuzz` | `.github/workflows/ci.yml` | `github_actions` | Track config surface `github_actions` at `.github/workflows/ci.yml` |
| low | `config-surface` | `webuzz` | `Dockerfile` | `docker` | Track config surface `docker` at `Dockerfile` |
| low | `config-surface` | `webuzz` | `package.json` | `package_manifest` | Track config surface `package_manifest` at `package.json` |
| low | `config-surface` | `zeroday` | `.cursor/rules/zeroday-operator.mdc` | `agent_config` | Track config surface `agent_config` at `.cursor/rules/zeroday-operator.mdc` |
| low | `config-surface` | `zeroday` | `.env.example` | `env_example` | Track config surface `env_example` at `.env.example` |
| low | `config-surface` | `zeroday` | `.github/actions/zeroday-locate-gate/action.yml` | `github_actions` | Track config surface `github_actions` at `.github/actions/zeroday-locate-gate/action.yml` |
| low | `config-surface` | `zeroday` | `.github/workflows/zeroday-locate.yml` | `github_actions` | Track config surface `github_actions` at `.github/workflows/zeroday-locate.yml` |
| low | `config-surface` | `zeroday` | `AGENTS.md` | `agent_config` | Track config surface `agent_config` at `AGENTS.md` |
| low | `config-surface` | `zeroday` | `docker-compose.yml` | `compose` | Track config surface `compose` at `docker-compose.yml` |
| low | `config-surface` | `zeroday` | `Dockerfile` | `docker` | Track config surface `docker` at `Dockerfile` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/aomb/AGENTS.md` | `agent_config` | Track config surface `agent_config` at `fixtures/inventory/desk-b/aomb/AGENTS.md` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/aomb/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/aomb/package.json` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` | `skill_config` | Track config surface `skill_config` at `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/cosmic-fusion/AGENTS.md` | `agent_config` | Track config surface `agent_config` at `fixtures/inventory/desk-b/cosmic-fusion/AGENTS.md` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/cosmic-fusion/compose.yaml` | `compose` | Track config surface `compose` at `fixtures/inventory/desk-b/cosmic-fusion/compose.yaml` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/cosmic-fusion/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/cosmic-fusion/package.json` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/cosmic-fusion/skills/merge-skill/SKILL.md` | `skill_config` | Track config surface `skill_config` at `fixtures/inventory/desk-b/cosmic-fusion/skills/merge-skill/SKILL.md` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/galileo/.env.example` | `env_example` | Track config surface `env_example` at `fixtures/inventory/desk-b/galileo/.env.example` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/galileo/docker-compose.yml` | `compose` | Track config surface `compose` at `fixtures/inventory/desk-b/galileo/docker-compose.yml` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/galileo/Dockerfile` | `docker` | Track config surface `docker` at `fixtures/inventory/desk-b/galileo/Dockerfile` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/galileo/pyproject.toml` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/galileo/pyproject.toml` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/galileo/requirements.txt` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/galileo/requirements.txt` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/snipercore/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/snipercore/package.json` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.env.example` | `env_example` | Track config surface `env_example` at `fixtures/inventory/desk-b/webuzz/.env.example` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/webuzz/Dockerfile` | `docker` | Track config surface `docker` at `fixtures/inventory/desk-b/webuzz/Dockerfile` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/desk-b/webuzz/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/desk-b/webuzz/package.json` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/sidecar-app/AGENTS.md` | `agent_config` | Track config surface `agent_config` at `fixtures/inventory/sidecar-app/AGENTS.md` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/sidecar-app/docker-compose.yml` | `compose` | Track config surface `compose` at `fixtures/inventory/sidecar-app/docker-compose.yml` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/sidecar-app/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/inventory/sidecar-app/package.json` |
| low | `config-surface` | `zeroday` | `fixtures/inventory/sidecar-app/skills/demo-skill/SKILL.md` | `skill_config` | Track config surface `skill_config` at `fixtures/inventory/sidecar-app/skills/demo-skill/SKILL.md` |
| low | `config-surface` | `zeroday` | `fixtures/locate/demo-app/.github/CODEOWNERS` | `codeowners` | Track config surface `codeowners` at `fixtures/locate/demo-app/.github/CODEOWNERS` |
| low | `config-surface` | `zeroday` | `fixtures/locate/demo-app/Dockerfile` | `docker` | Track config surface `docker` at `fixtures/locate/demo-app/Dockerfile` |
| low | `config-surface` | `zeroday` | `fixtures/locate/demo-app/package.json` | `package_manifest` | Track config surface `package_manifest` at `fixtures/locate/demo-app/package.json` |
| low | `config-surface` | `zeroday` | `package-lock.json` | `package_manifest` | Track config surface `package_manifest` at `package-lock.json` |
| low | `config-surface` | `zeroday` | `package.json` | `package_manifest` | Track config surface `package_manifest` at `package.json` |
| low | `secrets-hygiene` | `galileo` | `.env.example` | `—` | Keep `.env.example` examples as placeholders only |
| low | `secrets-hygiene` | `webuzz` | `.env.example` | `—` | Keep `.env.example` examples as placeholders only |
| low | `secrets-hygiene` | `zeroday` | `.env.example` | `—` | Keep `.env.example` examples as placeholders only |
| low | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/galileo/.env.example` | `—` | Keep `fixtures/inventory/desk-b/galileo/.env.example` examples as placeholders only |
| low | `secrets-hygiene` | `zeroday` | `fixtures/inventory/desk-b/webuzz/.env.example` | `—` | Keep `fixtures/inventory/desk-b/webuzz/.env.example` examples as placeholders only |

### Detail (top priorities)

#### Harden agent/skill harness (`remote-fetch-hint`) at `AGENTS.md`

- Evidence: `agent-harness:AGENTS.md:remote-fetch-hint:4` · kind `agent_harness`
- Confirm operator allowlist before any live agent run that can fetch remote content. Prefer read-only list/grep/read tools; require an explicit ACK for network/fetch. Do not auto-apply agent config changes.

#### Harden agent/skill harness (`code-exec-hint`) at `skills/ops-skill/SKILL.md`

- Evidence: `agent-harness:skills/ops-skill/SKILL.md:code-exec-hint:3` · kind `agent_harness`
- Gate or remove code-exec patterns from agent/skill configs unless the operator explicitly authorizes them. Prefer sandboxed, allow-listed commands; keep needs_human / no auto-merge posture.

#### Harden agent/skill harness (`code-exec-hint`) at `skills/ops-skill/SKILL.md`

- Evidence: `agent-harness:skills/ops-skill/SKILL.md:code-exec-hint:4` · kind `agent_harness`
- Gate or remove code-exec patterns from agent/skill configs unless the operator explicitly authorizes them. Prefer sandboxed, allow-listed commands; keep needs_human / no auto-merge posture.

#### Harden agent/skill harness (`remote-fetch-hint`) at `fixtures/inventory/desk-b/aomb/AGENTS.md`

- Evidence: `agent-harness:fixtures/inventory/desk-b/aomb/AGENTS.md:remote-fetch-hint:4` · kind `agent_harness`
- Confirm operator allowlist before any live agent run that can fetch remote content. Prefer read-only list/grep/read tools; require an explicit ACK for network/fetch. Do not auto-apply agent config changes.

#### Harden agent/skill harness (`code-exec-hint`) at `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md`

- Evidence: `agent-harness:fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md:code-exec-hint:3` · kind `agent_harness`
- Gate or remove code-exec patterns from agent/skill configs unless the operator explicitly authorizes them. Prefer sandboxed, allow-listed commands; keep needs_human / no auto-merge posture.

#### Harden agent/skill harness (`code-exec-hint`) at `fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md`

- Evidence: `agent-harness:fixtures/inventory/desk-b/aomb/skills/ops-skill/SKILL.md:code-exec-hint:4` · kind `agent_harness`
- Gate or remove code-exec patterns from agent/skill configs unless the operator explicitly authorizes them. Prefer sandboxed, allow-listed commands; keep needs_human / no auto-merge posture.

#### Review package script harness `scripts.postinstall` in `package.json`

- Evidence: `dep-harness:package.json:postinstall` · kind `dependency_harness`
- Human-review install/lifecycle script `scripts.postinstall` in `package.json`. Prefer removing curl|bash / remote-shell patterns; pin dependencies; never auto-enable or auto-merge script changes. Localization only — not exploit confirmation.

#### Review package script harness `scripts.postinstall` in `fixtures/inventory/desk-b/webuzz/package.json`

- Evidence: `dep-harness:fixtures/inventory/desk-b/webuzz/package.json:postinstall` · kind `dependency_harness`
- Human-review install/lifecycle script `scripts.postinstall` in `fixtures/inventory/desk-b/webuzz/package.json`. Prefer removing curl|bash / remote-shell patterns; pin dependencies; never auto-enable or auto-merge script changes. Localization only — not exploit confirmation.

#### Secrets hygiene for CI pattern `HF_TOKEN` in `.github/workflows/lint.yml`

- Evidence: `ci-secret:.github/workflows/lint.yml:HF_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `HF_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `HUGGING_FACE_HUB_TOKEN` in `.github/workflows/lint.yml`

- Evidence: `ci-secret:.github/workflows/lint.yml:HUGGING_FACE_HUB_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `HUGGING_FACE_HUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.HF_TOKEN` in `.github/workflows/lint.yml`

- Evidence: `ci-secret:.github/workflows/lint.yml:secrets.HF_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.HF_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `GITHUB_TOKEN` in `.github/workflows/ci.yml`

- Evidence: `ci-secret:.github/workflows/ci.yml:GITHUB_TOKEN:8` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `GITHUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `NPM_TOKEN` in `.github/workflows/ci.yml`

- Evidence: `ci-secret:.github/workflows/ci.yml:NPM_TOKEN:7` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `NPM_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.GITHUB_TOKEN` in `.github/workflows/ci.yml`

- Evidence: `ci-secret:.github/workflows/ci.yml:secrets.GITHUB_TOKEN:8` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.GITHUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.NPM_TOKEN` in `.github/workflows/ci.yml`

- Evidence: `ci-secret:.github/workflows/ci.yml:secrets.NPM_TOKEN:7` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.NPM_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `ANTHROPIC_API_KEY` in `docker-compose.yml`

- Evidence: `ci-secret:docker-compose.yml:ANTHROPIC_API_KEY:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `ANTHROPIC_API_KEY` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `OPENAI_API_KEY` in `docker-compose.yml`

- Evidence: `ci-secret:docker-compose.yml:OPENAI_API_KEY:11` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `OPENAI_API_KEY` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `HF_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml:HF_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `HF_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `HUGGING_FACE_HUB_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml:HUGGING_FACE_HUB_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `HUGGING_FACE_HUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.HF_TOKEN` in `fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/galileo/.github/workflows/lint.yml:secrets.HF_TOKEN:10` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.HF_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `GITHUB_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml:GITHUB_TOKEN:8` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `GITHUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `NPM_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml:NPM_TOKEN:7` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `NPM_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.GITHUB_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml:secrets.GITHUB_TOKEN:8` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.GITHUB_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

#### Secrets hygiene for CI pattern `secrets.NPM_TOKEN` in `fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml`

- Evidence: `ci-secret:fixtures/inventory/desk-b/webuzz/.github/workflows/ci.yml:secrets.NPM_TOKEN:7` · kind `ci_secret_pattern`
- Confirm least-privilege for secret pattern `secrets.NPM_TOKEN` (name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows do not echo secret values into logs. No auto-apply of workflow edits.

## Hard limits

- Recommendations only by default (`harden.md` + `harden.json`)
- Optional `--draft` notes remain human-gated
- **No** auto-apply · **no** auto-PR · **no** auto-merge
- No PoC / exploit / payload (localization only — not exploitability proof)
- Does not re-scan live private clones unless `--from` points at local paths
- Consumes Desk B + Desk A outputs only
- `npm run mvp` / `inventory` / `packet` unchanged

_Compose with [Project CodeGuard](https://project-codeguard.org/) — do not replace it._

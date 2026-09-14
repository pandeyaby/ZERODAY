---
name: zeroday-defensive-operator
description: Defensive ZERODAY operator habits — inventory → locate → packet → harden → classify. Localization only; no PoC / exploit / attack skills. Generate-only scaffold — human installs manually.
metadata:
  desk: D
  schema: zeroday-craft-scaffold/v1
  posture: defensive-generate-only
---

# zeroday-defensive-operator

> **Defensive localization skill.** Encode Desk B→A→C→E habits. No PoC / exploit / payload. Never write attack procedures. Localization ≠ exploitability. Always `needs_human: true`.

## When to use

Authorized operator assessing a local repo they may access — keyless ZERODAY path. Do **not** use this skill for offensive research, red-team kits, jailbreak packs, or exploit write-ups.

## Habit loop (inventory → locate → packet → harden → classify)

### 1. Inventory (Desk B)

Command cue: `npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json`

- Inventory authorized local repos/config surfaces first (Actions, Docker, manifests, agent/skills). Names/patterns only — never secret values.
- When inventory flags agent/skill harness hints, keep exploration read-only and require human review before any harness change.
- Treat secret *names* and env-example honesty as hygiene surfaces; never export values.
- Track localized config surfaces with CODEOWNERS / review checklists; no auto-PR.
- When inventory flags install/lifecycle scripts, recommend pin/review — never auto-enable remote shell patterns.
- Treat secret *names* and env-example honesty as hygiene surfaces; never export values.

### 2. Locate / operate

Command cue: `npm run zeroday -- operate --cwe CWE-89 --fixture` or `locate --fixture`

- Locate with fixture or keyless operate; localization ≠ exploitability. Read-only list/grep/read inside the snapshot.
- SARIF evidence present — treat as localization candidates for human triage, not exploit proof.

### 3. Packet (Desk A)

Command cue: `npm run zeroday -- packet --from docs/reports`

- Package evidence into an offline security packet for human handoff — generate only, no Slack/GH/email auto-post.
- Packet label `agent-misfire` is evidence-backed only — share offline; never auto-post.
- Packet label `config` is evidence-backed only — share offline; never auto-post.
- Packet label `dependency` is evidence-backed only — share offline; never auto-post.
- Packet label `unknown` is evidence-backed only — share offline; never auto-post.

### 4. Harden (Desk C)

Command cue: `npm run zeroday -- harden --from docs/reports`

- Emit agent/package harden recommendations only — no auto-apply, no auto-PR, no auto-merge.
- Harden category `agent-harness` → recommend-only notes; human applies changes.
- Harden category `config-surface` → recommend-only notes; human applies changes.
- Harden category `package-scripts` → recommend-only notes; human applies changes.
- Harden category `secrets-hygiene` → recommend-only notes; human applies changes.

### 5. Classify (Desk E)

Command cue: `npm run zeroday -- classify --fixture`

- Classify crashes/incidents with evidence; ambiguous → needs_human. Classification ≠ exploitability; no auto-remediate.
- Prefer `needs_human` when signals are ambiguous — never invent breach.

## Allowed tools

- list / grep / read inside the authorized snapshot or repo only
- write `submission.json` / craft scaffolds when the operator asks

## Forbidden

- No PoC / exploit / payload; no attack procedures; no network scans; no credential theft
- Auto-merge, auto-apply harden, auto-post packet, auto-remediate classify
- Auto-install this skill into Cursor / Grok Bot or marketplace publish
- Offensive / red-team / jailbreak skill patterns

## Hard limits

- Generate-only scaffold — human copies files if they want them installed
- Secrets: names/patterns only; values never exported
- `npm run mvp` / `inventory` / `packet` / `harden` / `classify` remain unchanged by craft

_Source patterns: `docs/reports` · generated 2026-09-14T05:42:06.372Z_

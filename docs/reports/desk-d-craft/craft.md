# ZERODAY Desk D — defensive plugins/skills craft

> Generate-only Cursor/Grok-style `SKILL.md` + plugin stub from Desk B→A→C→E patterns. **No auto-install · no marketplace publish.** Refuses exploits, PoCs, and offensive skill patterns. Localization habits only.

| | |
|--|--|
| Generated | 2026-09-14T05:42:06.372Z |
| Schema | `zeroday-craft-scaffold/v1` |
| Desk | **D** (defensive plugins/skills craft) |
| Name | `zeroday-defensive-operator` |
| Kind | `both` |
| Patterns | **20** |
| Scaffolds | **3** |
| Posture | generate-only · no auto-install · no marketplace · refuses offensive · needs human |

## Source (Desk B→A→C→E — not re-scanned)

| Artifact | Path |
|----------|------|
| Reports dir | `docs/reports` |
| Inventory JSON | `desk-b-inventory.json` |
| Packet JSON | `packet.json` |
| Harden JSON | `harden.json` |
| Classify JSON | `classify.json` |
| Findings JSON | `findings.json` |
| Case note | `desk-b-case-note.md` |
| SARIF | `desk-b-inventory.sarif` |
| SARIF | `desk-b-inventory.sarif` |

## Habit stages encoded

`inventory` → `locate` → `packet` → `harden` → `classify`

| Stage | Pattern signals |
|-------|-----------------|
| `inventory` | **6** |
| `locate` | **2** |
| `packet` | **5** |
| `harden` | **5** |
| `classify` | **2** |

## Scaffolds

| Kind | Name | Path |
|------|------|------|
| `skill` | `zeroday-defensive-operator` | [`skills/zeroday-defensive-operator/SKILL.md`](skills/zeroday-defensive-operator/SKILL.md) |
| `plugin` | `zeroday-defensive-operator` | [`plugins/zeroday-defensive-operator/plugin.json`](plugins/zeroday-defensive-operator/plugin.json) |
| `plugin` | `zeroday-defensive-operator` | [`plugins/zeroday-defensive-operator/README.md`](plugins/zeroday-defensive-operator/README.md) |

## Pattern cues (sample)

- **inventory** — Inventory authorized local repos/config surfaces first (Actions, Docker, manifests, agent/skills). Names/patterns only — never secret values.
- **inventory** — When inventory flags agent/skill harness hints, keep exploration read-only and require human review before any harness change.
- **inventory** — Treat secret *names* and env-example honesty as hygiene surfaces; never export values.
- **inventory** — Track localized config surfaces with CODEOWNERS / review checklists; no auto-PR.
- **inventory** — When inventory flags install/lifecycle scripts, recommend pin/review — never auto-enable remote shell patterns.
- **inventory** — Treat secret *names* and env-example honesty as hygiene surfaces; never export values.
- **locate** — Locate with fixture or keyless operate; localization ≠ exploitability. Read-only list/grep/read inside the snapshot.
- **locate** — SARIF evidence present — treat as localization candidates for human triage, not exploit proof.
- **packet** — Package evidence into an offline security packet for human handoff — generate only, no Slack/GH/email auto-post.
- **packet** — Packet label `agent-misfire` is evidence-backed only — share offline; never auto-post.
- **packet** — Packet label `config` is evidence-backed only — share offline; never auto-post.
- **packet** — Packet label `dependency` is evidence-backed only — share offline; never auto-post.
- **packet** — Packet label `unknown` is evidence-backed only — share offline; never auto-post.
- **harden** — Emit agent/package harden recommendations only — no auto-apply, no auto-PR, no auto-merge.
- **harden** — Harden category `agent-harness` → recommend-only notes; human applies changes.
- **harden** — Harden category `config-surface` → recommend-only notes; human applies changes.
- _…and 4 more (see craft.json)._

## Hard limits

- Generate-only (`craft.md` + `craft.json` + skill/plugin files)
- **No** auto-install into Cursor / Grok Bot
- **No** marketplace publish
- Refuses exploits, PoCs, and offensive skill patterns
- No PoC / exploit / payload (localization only)
- Consumes Desk B→A→C→E reports; does not re-scan private clones
- `npm run mvp` / `inventory` / `packet` / `harden` / `classify` unchanged

# Desk reports (fixture / static)

## DIPTYCH sample grade (design-partner door)

Checked-in **sample / illustrative** DIPTYCH-shaped grade report regenerated from
local `paired-probe` emit envelopes (no DIPTYCH clone, no GPU):

```bash
npm run paired-probe
npm run paired-probe:sample-report
```

| File | Role |
|------|------|
| [`diptych-sample-grade.md`](./diptych-sample-grade.md) | Human-readable sample grade (FREEZEDRY…VARSCALE all-green story) |
| [`diptych-sample-grade.json`](./diptych-sample-grade.json) | Machine-readable mirror (`zeroday.diptych_sample_grade/v1`) |

**Posture:** sample ≠ live DIPTYCH harness run · greens = hyperproperty adapter
cells · localization ≠ exploitability · DIPTYCH grades · ZeroDay emits · no PoC /
AUROC theater. Details: [`docs/paired-probes.md`](../paired-probes.md).

## Desk B — inventory

Checked-in **redacted** inventory artifacts from:

```bash
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json
```

| File | Role |
|------|------|
| `desk-b-case-note.md` | Human case note + findings list |
| `desk-b-inventory.json` | Slim multi-repo inventory (paths sanitized) |
| `desk-b-inventory.sarif` | SARIF 2.1.0 inventory evidence (secret names only) |

**Posture:** localization + evidence only · no PoC · no live Antares/RunPod · secret *values* never exported · `npm run mvp` remains the stranger door.

EternalEcho is parked (`skip`). SniperCore is optional (present as fixture; external path skipped if missing).

## Desk A — security packet

Offline packet for sharing Desk B findings with a security team (**generate only — no auto-post**):

```bash
npm run zeroday -- packet --from docs/reports
# or: npm run zeroday -- packet --fixture --output zeroday-reports/security-packet
```

Checked-in sample: [`desk-a-packet/`](./desk-a-packet/) (`summary.md`, `findings.json`, SARIF copy, placeholders for module/PR/ticket links).

| Label | Evidence |
|-------|----------|
| `agent-misfire` | Inventory `agent_harness` |
| `config` | `ci_secret_pattern` / `env_example_honesty` |
| `dependency` | `dependency_harness` |
| `unknown` | No evidence-backed mapping (no guessing) |

**Posture:** localize + evidence + harden · secrets redacted · no Slack/GH/email auto-send · no PoC.

## Desk C — agent/package harden

Recommend-only hardening from Desk B inventory + Desk A packet evidence (**no auto-apply / auto-PR / auto-merge**):

```bash
npm run zeroday -- harden --from docs/reports
# or Desk A packet:
npm run zeroday -- harden --from docs/reports/desk-a-packet
# optional CodeGuard-aligned draft notes (still human-gated):
npm run zeroday -- harden --from docs/reports --draft
```

Checked-in sample: [`desk-c-harden/`](./desk-c-harden/) (`harden.md`, `harden.json`).

| Category | Evidence |
|----------|----------|
| `agent-harness` | Inventory `agent_harness` |
| `package-scripts` | `dependency_harness` |
| `secrets-hygiene` | `ci_secret_pattern` / `env_example_honesty` |
| `config-surface` | `config_surface` (already localized) |

**Posture:** recommendations only · optional `--draft` notes human-gated · secrets redacted · no PoC · `mvp` / `inventory` / `packet` unchanged.

## Desk E — crash classify + evidence

Offline crash/incident classification from locate + optional telemetry fixtures (**human review required — no auto-remediate**):

```bash
npm run zeroday -- classify --from fixtures/classify/software_defect
# or:
npm run zeroday -- classify --fixture
```

Checked-in sample: [`desk-e-classify/`](./desk-e-classify/) (`classify.md`, `classify.json`).

| Label | When |
|-------|------|
| `software_defect` | Locate ranked files; no competing telemetry |
| `possible_breach` | Lateral / east-west telemetry only (fixture input) |
| `infra_failure` | Infra failure telemetry only |
| `agent_misfire` | Agent-session misfire telemetry only (fixture output) |
| `needs_human` | Ambiguous / competing / weak signals (**always preferred over invented breach**) |

**Posture:** classification ≠ exploitability · secrets redacted · no PoC · no auto-remediate · `mvp` / `inventory` / `packet` / `harden` unchanged.

## Desk D — defensive plugins/skills craft (LAST)

Generate-only Cursor/Grok-style `SKILL.md` + plugin stub from Desk B→A→C→E patterns (**no auto-install / marketplace publish**):

```bash
npm run zeroday -- craft --from docs/reports
# aliases:
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

Checked-in sample: [`desk-d-craft/`](./desk-d-craft/) (`craft.md`, `craft.json`, `skills/*/SKILL.md`, `plugins/*/plugin.json`).

| Scaffold | Role |
|----------|------|
| `SKILL.md` | Encodes inventory → locate → packet → harden → classify habits |
| `plugin.json` | Stub manifest — human copies manually if desired |

**Posture:** generate-only · refuses exploits, PoCs, and offensive skill patterns · secrets redacted · `mvp` / `inventory` / `packet` / `harden` / `classify` unchanged.
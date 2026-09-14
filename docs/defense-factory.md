# Localization & Evidence Defense Factory

ZERODAY’s north star is a **Localization & Evidence + Defense Factory** —
inspired by the *shape* of continuous defensive loops (inventory → detect →
route → remediate → verify), composed around **Antares localization** (optional
live) and the keyless `operate` path — not a Cisco product mandate.

## What we mirror (from Defense Factory–style loops)

| Stage | ZERODAY |
|-------|---------|
| Inventory | `zeroday inventory` / `factory inventory` / `factory run` — multi-repo paths + config surfaces (Actions, Docker/compose, manifests, agent/skills) + ranked locate hints |
| Locate | Antares fixture **or** live `/v1/completions` **or** keyless `operate` |
| Classify | Fixture-driven CISO rollup (`classify`) |
| Ownership | CODEOWNERS + blame → review markdown + GitHub comment body |
| Draft fix | CodeGuard-aligned **DRAFT** only after `--i-asked-for-a-fix` |
| Defend | Existing tests / fail-closed checks — **never** exploit repro |
| Verify | Offline SHA-256 evidence vault (`zeroday verify`) |
| Glue | SARIF / ASFF / Splunk / XSOAR / FortiSIEM / CrowdStrike exporters |

## What we refuse (hard limits — forever)

- Exploits, PoCs, payloads, attack procedures, attack-path chaining — even localhost/lab
- Treating localization as proof of exploitability
- Auto-merge of fixes (patch drafts only after explicit human ask)
- Silent remote inference of customer source (requires `--remote-inference` / ACK)
- Offensive framing: kill-chains, stego, jailbreak packs, red-team mission UIs

## Inventory (Desk B — multi-repo + config surfaces)

Keyless, **fixture/static** stage that lists authorized local repos/paths (or
bundled desk-b stand-ins) and **config hotspots** (GitHub Actions, Docker/compose,
package manifests, agent/skill configs), plus:

- CI secret **patterns** (names only — never values)
- `.env.example` honesty (placeholder check)
- Dependency / agent harness risk localization

Emits ranked JSON + markdown + redacted SARIF + case note. Not exploit scanning.

```bash
# Desk B fixture manifest (webuzz / galileo / aomb / cosmic-fusion / zeroday; EternalEcho skipped)
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json \
  --output zeroday-reports/desk-b-inventory

# Checked-in redacted sample reports
# docs/reports/desk-b-case-note.md
# docs/reports/desk-b-inventory.sarif
```

Artifacts: `inventory.json` · `inventory.md` · `inventory.sarif` · `case-note.md`
(and `repos/<id>/` for multi-repo). Compose: **inventory → locate → classify → own → verify**.

Stranger door stays **`npm run mvp`** (fixture → SARIF). Live Antares remains opt-in.

## Security packet (Desk A — offline share)

Packages existing Desk B inventory reports + SARIF into a stranger-readable
folder for **manual** handoff to a security team. Does **not** re-run inventory.
Does **not** auto-post to Slack / GitHub / email.

```bash
# One command — consume checked-in Desk B reports
npm run zeroday -- packet --from docs/reports

# Or after a live inventory run:
npm run zeroday -- packet --from zeroday-reports/desk-b-inventory \
  --output zeroday-reports/security-packet
```

Emits `summary.md` · `findings.json` / `findings.md` · `packet.json` · SARIF copy ·
module/PR/ticket placeholders. Labels (`agent-misfire` / `config` / `dependency` /
`unknown`) only when inventory kind evidence maps — **no guessing**.

Sample: [`docs/reports/desk-a-packet/`](./reports/desk-a-packet/).

## Agent/package harden (Desk C — recommend-only)

Consumes Desk B inventory and/or Desk A packet reports. Emits recommendations
only by default; optional `--draft` writes CodeGuard-aligned **notes** that
remain human-gated. **Never** auto-apply, auto-PR, or auto-merge.

```bash
# One command — consume checked-in Desk B reports
npm run zeroday -- harden --from docs/reports

# Or Desk A packet folder:
npm run zeroday -- harden --from docs/reports/desk-a-packet \
  --output zeroday-reports/harden

# Optional draft notes (still no auto-apply):
npm run zeroday -- harden --from docs/reports --draft
```

Emits `harden.md` · `harden.json` · optional `drafts/*.md`. Categories:
`agent-harness` / `package-scripts` / `secrets-hygiene` / `config-surface`.

Sample: [`docs/reports/desk-c-harden/`](./reports/desk-c-harden/).

## Crash classify + evidence (Desk E)

Reuses fixture-driven classify APIs. One offline command emits `classify.md` +
`classify.json` evidence pack. **Classification ≠ exploitability.** Ambiguous →
`needs_human`. Human review required — no auto-remediate.

```bash
npm run zeroday -- classify --from fixtures/classify/software_defect
npm run zeroday -- classify --fixture
```

Labels: `possible_breach` | `infra_failure` | `software_defect` | `agent_misfire` |
`needs_human`. Secrets redacted. `mvp` / `inventory` / `packet` / `harden` unchanged.

Sample: [`docs/reports/desk-e-classify/`](./reports/desk-e-classify/).

## Defensive plugins/skills craft (Desk D — LAST)

Consumes Desk B→A→C→E reports as pattern input. Emits Cursor/Grok-style
`SKILL.md` + plugin stub encoding **inventory → locate → packet → harden → classify**.
**Generate-only** — no auto-install into Cursor/Grok Bot, no marketplace publish.
**Refuses** exploits, PoCs, and offensive skill patterns.

```bash
npm run zeroday -- craft --from docs/reports
npm run zeroday -- skill --fixture
npm run zeroday -- plugin --fixture
```

Emits `craft.md` · `craft.json` · `skills/*/SKILL.md` · `plugins/*/plugin.json`.
`mvp` / `inventory` / `packet` / `harden` / `classify` unchanged.

Sample: [`docs/reports/desk-d-craft/`](./reports/desk-d-craft/).

## One command (CI-safe factory)

```bash
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend \
  --classify-scenario software_defect \
  --output zeroday-reports/factory-demo
npm run zeroday -- verify --from zeroday-reports/factory-demo
```

Optional human-gated draft:

```bash
npm run zeroday -- factory run --cwe CWE-89 --fixture --i-asked-for-a-fix
```

## Live / RunPod (opt-in)

Mac MPS is **unsupported** for schema-faithful live Antares. Prefer CUDA vLLM
locally or the documented **RunPod Secure A40** path (CUDA ≥ 12.8; prefer over
Community RTX 4090 / CUDA 13):

→ [`runpod-antares.md`](./runpod-antares.md)

```bash
export ZERODAY_INFERENCE_PROVIDER=remote
export ZERODAY_ANTARES_BASE_URL=https://<pod-id>-8000.proxy.runpod.net/v1
export ZERODAY_REMOTE_INFERENCE_ACK=1   # required — may leave the machine
npm run zeroday -- factory run --cwe CWE-89 --no-fixture --live \
  --endpoint "$ZERODAY_ANTARES_BASE_URL" --model fdtn-ai/antares-1b --remote-inference
# After SARIF: stop/terminate the pod — don’t leave RUNNING.
```

CI / GitHub Action stays **fixture-only** — no RunPod, no weights.

## Evidence spine

Each factory run writes under `zeroday-reports/<run>/`:

- `inventory.json` · `inventory.md` · `ownership.md` · `ownership-comment.md`
- `report.json` / `report.sarif` / `comment.md` (locate)
- `classify/` (optional) · `defend.json` (optional) · `drafts/` (human gate)
- `factory.json` · `factory.md` · `evidence/manifest.json` · `verify.json`

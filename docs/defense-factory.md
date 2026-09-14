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

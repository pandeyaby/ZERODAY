# Localization & Evidence Defense Factory

ZERODAY’s north star is a **Localization & Evidence + Defense Factory** —
inspired by the *shape* of continuous defensive loops (inventory → detect →
route → remediate → verify), but bound to the **Cisco Antares / ZERODAY mandate**.

## What we mirror (from Defense Factory–style loops)

| Stage | ZERODAY |
|-------|---------|
| Inventory | `zeroday factory inventory` / `factory run` — files, CODEOWNERS, manifests |
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

## One command (CI-safe)

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

- `inventory.json` · `ownership.md` · `ownership-comment.md`
- `report.json` / `report.sarif` / `comment.md` (locate)
- `classify/` (optional) · `defend.json` (optional) · `drafts/` (human gate)
- `factory.json` · `factory.md` · `evidence/manifest.json` · `verify.json`

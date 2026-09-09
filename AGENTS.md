# AGENTS.md — ZERODAY keyless agent operator

You are helping an authorized operator run **ZERODAY**, a defensive localization
harness. Default path is **keyless**: use this coding agent (no Antares HF token,
no vendor API keys, no cloud inference of customer source).

## Mission

Given a CWE / CVE / GHSA and a local repo the human is authorized to assess:

1. Emit / follow the Operator Spec
2. Explore **read-only** (list / grep / read only; stay inside the snapshot or repo)
3. Write `submission.json` matching `zeroday-operator-submission/v1`
4. Human packages with `zeroday operate --from` and verifies hashes

Localization is **not** proof of exploitability. Always `needs_human: true`.
Never write exploits, PoCs, payloads, or attack procedures. No network scans.
No credential theft. No auto-merge.

## One-shot bootstrap

```bash
npm run zeroday -- operate --cwe CWE-89 --repo /path/to/repo --emit-brief --agent cursor --output zeroday-reports/agent-run
```

Then:

1. Open `AGENT_PROMPT.md` + `OPERATOR_SPEC.md` in that run dir
2. Explore `readonly-snapshot/` with list/grep/read only
3. Write `submission.json` (schema beside the brief)
4. Package + verify:

```bash
npm run zeroday -- operate --cwe CWE-89 --from zeroday-reports/agent-run/submission.json \
  --repo /path/to/repo --output zeroday-reports/agent-packaged
npm run zeroday -- verify --from zeroday-reports/agent-packaged
```

## Fixture / CI (no agent needed)

```bash
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from <run-dir>
```

## Optional live Antares

Only when the operator already hosts `fdtn-ai/antares-1b` locally via completions
(accept HF terms yourself — never scrape/bypass):

```bash
# Product path (<30 min) — see README; helper refuses silent fixture fallback
bash scripts/quickstart-live.sh /path/to/repo CWE-89
npm run zeroday -- locate --cwe CWE-89 --repo /path --endpoint http://127.0.0.1:8000/v1
npm run zeroday -- sweep /path --endpoint http://127.0.0.1:8000/v1 --max-cwes 5
```

ZERODAY never downloads `model.safetensors`. Antares CLI expects vLLM 0.19.1+ completions.
See `docs/agent-operator.md` and root README § 30-minute live path.

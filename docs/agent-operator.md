# Agent operator (keyless)

ZERODAY’s **default** path uses the coding agent already running the tool
(Cursor, Claude Code, etc.). No Antares HF token. No vendor API keys.

## Flow

```
zeroday operate --emit-brief --agent cursor --cwe CWE-89 --repo ./app
        │
        ├─ OPERATOR_SPEC.md
        ├─ operator-brief.json
        ├─ operator-submission.schema.json
        ├─ AGENT_PROMPT.md          ← paste / follow this
        ├─ readonly-snapshot/       ← explore here (read-only)
        └─ submission.json          ← agent writes this

zeroday operate --from submission.json --cwe CWE-89 --repo ./app
        │
        ├─ validate schema + no-exploit invariant
        ├─ report.json / report.md / SARIF / vendor projections
        └─ evidence/manifest.json

zeroday verify --from <run-dir>
```

## CLI cheatsheet

| Command | Purpose |
|---------|---------|
| `operate --fixture` | CI / offline recorded submission |
| `operate --emit-brief` | Brief + schema + durable snapshot (await agent) |
| `operate --agent cursor\|stdout\|claude` | Implies emit-brief; prints one-shot prompt |
| `operate --from submission.json` | Validate + package + vault |
| `verify --from <run-dir>` | Offline hash/schema check |

## Rules for the agent

**Allowed:** list, grep, read inside snapshot/repo only.

**Forbidden:** exploits, PoCs, payloads, attack procedures, network probing,
credential theft, mutating the repo, downloading model weights, claiming
exploitability, auto-merge.

If asked for fix **and** PoC: refuse PoC in one sentence.

## Optional Antares (operator workstation)

```bash
# Completions only — never /v1/chat/completions
vllm serve fdtn-ai/antares-1b   # after accepting HF terms yourself
npm run zeroday -- locate --cwe CWE-89 --repo ./app --endpoint http://127.0.0.1:8000/v1
npm run zeroday -- sweep ./app --endpoint http://127.0.0.1:8000/v1 --max-cwes 5
```

Without `--endpoint`, `zeroday sweep` prints a clear offline message and exits 0.
CI never pulls gated weights.

Sister: [Antares Quickstart](https://github.com/cisco-foundation-ai/cookbook/blob/main/1_quickstarts/Quickstart_Antares.md).

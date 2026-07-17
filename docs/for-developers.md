# For Developers

> Repo layout, extending loadouts, API/CLI, gates, and local persistence.

[Open in app](http://localhost:3333/docs/for-developers)

ZERODAY is a Next.js 15 (App Router) + TypeScript app. Tool execution defaults to simulated safe_local adapters with Plinian gates (auth → scope → mode → evidence).

## Key directories

| Path | Role |
| --- | --- |
| src/app | War Room UI + /docs + API routes |
| src/agents | Operators + mission orchestrator |
| src/arsenal | Tool registry + general adapters |
| src/cisco|splunk|paloalto|fortinet|crowdstrike|aws | Vendor adapters |
| src/loadouts | Loadout registry + brief detection |
| src/evidence | Vault + findings/retest |
| src/stego | Transforms, stego, mutation, PromptCraft |
| src/lib/docs | In-app documentation source of truth |
| cli/ | Headless CLI (tsx) |
| docs/ | Markdown mirrors of guides |

## Mission runtime flow

```text
POST /api/missions (brief)
  → authorize (acknowledged RoE)
  → startMissionRun()
  → phases × operators
  → executeTool() [auth/scope/mode]
  → captureEvidence() [hash + redact]
  → synthesizeFindings()
  → awaiting_retest | completed
```

## Add a vendor loadout

1. Implement tools + runner in src/<vendor>/adapters/index.ts
2. Register VendorLoadout and LOADOUT_ROLE_TOOLS in src/loadouts/registry.ts
3. Import tools/runner in src/arsenal/registry.ts
4. Extend detectLoadoutsFromBrief + inferTargets
5. Add finding synthesis branches in src/agents/orchestrator.ts
6. Optional: seed example mission in src/lib/seed.ts

## Tool modes & spicy paths

- safe_local — default for recon/scan/detect adapters
- receipt_required — SSH exec, RTR, config push, etc. (approve via API action)
- catalog_only — describe only; no execution

## CLI & MCP

```bash
export ZERODAY_URL=http://127.0.0.1:3333
npm run cli -- health
npm run cli -- launch "Assess AWS Security Hub lab account"
curl -s http://127.0.0.1:3333/api/mcp | jq '.server'
```

## Persistence

better-sqlite3 under data/ (ZERODAY_DATA_DIR). Falls back to JSON store if native module fails. serverExternalPackages includes better-sqlite3.

> **Docs maintenance:** Edit src/lib/docs/content.ts then regenerate docs/*.md (or update both). Audience cards read AUDIENCE_DOC_SLUGS.

> **Related:** Architecture Overview · CLI & HTTP API · LLM Providers · Scope & Authorization.

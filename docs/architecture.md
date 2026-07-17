# Architecture Overview

> How the War Room, operators, arsenal, loadouts, and evidence vault fit together.

[Open in app](http://localhost:3333/docs/architecture)

ZERODAY is a self-hosted control plane: a War Room UI drives an orchestrated multi-operator loop that calls gated tool adapters and writes provenance-tracked evidence.

## System diagram

```text
┌─────────────────────────────────────────────────────────┐
│ War Room (Next.js)  ·  Docs  ·  CLI  ·  HTTP/MCP catalog │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │ Mission Orchestrator      │
              │ Coordinator → phases      │
              └─────────────┬─────────────┘
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Operators           Arsenal               LLM
   (8 roles)        (gated tools)         (keyless+
        │                 │                optional)
        └────────┬────────┘
                 ▼
        Evidence Vault (hash/redact)
                 ▼
        Findings Ledger → Retest Queue → Reports
```

## Control plane vs data plane

- Control plane — missions, authorization, operator lifecycle, settings, docs
- Data plane — tool adapters returning structured results into the Evidence Vault
- Policy plane — Plinian Doctrine (scope, auth, evidence, retest) enforced in executeTool()

## Vendor loadouts

Loadouts are first-class capability packs. A mission’s loadouts[] selects doctrine addenda and preferred tools per operator role (LOADOUT_ROLE_TOOLS). Brief text is mapped via detectLoadoutsFromBrief().

| Loadout | Adapter prefix |
| --- | --- |
| cisco | cisco.* |
| splunk | splunk.* |
| paloalto | paloalto.* |
| fortinet | fortinet.* |
| crowdstrike | crowdstrike.* |
| aws | aws.* |

## Evidence provenance

1. Tool returns { summary, data }
2. Payload redacted; SHA-256 hash stored
3. Analyst synthesis creates findings with evidenceIds
4. High/critical auto-enter retest before promotion

## Deployment shapes

- Local: npm run dev → :3333
- Docker Compose: container on :3000 with /data volume
- Headless: CLI against ZERODAY_URL for CI-style mission runs

> **Design priorities:** Safety and auditability beat raw offensive capability. Default is simulated safe_local; spicy actions require receipts.

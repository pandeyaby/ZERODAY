# War Room Guide

> Tabs, keyboard shortcuts, and how to read live mission state.

[Open in app](http://localhost:3333/docs/war-room)

## Tabs

| Tab | Key | Purpose |
| --- | --- | --- |
| How to use | h | Person + org usage guide + fixture playground |
| Missions | 1 | Scope, phases, authorization, start/abort |
| Live Operators | 2 | Operator cell + event stream |
| Evidence Vault | 3 | Hashed, redacted tool outputs |
| Findings Ledger | 4 | Severity, confidence, vendor impact, fixes |
| Retest Queue | 5 | Pass/fail before promoting high/critical |
| Reports | 6 | JSON engagement export |
| Stego & Mutation | 7 | P4RS3LT0NGV3-style lab |
| Settings | 8 | LLM provider / model |
| Docs | 9 | Guides linked in-app |

## Shortcuts

- h — How to use (org guide + fixture playground)
- / — focus mission brief
- a — acknowledge authorization
- s — start mission
- 1–9 — switch tabs (9 opens Docs panel)

## Fixture playground

```bash
npm run war-room
# → http://localhost:3333/play
```

Runs existing fixture paths only (locate CWE-89, classify scenarios, mixed demo). No live network, no weight download.

## Status meanings

- awaiting_authorization — RoE not acknowledged yet
- running — operators executing tools
- awaiting_retest — high/critical findings need human retest
- completed — run finished; promote findings as needed
- aborted / failed — stopped or phase error

# CLI & HTTP API

> Headless/CI parity and integration endpoints.

[Open in app](http://localhost:3333/docs/cli-api)

## CLI

```bash
export ZERODAY_URL=http://127.0.0.1:3333
npm run cli -- health
npm run cli -- missions
npm run cli -- launch "Assess Cisco DNA + Splunk staging"
npm run cli -- authorize <missionId> --by "Lead"
npm run cli -- start <missionId>
npm run cli -- status <missionId>
```

## Main HTTP routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | Health + persistence backend |
| GET/POST | /api/missions | List / create / authorize / start / abort |
| GET | /api/missions/:id | Full mission detail |
| GET | /api/evidence | Evidence vault |
| GET/POST | /api/findings | Findings ledger |
| GET/POST | /api/retest | Retest queue |
| GET/POST | /api/tools | Arsenal catalog + execute |
| GET/POST | /api/stego | Stego lab |
| GET/POST | /api/settings | App / LLM settings |
| GET | /api/mcp | MCP-shaped tool catalog |

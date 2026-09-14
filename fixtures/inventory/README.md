# Inventory fixtures (Desk slice B)

Multi-repo + config-surface fixtures for `zeroday inventory`.

| Path | Role |
|------|------|
| `manifest.json` / `manifest.yaml` | Multi-repo inventory manifest |
| `sidecar-app/` | Second repo (compose, AGENTS.md, skill, Python) |
| `../locate/demo-app` | Primary demo (Actions, Dockerfile, CODEOWNERS) |

```bash
npm run zeroday -- inventory --from fixtures/inventory/manifest.json \
  --output zeroday-reports/inventory-fixture
```

Defensive inventory only — feeds locate; no PoC / exploit scanning.

## Desk B

See [`desk-b/`](./desk-b/) for the GRAX Desk B fixture manifest (webuzz / galileo /
aomb / cosmic-fusion / zeroday; EternalEcho skipped; SniperCore optional).

```bash
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json \
  --output zeroday-reports/desk-b-inventory
```

Redacted sample reports: [`docs/reports/`](../../docs/reports/).

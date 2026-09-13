# Desk B inventory fixtures (static / keyless)

Fixture stand-ins for multi-repo inventory when authorized product checkouts
are not on the machine. **Not** live Antares. **Not** customer source export.

| Id | Role |
|----|------|
| `webuzz` | Web app: Actions secret patterns, Dockerfile, `.env.example`, postinstall harness |
| `galileo` | Python + compose + HF secret pattern |
| `aomb` | Agent/skill config surfaces |
| `cosmic-fusion` | Compose + skills |
| `zeroday` | This repository (path `../../..`) |
| `snipercore` | Optional low-priority fixture |
| `EternalEcho` | Listed under `skip` (parked) |

```bash
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json \
  --output zeroday-reports/desk-b-inventory
```

Hard limits: localize + evidence only · secret *names* not values · no PoC ·
`npm run mvp` remains the stranger door.

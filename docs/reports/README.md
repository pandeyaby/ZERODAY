# Desk B reports (fixture / static)

Checked-in **redacted** inventory artifacts from:

```bash
npm run zeroday -- inventory --from fixtures/inventory/desk-b/manifest.json
```

| File | Role |
|------|------|
| `desk-b-case-note.md` | Human case note + findings list |
| `desk-b-inventory.json` | Slim multi-repo inventory (paths sanitized) |
| `desk-b-inventory.sarif` | SARIF 2.1.0 inventory evidence (secret names only) |

**Posture:** localization + evidence only · no PoC · no live Antares/RunPod · secret *values* never exported · `npm run mvp` remains the stranger door.

EternalEcho is parked (`skip`). SniperCore is optional (present as fixture; external path skipped if missing).

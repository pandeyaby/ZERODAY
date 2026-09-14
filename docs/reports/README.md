# Desk reports (fixture / static)

## Desk B — inventory

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

## Desk A — security packet

Offline packet for sharing Desk B findings with a security team (**generate only — no auto-post**):

```bash
npm run zeroday -- packet --from docs/reports
# or: npm run zeroday -- packet --fixture --output zeroday-reports/security-packet
```

Checked-in sample: [`desk-a-packet/`](./desk-a-packet/) (`summary.md`, `findings.json`, SARIF copy, placeholders for module/PR/ticket links).

| Label | Evidence |
|-------|----------|
| `agent-misfire` | Inventory `agent_harness` |
| `config` | `ci_secret_pattern` / `env_example_honesty` |
| `dependency` | `dependency_harness` |
| `unknown` | No evidence-backed mapping (no guessing) |

**Posture:** localize + evidence + harden · secrets redacted · no Slack/GH/email auto-send · no PoC · no Desk C/D/E.

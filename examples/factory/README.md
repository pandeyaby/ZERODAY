# Factory sample evidence (fixture-shaped)

Checked-in shapes from a CI-safe `zeroday factory run --fixture` on the
bundled demo-app. **Not** live Antares. **Not** RunPod.

| File | Role |
|------|------|
| `factory.md` | Loop summary (human review) |
| `ownership.md` | CODEOWNERS routing |
| `inventory.excerpt.json` | Inventory schema excerpt |
| `sample-run/` | Full fixture factory run (verify PASS) |
| `*-desk.yaml` | Defensive vendor desk examples (not kill-chains) |

Regenerate:

```bash
npm run zeroday -- factory run --cwe CWE-89 --fixture --defend \
  --classify-scenario software_defect \
  --output examples/factory/sample-run
```

Hard limits unchanged: localization ≠ exploitability · no PoC · no auto-merge.

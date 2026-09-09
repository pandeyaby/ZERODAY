# Sample Antares → SARIF (public proof)

**Label:** regenerated via `zeroday locate --fixture` against the bundled demo-app.
This is **CI / no-GPU fixture-shaped** output — same SARIF schema as live (`mode` differs).
No customer repos, no private paths, no tokens.

## Files

| File | Purpose |
|------|---------|
| `report.sarif` | Full SARIF 2.1.0 (`tool.driver.name` = `ZERODAY-Antares`) |
| `report.excerpt.sarif.json` | Short 2-result excerpt for README embedding |
| `report.json` | Ranked files + posture (`mode: "fixture"`) |
| `demo-app/` | Path label only — mirrors fixture demo filenames |

## Regenerate

```bash
bash scripts/demo-proof.sh
# or:
npm run zeroday -- locate --cwe CWE-89 --fixture \
  --repo fixtures/locate/demo-app \
  --output /tmp/zeroday-proof && cp /tmp/zeroday-proof/report.sarif examples/sample-live-sarif/
```

## Live path (not this sample)

```bash
npm run zeroday -- locate --repo <authorized-repo> --cwe CWE-89 \
  --endpoint http://127.0.0.1:8000/v1
# model defaults to fdtn-ai/antares-1b
```

Localization ≠ exploitability. No PoC. Not a Cisco partnership product.

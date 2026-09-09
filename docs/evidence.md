# Evidence vault

ZERODAY stores durable, SHA-256 hashed evidence under each run directory:

```
zeroday-reports/<run-id>/
  evidence/
    manifest.json
    manifest.sha256
    inputs/advisory.json
    submission.json          # operate
    claims/*.json
    tool-log.json            # optional
  report.json
  report.md                  # cites evidence IDs
  report.sarif
  …
```

## Verify offline

```bash
npm run zeroday -- verify --from zeroday-reports/<run-id>
```

Recomputes hashes for every manifest entry and artifact. No network required.

## Posture

- Localization only — not exploit proof
- No auto-merge · no PoC
- Keyless default (operate)
- Secrets redacted in UI settings by default

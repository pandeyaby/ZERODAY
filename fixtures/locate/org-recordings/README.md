# Org CI recordings (Keyless K3)

Redacted **org** cassettes for CI regression — not product mvp fixtures under
`fixtures/locate/recordings/`.

## Flow

```bash
# 1. Real locate (rules / ingest / live / fixture)
npm run zeroday -- locate --cwe CWE-89 --repo fixtures/locate/rules-sample --rules \
  --output zeroday-reports/org-locate

# 2. Record with --redact (default ON; fail-closed)
npm run zeroday -- record --from zeroday-reports/org-locate \
  --out fixtures/locate/org-recordings/rules-cwe-89.cassette.json

# 3. Human reviews the cassette JSON (paths relative? secrets gone?)

# 4. Replay offline
npm run zeroday -- locate --recording fixtures/locate/org-recordings/rules-cwe-89.cassette.json
```

## Hard locks

- `--redact` default ON — refuse to write if redaction fail-closed
- Absolute paths → repo-relative; secret-shaped strings stripped
- No auto-commit / auto-PR / network exfil of cassettes
- **Human reviews redaction before commit**
- Localization ≠ exploitability · no PoC · `assertNoExploitInvariant`

Do **not** replace `fixtures/locate/recordings/` (mvp smoke). Keep org cassettes
separate and reviewed.

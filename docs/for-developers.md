# For developers

## Layout

| Path | Role |
|------|------|
| `cli/index.ts` | CLI entry (`operate`, `verify`, `locate`, …) |
| `src/operate/` | Keyless agent operator protocol |
| `src/locate/` | Antares fixture / live wrap + exporters |
| `src/evidence/` | File-based evidence vault + verify |
| `src/classify/` | Fixture CISO rollup |
| `src/playground/` | Local fixture playground API helpers |
| `fixtures/` | Offline recordings + demo-app |
| `tests/` | Node test runner |

## Commands

```bash
npm test
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/<run>
npm run play   # local UI only — not Vercel production
```

CI stays fixture-safe on `ubuntu-latest` (no GPU, no weight download).

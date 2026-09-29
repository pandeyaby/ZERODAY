# ZERODAY inventory

> Defensive localization inventory only. Not exploitability proof. No PoC / payload scanning.

| | |
|--|--|
| Repo | `/home/user/ZERODAY/fixtures/locate/demo-app` |
| Files | **8** |
| Manifests | 1 |
| Config hotspots | 4 |
| Findings | 0 |
| CODEOWNERS | `.github/CODEOWNERS` |
| Generated | 2026-09-29T21:30:35.840Z |

## Languages

| Language | Files | Bytes |
|----------|------:|------:|
| JavaScript | 2 | 817 |
| Dockerfile | 1 | 190 |
| YAML | 1 | 231 |

## Evidence findings

_No secret-pattern / env-honesty / harness findings._

## Config hotspots

| Score | Surface | Path | Reason |
|------:|---------|------|--------|
| 90 | `github_actions` | `.github/workflows/ci.yml` | GitHub Actions workflow — CI/CD config surface |
| 80 | `docker` | `Dockerfile` | Dockerfile — container build surface |
| 70 | `package_manifest` | `package.json` | Package / language manifest |
| 65 | `codeowners` | `.github/CODEOWNERS` | CODEOWNERS ownership map |

## Ranked locate hints

Higher score = better starting path for **locate** (inventory priority, not vuln rank).

| Rank | Score | Surface | Path |
|-----:|------:|---------|------|
| 1 | 90 | `github_actions` | `.github/workflows/ci.yml` |
| 2 | 80 | `docker` | `Dockerfile` |
| 3 | 70 | `package_manifest` | `package.json` |
| 4 | 65 | `codeowners` | `.github/CODEOWNERS` |
| 5 | 45 | `source` | `src/app.js` |
| 6 | 45 | `source` | `src/users.js` |

## Hard limits

- Inventory / localization / evidence only
- No exploit, PoC, payload, or attack procedure
- Secret values never exported — patterns/names only
- Localization ≠ exploitability · needs human review

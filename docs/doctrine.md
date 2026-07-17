# Scope & Authorization

> Plinian Doctrine — the four pillars that keep engagements auditable.

[Open in app](http://localhost:3333/docs/doctrine)

Everything in ZERODAY runs under Scope + Authorization + Evidence + Retest.

## Four pillars

1. Scope — only listed hosts/CIDRs/URLs/accounts. Off-scope → SCOPE DENIED.
2. Authorization — acknowledged AuthorizationRecord (who, when, RoE) before Start.
3. Evidence — material claims link to SHA-256 hashed vault records; secrets redacted.
4. Retest — high/critical stay needs_retest until independently validated.

## Tool modes

| Mode | Meaning |
| --- | --- |
| safe_local | Lab/simulation/offline analysis (default for most tools) |
| receipt_required | Needs explicit human spicy approval before run |
| catalog_only | Describe capability; do not execute |

> **Full text:** See SCOPE_AND_AUTHORIZATION.md in the repo root for the durable engagement policy.

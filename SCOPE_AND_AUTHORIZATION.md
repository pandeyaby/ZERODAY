# SCOPE AND AUTHORIZATION — Plinian Doctrine (ZERODAY)
#
# Adapted for vendor security stacks (Cisco, Splunk, extensible loadouts).
# Inspired by T3MP3ST's engagement model.
#
# Antares localization (zeroday locate) is defensive-only: ranked files +
# evidence + SARIF. Never exploits, PoCs, payloads, or attack procedures.
# Localization is not proof of exploitability. No auto-merge.

## The four pillars

1. **Scope** — Explicit targets only (hostname, CIDR, URL, product). Off-scope hosts
   receive `SCOPE DENIED`. Cloud metadata endpoints are denied unless explicitly listed.

2. **Authorization** — Every mission requires an acknowledged AuthorizationRecord
   (who, when, RoE, optional ticket ref). Missions cannot start without it.

3. **Evidence** — Every material claim links to durable, SHA-256 hashed evidence.
   Secrets are redacted by default. No raw credentials in the vault without gates.

4. **Retest** — High/critical findings enter `needs_retest` and must pass independent
   retest before promotion to confirmed claims.

## Tool modes

| Mode | Meaning |
|------|---------|
| `safe_local` | Lab/simulation/offline analysis (default for recon/scan) |
| `receipt_required` | Human spicy-approval required before execution |
| `catalog_only` | Describe capability; do not execute |

## Authorized use only

ZERODAY is for internal red/purple team engagements, written bug-bounty scopes,
vendor product security validation, detection engineering labs, and controlled ranges.

Unauthorized targeting of systems you do not own or lack written permission to test
is illegal. Responsibility rests with the operator.

## Plinius research libraries

G0DM0D3, CL4R1T4S, L1B3RT4S, and OBLITERATUS are **optional** local research clones (not shipped in the ZERODAY product tree).
They remain **disabled** until an operator:

1. Acknowledges the research authorized-use statement
2. Enables the master research gate
3. Enables specific libraries
4. (For content) enables content reads; L1B3RT4S / OBLITERATUS also need a receipt

ZERODAY never auto-injects jailbreak packs into missions and refuses in-process
abliteration/jailbreak execution — run those upstream tools only in an isolated lab VM
under written RoE. All research browse/preview actions are audited to the Evidence Vault.

T3MP3ST and ST3GG are production adapters and do not require the research gate.
ST3GG encode/decode remain `receipt_required` and path-sandboxed.

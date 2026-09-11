# Contributing

Thanks for helping keep ZERODAY a **defensive** localization harness.

## Before you open a PR

1. Read [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) (acceptable use).
2. Read [`SECURITY.md`](./SECURITY.md) — localization ≠ exploitability; no PoC requests.
3. Run `npm test` and `npm run lint` locally when practical.

## Hard limits (will be rejected)

- Exploits, PoCs, payloads, attack procedures, kill-chain / red-team theater
- Auto-merge or “approved without human review” claims
- Silent fixture fallback on the live Antares path
- Scraping or bypassing Hugging Face gated model terms

## Preferred contributions

- Fixture-safe CI / SARIF / evidence-vault improvements
- Docs honesty and operator UX (no combat branding)
- Hardening, tests, and exporter accuracy (local files only)

## License

By contributing, you agree your contributions are licensed under Apache-2.0
(see [`LICENSE`](./LICENSE)).

# Plinius Bridge

> Optional Plinius integrations — T3MP3ST + ST3GG adapters, research libs gated OFF.

[Open in app](http://localhost:3333/docs/plinius)

ZERODAY’s bridge code lives in `src/plinius/` (original product). Upstream elder-plinius repos are **optional local clones** under `vendor/plinius/` (gitignored — not part of the product tree). Without them, adapters report not ready and research stays gated OFF.

| Library | Tier | Behavior |
| --- | --- | --- |
| T3MP3ST | Production | Operator archetypes, RoE, kill-chain phases |
| ST3GG | Production | Sandboxed stegg_cli.py (encode/decode need receipts) |
| G0DM0D3 | Research | Catalog/browse — default OFF |
| CL4R1T4S | Research | Catalog/browse — default OFF |
| L1B3RT4S | Research | Content needs receipt — default OFF |
| OBLITERATUS | Research | No in-process model mutation — default OFF |

> **Research gates:** Acknowledge → enable master → enable libs → optional content reads. Even with execution ON + receipt, ZERODAY refuses in-process dual-use runners (use an isolated lab VM).

```bash
npm run plinius:init
npm run plinius:st3gg-deps
npm run cli -- plinius status
```

War Room → Plinius tab (shortcut `0`). Vendor notes: `vendor/plinius/README.md`.

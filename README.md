# ZERODAY

```
 ███████╗███████╗██████╗  ██████╗ ██████╗  █████╗ ██╗   ██╗
 ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
   ███╔╝ █████╗  ██████╔╝██║   ██║██║  ██║███████║ ╚████╔╝
  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║  ╚██╔╝
 ███████╗███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

**Enterprise AI red/purple team harness for security vendor stacks** (Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS).

ZERODAY is the vendor-specialized evolution of [T3MP3ST](https://github.com/elder-plinius/T3MP3ST)-style multi-agent red teaming, fused with a first-class [P4RS3LT0NGV3](https://elder-plinius.github.io/P4RS3LT0NGV3/)-inspired Stego & Mutation Lab.

It turns your existing AI coding agent (Cursor, Claude, local Ollama/vLLM, OpenRouter, etc.) into a structured, auditable, evidence-first security operator — **keyless by default**, self-hosted, offline-capable.

## Documentation

| Where | Link |
|-------|------|
| **Docs home** (pick your path) | [http://localhost:3333/docs](http://localhost:3333/docs) |
| Non-technical | [`/docs/for-everyone`](http://localhost:3333/docs/for-everyone) |
| First-time users | [`/docs/first-time-users`](http://localhost:3333/docs/first-time-users) |
| Developers | [`/docs/for-developers`](http://localhost:3333/docs/for-developers) |
| Architecture | [`/docs/architecture`](http://localhost:3333/docs/architecture) |
| War Room → Docs tab | Press `9` or click **Docs** in the header |
| Markdown guides | [`docs/`](./docs/README.md) |
| Engagement policy | [`SCOPE_AND_AUTHORIZATION.md`](./SCOPE_AND_AUTHORIZATION.md) |

## Value proposition

| Audience | What you get |
|----------|----------------|
| Enterprise Cisco + Splunk users | Internal red/purple automation, control validation, detection engineering |
| Security vendors | Rigorous product security validation with durable evidence |
| Detection engineers | Continuous sourcetype/integration/coverage gap checks |
| Authorized red teams | Scoped, gated tool execution with retest before high-confidence claims |

## Quick start

```bash
npm install
npm run dev
# → War Room at http://localhost:3333
```

1. Open the War Room — example Cisco + Splunk missions are seeded automatically.
2. Select **Cisco DNA + Splunk Staging Kill Chain**.
3. Enter your name → **Acknowledge Authorization** (required).
4. Hit **Start** (or press `s`).
5. Watch **Live Operators**, then review **Evidence Vault**, **Findings Ledger**, and **Retest Queue**.

### Docker

```bash
docker compose up --build
# → http://localhost:3000
```

### CLI (headless / CI)

```bash
# terminal 1
npm run dev

# terminal 2
export ZERODAY_URL=http://127.0.0.1:3333
npm run cli -- health
npm run cli -- missions
npm run cli -- launch "Assess Cisco DNA + Splunk staging"
npm run cli -- authorize <missionId> --by "Lead"
npm run cli -- start <missionId>
npm run cli -- status <missionId>
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ZERODAY WAR ROOM (Next.js)                  │
├─────────────────────────────────────────────────────────────────┤
│  Missions · Live Operators · Evidence · Findings · Retest ·     │
│  Reports · Stego & Mutation Lab · Settings                      │
├─────────────────────────────────────────────────────────────────┤
│  OPERATOR CELL                                                  │
│  Recon · Scanner · Exploiter · Infiltrator · Exfiltrator ·      │
│  Ghost · Coordinator · Analyst                                  │
├─────────────────────────────────────────────────────────────────┤
│  ARSENAL (gated adapters)     │  LOADOUTS                       │
│  general · cisco · splunk ·   │  Cisco · Splunk · Palo Alto ·   │
│  paloalto · fortinet ·        │  Fortinet · CrowdStrike · AWS   │
│  crowdstrike · aws · stego    │                                 │
├─────────────────────────────────────────────────────────────────┤
│  EVIDENCE VAULT (hashed) · FINDINGS LEDGER · RETEST QUEUE       │
├─────────────────────────────────────────────────────────────────┤
│  LLM: keyless (default) · Ollama · OpenRouter · Anthropic · …   │
└─────────────────────────────────────────────────────────────────┘
```

### Plinian Doctrine

Everything runs under **Scope + Authorization + Evidence + Retest**.

See [SCOPE_AND_AUTHORIZATION.md](./SCOPE_AND_AUTHORIZATION.md).

Tool modes: `safe_local` · `receipt_required` · `catalog_only`.

## Optional Plinius integrations

ZERODAY is original software. Optional local clones of elder-plinius projects can enhance adapters; they are **not** shipped as git submodules. See [`vendor/plinius/README.md`](./vendor/plinius/README.md).

| Library | Tier | Integration |
|---------|------|-------------|
| **T3MP3ST** | Optional prod adapter | Mission/operator/RoE bridge → arsenal + operator prompts |
| **ST3GG** | Optional prod adapter | Real stego via sandboxed `stegg_cli.py` |
| **G0DM0D3** / **CL4R1T4S** / **L1B3RT4S** / **OBLITERATUS** | Research | Gated OFF by default |

```bash
npm run plinius:init         # optional local clones (gitignored)
npm run plinius:st3gg-deps   # optional ST3GG Python venv
```

War Room → **Plinius** tab (`0`). API: `GET/POST /api/plinius`. Guide: [`docs/plinius.md`](./docs/plinius.md).

## Stego & Mutation Lab

Homegrown P4RS3LT0NGV3-style text stego **plus** real image stego via ST3GG:

- 30+ text transforms (encodings, ciphers, Unicode styles, leetspeak, prompt wraps)
- Emoji steganography (variation selectors)
- Invisible / zero-width steganography
- Mutation Lab (batch variants)
- PromptCraft (local heuristic mutation; LLM optional)
- Universal smart decoder
- Tokenade (feather-capped for safety)
- Tokenizer visualization
- **ST3GG** analyze / detect / capacity / encode / decode (sandboxed)

## Vendor loadouts

First-class loadouts:

| Loadout | Focus |
|---------|--------|
| **Cisco** | DNA / Meraki / ISE / IOS / Firepower |
| **Splunk** | REST search, apps, SPL hygiene, Cisco source validation, detection gaps |
| **Palo Alto** | Panorama inventory, rule/threat-profile audit, GlobalProtect, Prisma, XSOAR |
| **Fortinet** | FortiGate policy/VPN/IPS, FortiAnalyzer health, FortiSIEM ATT&CK gaps |
| **CrowdStrike** | Falcon hosts, detections, Spotlight, IOA coverage, Identity Protection |
| **AWS Security** | Security Hub, GuardDuty, IAM Access Analyzer, CloudTrail, Config, WAF, S3 |

### Adding a loadout

1. Create adapters under `src/<vendor>/adapters/`.
2. Register a `VendorLoadout` in `src/loadouts/registry.ts` (include `LOADOUT_ROLE_TOOLS`).
3. Add `ToolDefinition`s with `vendor`, `mode`, and `roles`.
4. Wire the runner in `src/arsenal/registry.ts`.
5. Extend `detectLoadoutsFromBrief` and finding synthesis in the orchestrator.

## Example missions

- `examples/missions/cisco-splunk-staging.yaml`
- `examples/missions/splunk-detection-gaps.yaml`
- `examples/missions/palo-fortinet-edge.yaml`
- `examples/missions/crowdstrike-aws-lab.yaml`

## HTTP API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health + persistence backend |
| `GET/POST /api/missions` | List / create / authorize / start / abort |
| `GET /api/missions/:id` | Mission detail + operators/events/evidence/findings |
| `GET /api/evidence` | Evidence vault |
| `GET/POST /api/findings` | Findings ledger |
| `GET/POST /api/retest` | Retest queue |
| `GET/POST /api/tools` | Arsenal catalog + execute |
| `GET/POST /api/stego` | Stego & mutation lab |
| `GET/POST /api/plinius` | Plinius bridge (T3MP3ST / ST3GG / research gates) |
| `GET/POST /api/settings` | LLM / app settings |
| `GET /api/operators` | Operator cell + events |

MCP-shaped tool catalog: `src/lib/mcp/catalog.ts`.

## LLM providers

**Keyless by default** — orchestration uses a local heuristic planner so the War Room works offline; your Cursor/Claude agent remains the primary intelligence when driving the system.

Optional (via Settings UI or env):

- Ollama / LM Studio / vLLM (OpenAI-compatible)
- OpenRouter, Anthropic, OpenAI

Copy `.env.example` → `.env.local` as needed. API keys are never written into evidence.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus mission brief |
| `1`–`8` | Switch War Room tabs |
| `0` | Plinius bridge |
| `9` | Docs |
| `a` | Acknowledge authorization |
| `s` | Start mission |

## Safety

- Authorized use only
- Default tool execution is **simulated `safe_local`**
- Spicy tools require receipts
- Secret redaction on evidence capture
- Egress scope gate on host-like arguments
- Research libraries (G0DM0D3 / CL4R1T4S / L1B3RT4S / OBLITERATUS) default OFF with multi-step gates + audit trail
- ST3GG encode/decode require receipts; paths sandboxed to workspace + examples

## License

AGPL-3.0-inspired engagement posture — use only with written authorization. No warranty.

## Credits

- [elder-plinius/T3MP3ST](https://github.com/elder-plinius/T3MP3ST) — mission/operator patterns
- [elder-plinius/ST3GG](https://github.com/elder-plinius/ST3GG) — real steganography engine
- [G0DM0D3](https://github.com/elder-plinius/G0DM0D3) · [CL4R1T4S](https://github.com/elder-plinius/CL4R1T4S) · [L1B3RT4S](https://github.com/elder-plinius/L1B3RT4S) · [OBLITERATUS](https://github.com/elder-plinius/OBLITERATUS) — optional research libraries
- Text stego/mutation UX also inspired by [P4RS3LT0NGV3](https://elder-plinius.github.io/P4RS3LT0NGV3/)

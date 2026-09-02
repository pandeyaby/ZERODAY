/**
 * In-app documentation content for ZERODAY.
 * Keep sections practical — anyone should be able to run a mission after reading Getting Started.
 */

export interface DocSection {
  slug: string;
  title: string;
  summary: string;
  /** Nav grouping: audience guides first, then reference. */
  group: "audience" | "reference";
  /** Short label for persona cards (audience guides only). */
  persona?: string;
  body: DocBlock[];
}

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang?: string; text: string }
  | { type: "callout"; tone: "info" | "warn" | "ok"; title: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

/** Pick-your-path guides — shown as featured cards on /docs. */
export const AUDIENCE_DOC_SLUGS = [
  "howto",
  "for-everyone",
  "first-time-users",
  "for-developers",
  "architecture",
] as const;

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "howto",
    title: "How to use ZERODAY",
    summary:
      "Best way for a person, how orgs should use it, and the local fixture playground.",
    group: "audience",
    persona: "Operators",
    body: [
      {
        type: "p",
        text: "This is the durable, honest guide to what ZERODAY’s code actually does. The same content lives in the War Room under the How to use tab and at /play.",
      },
      {
        type: "h3",
        text: "Best way for a person",
      },
      {
        type: "ul",
        items: [
          "Morning/PR — leave the GitHub Action on forever (fixture locate → SARIF → reviewable comment → soft-fail). No GPU in CI.",
          "Known CWE/CVE/GHSA — run `zeroday locate` locally. Live needs vLLM + HF-gated Antares-1B on the operator GPU; source never leaves the machine.",
          "CISO — `zeroday demo` or `classify` → ciso.md / ciso.json. Localization is not exploitability. Human review required.",
          "Never auto-merge. Draft-fix only with `--i-asked-for-a-fix`. No PoCs.",
        ],
      },
      {
        type: "h3",
        text: "How orgs should use it",
      },
      {
        type: "ul",
        items: [
          "Platform eng — Action on every repo; no GPU in CI.",
          "Security analyst — locate on a workstation; ingest SARIF in GitHub Code Scanning.",
          "SOC / Splunk / Cisco Security Cloud buyer — take Splunk CIM JSON, ASFF, and the CISO object as FILES your team ingests with your credentials. We do not push to your clouds.",
          "Four-class classifier is fixture-driven (possible_breach | infra_failure | software_defect | agent_misfire | needs_human). Ambiguous → needs_human. Do not claim live agent-misfire SOC.",
        ],
      },
      {
        type: "h3",
        text: "Local fixture playground",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm run war-room\n# open http://localhost:3333/play\n# or War Room → How to use (shortcut h)",
      },
      {
        type: "p",
        text: "Buttons run existing fixture paths: locate CWE-89, classify each scenario, mixed `zeroday demo`. The UI shows a SARIF summary, Splunk-shaped JSON snippet, and CISO markdown. No live telemetry, no simulated attacks, no exploits, no gated weights.",
      },
      {
        type: "callout",
        tone: "ok",
        title: "Also headless",
        text: "npm run zeroday -- play --action locate|classify|demo",
      },
    ],
  },
  {
    slug: "for-everyone",
    title: "For Non-Technical Readers",
    summary: "Plain-language explanation of what ZERODAY does — no jargon required.",
    group: "audience",
    persona: "Non-technical",
    body: [
      {
        type: "p",
        text: "Think of ZERODAY as a supervised security checklist that uses AI helpers. You describe what you are allowed to check. ZERODAY breaks the work into steps, records what it found, and asks a human before treating serious issues as confirmed.",
      },
      {
        type: "h3",
        text: "In one sentence",
      },
      {
        type: "p",
        text: "ZERODAY helps security teams safely test their own systems (Cisco, Splunk, cloud tools, and more) and keep a clear paper trail of proof.",
      },
      {
        type: "h3",
        text: "What you will see in the War Room",
      },
      {
        type: "ul",
        items: [
          "Missions — a named engagement with clear boundaries (who, what, where)",
          "Operators — AI roles with different jobs (discover, check, summarize)",
          "Evidence — saved notes of what each check produced",
          "Findings — issues written in human language with suggested fixes",
          "Retest — a second look before high-severity issues are marked confirmed",
        ],
      },
      {
        type: "h3",
        text: "The four safety rules (plain English)",
      },
      {
        type: "ol",
        items: [
          "Scope — only look at systems on the approved list",
          "Authorization — a named person must approve the rules of engagement first",
          "Evidence — important claims need saved proof, not guesses",
          "Retest — serious findings need a second confirmation",
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Important",
        text: "ZERODAY is only for authorized testing. Using it against systems without permission can be illegal.",
      },
      {
        type: "h3",
        text: "What you do not need to know",
      },
      {
        type: "ul",
        items: [
          "You do not need to write code to watch a demo mission",
          "You do not need an AI API key for the basic experience",
          "You do not need to understand every vendor product on day one",
        ],
      },
      {
        type: "h3",
        text: "Suggested next step",
      },
      {
        type: "p",
        text: "Ask a teammate to open the War Room, pick a seeded example mission, acknowledge authorization, and press Start. Watch Live Operators, then open Findings together.",
      },
      {
        type: "callout",
        tone: "ok",
        title: "Related guides",
        text: "First-Time Users (hands-on walkthrough) · Architecture Overview (how pieces fit) · Scope & Authorization (policy detail).",
      },
    ],
  },
  {
    slug: "first-time-users",
    title: "First-Time Users",
    summary: "Easy walkthrough for your first mission — click, watch, review.",
    group: "audience",
    persona: "First-time",
    body: [
      {
        type: "p",
        text: "This guide assumes you can open a browser and run a couple of terminal commands. No security expertise required to complete the demo path.",
      },
      {
        type: "h3",
        text: "Start the app",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm install\nnpm run dev\n# Open http://localhost:3333",
      },
      {
        type: "h3",
        text: "Run the easiest demo (5 minutes)",
      },
      {
        type: "ol",
        items: [
          "On the left, click “Cisco DNA + Splunk Staging Kill Chain” (or any seeded mission).",
          "Type your name in the authorization box.",
          "Click Acknowledge Authorization — Start stays locked until you do.",
          "Click Start (or press the s key).",
          "Open the Live Operators tab — you should see roles light up and an event stream.",
          "When the run finishes (status may say awaiting_retest), open Findings Ledger.",
          "Open Retest Queue and click Pass or Fail on any queued item.",
        ],
      },
      {
        type: "callout",
        tone: "ok",
        title: "Nothing “real” is being attacked",
        text: "Default tools run in safe_local simulation mode. They produce realistic lab evidence without needing live Cisco/Splunk credentials.",
      },
      {
        type: "h3",
        text: "Try a sentence instead of a preset",
      },
      {
        type: "p",
        text: "In the Mission Queue brief box, paste:",
      },
      {
        type: "code",
        text: "Assess Palo Alto Panorama and Fortinet FortiGate staging edge policies and VPN",
      },
      {
        type: "p",
        text: "Click Launch Mission, acknowledge authorization, then Start. ZERODAY picks the matching vendor loadouts for you.",
      },
      {
        type: "h3",
        text: "Useful buttons & keys",
      },
      {
        type: "table",
        headers: ["Action", "How"],
        rows: [
          ["Switch tabs", "Click a tab or press 1–9"],
          ["Open Docs", "Docs tab (9) or Docs in the header"],
          ["Authorize", "Button or press a"],
          ["Start mission", "Button or press s"],
          ["Focus brief", "Press /"],
        ],
      },
      {
        type: "h3",
        text: "If something feels stuck",
      },
      {
        type: "ul",
        items: [
          "Start grayed out? Acknowledge Authorization first.",
          "Wrong port? Use http://localhost:3333 (not 3000 unless Docker).",
          "Confused by a finding? Click Evidence Vault and expand the linked record.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Want more depth later",
        text: "War Room Guide · Vendor Loadouts · FAQ & Troubleshooting.",
      },
    ],
  },
  {
    slug: "for-developers",
    title: "For Developers",
    summary: "Repo layout, extending loadouts, API/CLI, gates, and local persistence.",
    group: "audience",
    persona: "Developers",
    body: [
      {
        type: "p",
        text: "ZERODAY is a Next.js 15 (App Router) + TypeScript app. Tool execution defaults to simulated safe_local adapters with Plinian gates (auth → scope → mode → evidence).",
      },
      {
        type: "h3",
        text: "Key directories",
      },
      {
        type: "table",
        headers: ["Path", "Role"],
        rows: [
          ["src/app", "War Room UI + /docs + API routes"],
          ["src/agents", "Operators + mission orchestrator"],
          ["src/arsenal", "Tool registry + general adapters"],
          ["src/cisco|splunk|paloalto|fortinet|crowdstrike|aws", "Vendor adapters"],
          ["src/loadouts", "Loadout registry + brief detection"],
          ["src/evidence", "Vault + findings/retest"],
          ["src/stego", "Transforms, stego, mutation, PromptCraft"],
          ["src/lib/docs", "In-app documentation source of truth"],
          ["cli/", "Headless CLI (tsx)"],
          ["docs/", "Markdown mirrors of guides"],
        ],
      },
      {
        type: "h3",
        text: "Mission runtime flow",
      },
      {
        type: "code",
        lang: "text",
        text: "POST /api/missions (brief)\n  → authorize (acknowledged RoE)\n  → startMissionRun()\n  → phases × operators\n  → executeTool() [auth/scope/mode]\n  → captureEvidence() [hash + redact]\n  → synthesizeFindings()\n  → awaiting_retest | completed",
      },
      {
        type: "h3",
        text: "Add a vendor loadout",
      },
      {
        type: "ol",
        items: [
          "Implement tools + runner in src/<vendor>/adapters/index.ts",
          "Register VendorLoadout and LOADOUT_ROLE_TOOLS in src/loadouts/registry.ts",
          "Import tools/runner in src/arsenal/registry.ts",
          "Extend detectLoadoutsFromBrief + inferTargets",
          "Add finding synthesis branches in src/agents/orchestrator.ts",
          "Optional: seed example mission in src/lib/seed.ts",
        ],
      },
      {
        type: "h3",
        text: "Tool modes & spicy paths",
      },
      {
        type: "ul",
        items: [
          "safe_local — default for recon/scan/detect adapters",
          "receipt_required — SSH exec, RTR, config push, etc. (approve via API action)",
          "catalog_only — describe only; no execution",
        ],
      },
      {
        type: "h3",
        text: "CLI & MCP",
      },
      {
        type: "code",
        lang: "bash",
        text: "export ZERODAY_URL=http://127.0.0.1:3333\nnpm run cli -- health\nnpm run cli -- launch \"Assess AWS Security Hub lab account\"\ncurl -s http://127.0.0.1:3333/api/mcp | jq '.server'",
      },
      {
        type: "h3",
        text: "Persistence",
      },
      {
        type: "p",
        text: "better-sqlite3 under data/ (ZERODAY_DATA_DIR). Falls back to JSON store if native module fails. serverExternalPackages includes better-sqlite3.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Docs maintenance",
        text: "Edit src/lib/docs/content.ts then regenerate docs/*.md (or update both). Audience cards read AUDIENCE_DOC_SLUGS.",
      },
      {
        type: "callout",
        tone: "ok",
        title: "Related",
        text: "Architecture Overview · CLI & HTTP API · LLM Providers · Scope & Authorization.",
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture Overview",
    summary: "How the War Room, operators, arsenal, loadouts, and evidence vault fit together.",
    group: "audience",
    persona: "Architecture",
    body: [
      {
        type: "p",
        text: "ZERODAY is a self-hosted control plane: a War Room UI drives an orchestrated multi-operator loop that calls gated tool adapters and writes provenance-tracked evidence.",
      },
      {
        type: "h3",
        text: "System diagram",
      },
      {
        type: "code",
        lang: "text",
        text: "┌─────────────────────────────────────────────────────────┐\n│ War Room (Next.js)  ·  Docs  ·  CLI  ·  HTTP/MCP catalog │\n└───────────────────────────┬─────────────────────────────┘\n                            │\n              ┌─────────────▼─────────────┐\n              │ Mission Orchestrator      │\n              │ Coordinator → phases      │\n              └─────────────┬─────────────┘\n        ┌───────────────────┼───────────────────┐\n        ▼                   ▼                   ▼\n   Operators           Arsenal               LLM\n   (8 roles)        (gated tools)         (keyless+\n        │                 │                optional)\n        └────────┬────────┘\n                 ▼\n        Evidence Vault (hash/redact)\n                 ▼\n        Findings Ledger → Retest Queue → Reports",
      },
      {
        type: "h3",
        text: "Control plane vs data plane",
      },
      {
        type: "ul",
        items: [
          "Control plane — missions, authorization, operator lifecycle, settings, docs",
          "Data plane — tool adapters returning structured results into the Evidence Vault",
          "Policy plane — Plinian Doctrine (scope, auth, evidence, retest) enforced in executeTool()",
        ],
      },
      {
        type: "h3",
        text: "Vendor loadouts",
      },
      {
        type: "p",
        text: "Loadouts are first-class capability packs. A mission’s loadouts[] selects doctrine addenda and preferred tools per operator role (LOADOUT_ROLE_TOOLS). Brief text is mapped via detectLoadoutsFromBrief().",
      },
      {
        type: "table",
        headers: ["Loadout", "Adapter prefix"],
        rows: [
          ["cisco", "cisco.*"],
          ["splunk", "splunk.*"],
          ["paloalto", "paloalto.*"],
          ["fortinet", "fortinet.*"],
          ["crowdstrike", "crowdstrike.*"],
          ["aws", "aws.*"],
        ],
      },
      {
        type: "h3",
        text: "Evidence provenance",
      },
      {
        type: "ol",
        items: [
          "Tool returns { summary, data }",
          "Payload redacted; SHA-256 hash stored",
          "Analyst synthesis creates findings with evidenceIds",
          "High/critical auto-enter retest before promotion",
        ],
      },
      {
        type: "h3",
        text: "Deployment shapes",
      },
      {
        type: "ul",
        items: [
          "Local: npm run dev → :3333",
          "Docker Compose: container on :3000 with /data volume",
          "Headless: CLI against ZERODAY_URL for CI-style mission runs",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Design priorities",
        text: "Safety and auditability beat raw offensive capability. Default is simulated safe_local; spicy actions require receipts.",
      },
    ],
  },
  {
    slug: "overview",
    title: "What is ZERODAY?",
    summary: "Enterprise AI red/purple team harness for security vendor stacks.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "ZERODAY turns your existing AI coding agent into a structured, auditable security operator specialized for Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, and AWS Security.",
      },
      {
        type: "p",
        text: "It is keyless by default (uses your agent), self-hosted, offline-capable, and built around durable evidence — not vibes.",
      },
      {
        type: "h3",
        text: "Who it’s for",
      },
      {
        type: "ul",
        items: [
          "Internal red/purple teams validating Cisco + Splunk (and adjacent) stacks",
          "Security vendors running product security assessments",
          "Detection engineers checking sourcetypes, integrations, and ATT&CK coverage",
          "Authorized bug-bounty / lab engagements with written scope",
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Authorized use only",
        text: "Only test systems you own or have explicit written permission to assess. Unauthorized use is illegal.",
      },
    ],
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    summary: "Install, open the War Room, run your first mission in five minutes.",
    group: "reference",
    body: [
      {
        type: "h3",
        text: "1. Install & run",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm install\nnpm run dev\n# War Room → http://localhost:3333",
      },
      {
        type: "h3",
        text: "2. First mission (UI)",
      },
      {
        type: "ol",
        items: [
          "Open http://localhost:3333 — example missions are seeded automatically.",
          "Pick “Cisco DNA + Splunk Staging Kill Chain” (or Palo/Fortinet / Falcon+AWS).",
          "Enter your name and click Acknowledge Authorization (required).",
          "Click Start (or press s).",
          "Watch Live Operators, then open Evidence Vault → Findings → Retest Queue.",
        ],
      },
      {
        type: "h3",
        text: "3. Natural-language launch",
      },
      {
        type: "p",
        text: "In the left Mission Queue, paste a brief such as:",
      },
      {
        type: "code",
        text: "Assess Palo Alto Panorama and Fortinet FortiGate staging edge policies and VPN",
      },
      {
        type: "p",
        text: "ZERODAY detects loadouts from the brief, invents scoped lab targets, and waits for authorization before any tools run.",
      },
      {
        type: "h3",
        text: "Docker",
      },
      {
        type: "code",
        lang: "bash",
        text: "docker compose up --build\n# → http://localhost:3000",
      },
      {
        type: "callout",
        tone: "ok",
        title: "Keyless by default",
        text: "No API key required to explore. Optional Ollama / OpenRouter / Anthropic / OpenAI can be set under Settings.",
      },
    ],
  },
  {
    slug: "war-room",
    title: "War Room Guide",
    summary: "Tabs, keyboard shortcuts, and how to read live mission state.",
    group: "reference",
    body: [
      {
        type: "h3",
        text: "Tabs",
      },
      {
        type: "table",
        headers: ["Tab", "Key", "Purpose"],
        rows: [
          ["How to use", "h", "Person + org usage guide + fixture playground"],
          ["Missions", "1", "Scope, phases, authorization, start/abort"],
          ["Live Operators", "2", "Operator cell + event stream"],
          ["Evidence Vault", "3", "Hashed, redacted tool outputs"],
          ["Findings Ledger", "4", "Severity, confidence, vendor impact, fixes"],
          ["Retest Queue", "5", "Pass/fail before promoting high/critical"],
          ["Reports", "6", "JSON engagement export"],
          ["Stego & Mutation", "7", "P4RS3LT0NGV3-style lab"],
          ["Settings", "8", "LLM provider / model"],
          ["Docs", "9", "Guides linked in-app"],
        ],
      },
      {
        type: "h3",
        text: "Shortcuts",
      },
      {
        type: "ul",
        items: [
          "h — How to use (org guide + fixture playground)",
          "/ — focus mission brief",
          "a — acknowledge authorization",
          "s — start mission",
          "1–9 — switch tabs (9 opens Docs panel)",
        ],
      },
      {
        type: "h3",
        text: "Status meanings",
      },
      {
        type: "ul",
        items: [
          "awaiting_authorization — RoE not acknowledged yet",
          "running — operators executing tools",
          "awaiting_retest — high/critical findings need human retest",
          "completed — run finished; promote findings as needed",
          "aborted / failed — stopped or phase error",
        ],
      },
    ],
  },
  {
    slug: "doctrine",
    title: "Scope & Authorization",
    summary: "Plinian Doctrine — the four pillars that keep engagements auditable.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Everything in ZERODAY runs under Scope + Authorization + Evidence + Retest.",
      },
      {
        type: "h3",
        text: "Four pillars",
      },
      {
        type: "ol",
        items: [
          "Scope — only listed hosts/CIDRs/URLs/accounts. Off-scope → SCOPE DENIED.",
          "Authorization — acknowledged AuthorizationRecord (who, when, RoE) before Start.",
          "Evidence — material claims link to SHA-256 hashed vault records; secrets redacted.",
          "Retest — high/critical stay needs_retest until independently validated.",
        ],
      },
      {
        type: "h3",
        text: "Tool modes",
      },
      {
        type: "table",
        headers: ["Mode", "Meaning"],
        rows: [
          ["safe_local", "Lab/simulation/offline analysis (default for most tools)"],
          ["receipt_required", "Needs explicit human spicy approval before run"],
          ["catalog_only", "Describe capability; do not execute"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Full text",
        text: "See SCOPE_AND_AUTHORIZATION.md in the repo root for the durable engagement policy.",
      },
    ],
  },
  {
    slug: "operators",
    title: "Operators & Kill Chain",
    summary: "Eight specialist operators and how a mission progresses.",
    group: "reference",
    body: [
      {
        type: "table",
        headers: ["Operator", "Job"],
        rows: [
          ["Coordinator", "Plan phases, enforce scope/auth"],
          ["Recon", "Asset & stack discovery"],
          ["Scanner", "Vuln / misconfig survey"],
          ["Exploiter", "Gated PoC validation"],
          ["Infiltrator", "Lateral / identity path modeling"],
          ["Exfiltrator", "Exfil & stego channel assessment"],
          ["Ghost", "OPSEC / detection gaps"],
          ["Analyst", "Evidence → findings + retest queue"],
        ],
      },
      {
        type: "p",
        text: "Default phases: Coordinate → Recon → Scan → Ghost → Exfil (stego) → Analyst. Tools are chosen from active vendor loadouts.",
      },
    ],
  },
  {
    slug: "loadouts",
    title: "Vendor Loadouts",
    summary: "Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS — what each unlocks.",
    group: "reference",
    body: [
      {
        type: "table",
        headers: ["Loadout", "Focus"],
        rows: [
          ["cisco", "DNA / Meraki / ISE / IOS / Firepower"],
          ["splunk", "Search, apps, SPL hygiene, Cisco→Splunk sources, detection gaps"],
          ["paloalto", "Panorama rules, threat profiles, GlobalProtect, Prisma, XSOAR"],
          ["fortinet", "FortiGate policy/VPN/IPS, FortiAnalyzer, FortiSIEM gaps"],
          ["crowdstrike", "Falcon hosts, detections, Spotlight, IOA, Identity (+ gated RTR)"],
          ["aws", "Security Hub, GuardDuty, IAM Analyzer, CloudTrail, Config, WAF, S3"],
        ],
      },
      {
        type: "h3",
        text: "Brief detection examples",
      },
      {
        type: "ul",
        items: [
          "“…Cisco DNA Center and Splunk…” → cisco + splunk",
          "“…Palo Alto Panorama and Fortinet FortiGate…” → paloalto + fortinet",
          "“…CrowdStrike Falcon and AWS Security Hub…” → crowdstrike + aws",
        ],
      },
      {
        type: "h3",
        text: "Add your own loadout",
      },
      {
        type: "ol",
        items: [
          "Create adapters under src/<vendor>/adapters/",
          "Register VendorLoadout + LOADOUT_ROLE_TOOLS in src/loadouts/registry.ts",
          "Wire tools in src/arsenal/registry.ts",
          "Extend detectLoadoutsFromBrief and finding synthesis",
        ],
      },
    ],
  },
  {
    slug: "evidence",
    title: "Evidence, Findings & Retest",
    summary: "How claims become durable, reviewable security outcomes.",
    group: "reference",
    body: [
      {
        type: "h3",
        text: "Evidence Vault",
      },
      {
        type: "ul",
        items: [
          "Every tool call stores a timestamped record with SHA-256 hash",
          "Secrets/API keys are redacted by default",
          "Click a row in the War Room to expand payload JSON",
        ],
      },
      {
        type: "h3",
        text: "Findings Ledger",
      },
      {
        type: "p",
        text: "Findings include severity, confidence, vendor impact, evidence links, MITRE hints, and recommended fixes. Analyst synthesis creates them from tool evidence at end of run.",
      },
      {
        type: "h3",
        text: "Retest Queue",
      },
      {
        type: "p",
        text: "High/critical findings auto-queue. Pass promotes to confirmed; Fail keeps them tentative. Do not treat unretested highs as final.",
      },
    ],
  },
  {
    slug: "stego",
    title: "Stego & Mutation Lab",
    summary: "Transforms, steganography, PromptCraft, tokenizer — purple-team utilities.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Inspired by P4RS3LT0NGV3. Use for authorized purple-team channel testing and prompt mutation — not for hiding real exfil from production defenses without mandate.",
      },
      {
        type: "ul",
        items: [
          "Transforms — base64, ciphers, Unicode styles, leetspeak, prompt wraps",
          "Emoji / invisible (zero-width) steganography",
          "Mutation Lab — batch variants",
          "PromptCraft — local heuristic mutation (LLM optional)",
          "Universal decoder + tokenizer visualization",
          "Tokenade — feather-capped stress payloads (lab only)",
          "ST3GG — real image stego (analyze/detect/capacity; encode/decode receipt-gated)",
        ],
      },
    ],
  },
  {
    slug: "plinius",
    title: "Plinius Bridge",
    summary: "Optional Plinius integrations — T3MP3ST + ST3GG adapters, research libs gated OFF.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "ZERODAY is original software. Bridge code lives in src/plinius/. Optional local clones of elder-plinius projects can sit under vendor/plinius/ (gitignored). Without them, adapters report not ready and research stays gated OFF.",
      },
      {
        type: "table",
        headers: ["Library", "Tier", "Behavior"],
        rows: [
          ["T3MP3ST", "Production", "Operator archetypes, RoE, kill-chain phases"],
          ["ST3GG", "Production", "Sandboxed stegg_cli.py (encode/decode need receipts)"],
          ["G0DM0D3", "Research", "Catalog/browse — default OFF"],
          ["CL4R1T4S", "Research", "Catalog/browse — default OFF"],
          ["L1B3RT4S", "Research", "Content needs receipt — default OFF"],
          ["OBLITERATUS", "Research", "No in-process model mutation — default OFF"],
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Research gates",
        text: "Acknowledge → enable master → enable libs → optional content reads. Even with execution ON + receipt, ZERODAY refuses in-process dual-use runners (use an isolated lab VM).",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm run plinius:init\nnpm run plinius:st3gg-deps\nnpm run cli -- plinius status",
      },
      {
        type: "p",
        text: "War Room → Plinius tab (shortcut 0). Full guide: docs/plinius.md.",
      },
    ],
  },
  {
    slug: "cli-api",
    title: "CLI & HTTP API",
    summary: "Headless/CI parity and integration endpoints.",
    group: "reference",
    body: [
      {
        type: "h3",
        text: "CLI",
      },
      {
        type: "code",
        lang: "bash",
        text: "export ZERODAY_URL=http://127.0.0.1:3333\nnpm run cli -- health\nnpm run cli -- plinius status\nnpm run cli -- missions\nnpm run cli -- launch \"Assess Cisco DNA + Splunk staging\"\nnpm run cli -- authorize <missionId> --by \"Lead\"\nnpm run cli -- start <missionId>\nnpm run cli -- status <missionId>",
      },
      {
        type: "h3",
        text: "Main HTTP routes",
      },
      {
        type: "table",
        headers: ["Method", "Path", "Purpose"],
        rows: [
          ["GET", "/api/health", "Health + persistence backend"],
          ["GET/POST", "/api/missions", "List / create / authorize / start / abort"],
          ["GET", "/api/missions/:id", "Full mission detail"],
          ["GET", "/api/evidence", "Evidence vault"],
          ["GET/POST", "/api/findings", "Findings ledger"],
          ["GET/POST", "/api/retest", "Retest queue"],
          ["GET/POST", "/api/tools", "Arsenal catalog + execute"],
          ["GET/POST", "/api/stego", "Stego lab"],
          ["GET/POST", "/api/plinius", "Plinius bridge + research gates"],
          ["GET/POST", "/api/playground", "Fixture locate/classify/demo (local playground)"],
          ["GET/POST", "/api/settings", "App / LLM settings"],
          ["GET", "/api/mcp", "MCP-shaped tool catalog"],
        ],
      },
      {
        type: "h3",
        text: "Fixture playground",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm run war-room\n# → http://localhost:3333/play\nnpm run zeroday -- play --action locate",
      },
    ],
  },
  {
    slug: "llm",
    title: "LLM Providers",
    summary: "Keyless default plus optional local/cloud providers.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Default provider is keyless — the War Room uses a local heuristic planner so it works offline. Your Cursor/Claude session remains the primary intelligence when you drive the system.",
      },
      {
        type: "h3",
        text: "Optional providers (Settings or env)",
      },
      {
        type: "ul",
        items: [
          "Ollama / LM Studio / vLLM (OpenAI-compatible)",
          "OpenRouter, Anthropic, OpenAI",
          "Custom base URL via ZERODAY_LLM_BASE_URL",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text: "# .env.local (never commit secrets)\nOLLAMA_HOST=http://127.0.0.1:11434\nZERODAY_LOCAL_MODEL=llama3\n# OPENROUTER_API_KEY=\n# ANTHROPIC_API_KEY=\n# OPENAI_API_KEY=",
      },
      {
        type: "callout",
        tone: "info",
        title: "Evidence hygiene",
        text: "API keys are never written into the Evidence Vault. Copy .env.example → .env.local as needed.",
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ & Troubleshooting",
    summary: "Common questions and fixes.",
    group: "reference",
    body: [
      {
        type: "h3",
        text: "Port 3000 is busy",
      },
      {
        type: "p",
        text: "npm run dev binds to 3333 by design. Docker still exposes 3000 inside compose.",
      },
      {
        type: "h3",
        text: "Start is disabled",
      },
      {
        type: "p",
        text: "Acknowledge Authorization first. Missions cannot run without an acknowledged RoE.",
      },
      {
        type: "h3",
        text: "SCOPE DENIED",
      },
      {
        type: "p",
        text: "The tool target is outside mission targets. Edit scope or launch a brief that includes the right hosts/account IDs.",
      },
      {
        type: "h3",
        text: "RECEIPT REQUIRED",
      },
      {
        type: "p",
        text: "Spicy tools (SSH exec, RTR, config push, etc.) need approve_receipt via API before they run. Default kill-chain stays on safe_local.",
      },
      {
        type: "h3",
        text: "Where is data stored?",
      },
      {
        type: "p",
        text: "SQLite under data/ (or ZERODAY_DATA_DIR). JSON fallback if the native module is unavailable.",
      },
    ],
  },
];

export function getDoc(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}

export function getDefaultDocSlug(): string {
  return "for-everyone";
}

export function getAudienceDocs(): DocSection[] {
  return DOC_SECTIONS.filter((s) => s.group === "audience");
}

export function getReferenceDocs(): DocSection[] {
  return DOC_SECTIONS.filter((s) => s.group === "reference");
}

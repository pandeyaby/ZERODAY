/**
 * In-app documentation — defensive agent operator (no kill-chain / Plinius).
 */

import { FAQ_INTRO, FAQ_ITEMS, type FaqBlock } from "@/faq/content";

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang?: string; text: string }
  | { type: "callout"; tone: "info" | "warn" | "ok"; title: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function faqBlocksToDocBlocks(blocks: FaqBlock[]): DocBlock[] {
  return blocks.map((b) => {
    if (b.type === "p") return { type: "p" as const, text: b.text };
    if (b.type === "ul") return { type: "ul" as const, items: b.items };
    return { type: "table" as const, headers: b.headers, rows: b.rows };
  });
}

export interface DocSection {
  slug: string;
  title: string;
  summary: string;
  group: "audience" | "reference";
  persona?: string;
  body: DocBlock[];
}

export const AUDIENCE_DOC_SLUGS = [
  "for-everyone",
  "first-time-users",
  "for-developers",
  "architecture",
] as const;

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "for-everyone",
    title: "For Non-Technical Readers",
    summary: "Plain-language explanation of what ZERODAY does.",
    group: "audience",
    persona: "Non-technical",
    body: [
      {
        type: "p",
        text: "ZERODAY helps authorized teams find which files in their own code might relate to a known weakness (a CWE/CVE), keep hashed proof of every claim, and hand local files to Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, or AWS Security desks — without sending your source to a cloud model by default.",
      },
      {
        type: "callout",
        tone: "warn",
        title: "Important",
        text: "Only use ZERODAY on code you are allowed to assess. It never writes exploits or auto-merges fixes.",
      },
    ],
  },
  {
    slug: "first-time-users",
    title: "First-time users",
    summary: "60-second fixture demo and keyless operate path.",
    group: "audience",
    persona: "First-time",
    body: [
      {
        type: "h3",
        text: "Fixture demo (no GPU)",
      },
      {
        type: "code",
        lang: "bash",
        text: "npm install\nnpm run zeroday -- operate --cwe CWE-89 --fixture\nnpm run zeroday -- verify --from zeroday-reports/operate-CWE-89-*",
      },
      {
        type: "p",
        text: "Default path is keyless: your coding agent + the operate harness. Optional local Antares is separate (`locate --live`).",
      },
    ],
  },
  {
    slug: "for-developers",
    title: "For developers",
    summary: "CLI, evidence vault, exporters, CI fixtures.",
    group: "audience",
    persona: "Developers",
    body: [
      {
        type: "ul",
        items: [
          "`zeroday operate` — keyless agent operator + evidence pack",
          "`zeroday locate` — Antares fixture or optional local live",
          "`zeroday verify` — offline hash/schema check",
          "`zeroday export` / `draft-fix` / `classify` / `demo` / `play`",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "CI",
        text: "GitHub Action stays fixture-safe on ubuntu-latest — no GPU, no Docker-in-Docker for the fixture path.",
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture",
    summary: "Operate → validate → artifact pack → evidence vault.",
    group: "audience",
    persona: "Architecture",
    body: [
      {
        type: "p",
        text: "Operate prepares a read-only snapshot, emits OPERATOR_SPEC.md + JSON schema, accepts an agent submission (or fixture), validates schema + no-exploit invariant, then writes the same artifact pack as locate plus evidence/manifest.json.",
      },
    ],
  },
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Install and run fixture operate/locate.",
    group: "reference",
    body: [
      {
        type: "code",
        lang: "bash",
        text: "npm install\nnpm run zeroday -- operate --cwe CWE-89 --fixture\nnpm run zeroday -- locate --cwe CWE-89 --fixture\nnpm test",
      },
    ],
  },
  {
    slug: "howto",
    title: "How to use",
    summary: "Person + org guidance and local playground.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Open http://localhost:3333/play after `npm run play`. Buttons run fixture locate / classify / demo only.",
      },
    ],
  },
  {
    slug: "evidence",
    title: "Evidence vault",
    summary: "Hashed artifacts under zeroday-reports/<run>/evidence/.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Every material claim cites evidence IDs. `zeroday verify --from <run-dir>` recomputes SHA-256 hashes offline.",
      },
    ],
  },
  {
    slug: "exporters",
    title: "Exporters",
    summary: "Local vendor projections — customer ingest only.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "See docs/exporters.md and docs/vendor-packs/README.md. No live vendor push.",
      },
    ],
  },
  {
    slug: "classify",
    title: "Classify",
    summary: "Fixture-driven CISO rollup labels.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Labels: possible_breach | infra_failure | software_defect | agent_misfire | needs_human. Always needs_human. Not a live SOC.",
      },
    ],
  },
  {
    slug: "antares",
    title: "Antares (optional)",
    summary: "Local completions-only sister path.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Optional `locate --live` wraps cisco-antares-cli against your local /v1/completions. Antares CLI expects vLLM 0.19.1+. ZERODAY never downloads model.safetensors. Sister cookbook: Cisco Foundation AI Quickstart_Antares.",
      },
    ],
  },
  {
    slug: "sandbox",
    title: "Live sandbox",
    summary: "Docker network=none for live explore.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "Live locate may use an isolated ubuntu container with network=none. Fixture/CI paths stay container-free.",
      },
    ],
  },
  {
    slug: "cli-api",
    title: "CLI reference",
    summary: "operate, verify, locate, export, classify, demo, play, draft-fix.",
    group: "reference",
    body: [
      {
        type: "code",
        lang: "bash",
        text: "npm run zeroday -- operate --cwe CWE-89 --fixture\nnpm run zeroday -- verify --from zeroday-reports/<run>\nnpm run zeroday -- locate --cwe CWE-89 --fixture\nnpm run zeroday -- play --action demo",
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    summary: "Keyless Strength honesty — doors, Desk, Antares, no PoCs.",
    group: "reference",
    body: [
      { type: "p", text: FAQ_INTRO },
      { type: "callout", tone: "warn", title: "Play UI", text: "Same Q&As live under npm run play → FAQ tab (src/faq/content.ts)." },
      ...FAQ_ITEMS.flatMap((item) => [
        { type: "h3" as const, text: item.question },
        ...faqBlocksToDocBlocks(item.answer),
      ]),
    ],
  },
  {
    slug: "overview",
    title: "Overview",
    summary: "North star product intent.",
    group: "reference",
    body: [
      {
        type: "p",
        text: "ZERODAY turns an existing AI coding agent into a structured, auditable security operator specialized for Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, and AWS Security desks — keyless, self-hosted, offline-capable, durable evidence.",
      },
    ],
  },
];

export function getDoc(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}

export function getAudienceDocs(): DocSection[] {
  return DOC_SECTIONS.filter((s) => s.group === "audience");
}

export function getReferenceDocs(): DocSection[] {
  return DOC_SECTIONS.filter((s) => s.group === "reference");
}

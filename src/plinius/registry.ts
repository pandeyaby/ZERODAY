/**
 * Plinius library registry — optional local elder-plinius clones.
 */

import { pliniusLibPresent, pliniusLibRoot, type PliniusLibId } from "@/plinius/paths";

export type PliniusTier = "production" | "research";

export interface PliniusLibraryMeta {
  id: PliniusLibId;
  name: string;
  tier: PliniusTier;
  github: string;
  description: string;
  /** How ZERODAY integrates this library. */
  integration: string;
  /** Default arsenal posture when present. */
  defaultMode: "safe_local" | "receipt_required" | "catalog_only";
  /** Research libs require explicit enable + acknowledgment. */
  requiresResearchGate: boolean;
  spicy: boolean;
}

export const PLINIUS_LIBRARIES: PliniusLibraryMeta[] = [
  {
    id: "t3mp3st",
    name: "T3MP3ST",
    tier: "production",
    github: "https://github.com/elder-plinius/T3MP3ST",
    description:
      "Multi-agent red-team mission control — operator archetypes, RoE, kill-chain phases.",
    integration:
      "Production adapter maps archetypes/RoE/phases into ZERODAY missions and operator prompts.",
    defaultMode: "safe_local",
    requiresResearchGate: false,
    spicy: false,
  },
  {
    id: "st3gg",
    name: "ST3GG",
    tier: "production",
    github: "https://github.com/elder-plinius/ST3GG",
    description: "Real steganography toolkit (Python CLI) — encode/decode/analyze image carriers.",
    integration:
      "Production adapter shells stegg_cli.py in a sandboxed workspace; encode/decode are receipt-gated.",
    defaultMode: "safe_local",
    requiresResearchGate: false,
    spicy: true,
  },
  {
    id: "g0dm0d3",
    name: "G0DM0D3",
    tier: "research",
    github: "https://github.com/elder-plinius/G0DM0D3",
    description: "Multi-model red-team chat / Parseltongue research UI (optional).",
    integration: "Catalog + gated file browse only. Never auto-invoked by kill-chain.",
    defaultMode: "catalog_only",
    requiresResearchGate: true,
    spicy: true,
  },
  {
    id: "cl4r1t4s",
    name: "CL4R1T4S",
    tier: "research",
    github: "https://github.com/elder-plinius/CL4R1T4S",
    description: "Extracted system-prompt transparency corpus for AI labs/agents.",
    integration: "Catalog + gated preview for authorized research / control comparison.",
    defaultMode: "catalog_only",
    requiresResearchGate: true,
    spicy: true,
  },
  {
    id: "l1b3rt4s",
    name: "L1B3RT4S",
    tier: "research",
    github: "https://github.com/elder-plinius/L1B3RT4S",
    description: "Jailbreak / liberation prompt packs (high dual-use).",
    integration:
      "OFF by default. Catalog metadata + receipt-gated truncated preview. Never mission-auto.",
    defaultMode: "catalog_only",
    requiresResearchGate: true,
    spicy: true,
  },
  {
    id: "obliteratus",
    name: "OBLITERATUS",
    tier: "research",
    github: "https://github.com/elder-plinius/OBLITERATUS",
    description: "Abliteration / refusal-direction research toolkit for local models.",
    integration:
      "Catalog + docs browse only. Model mutation CLI is blocked unless research receipt.",
    defaultMode: "catalog_only",
    requiresResearchGate: true,
    spicy: true,
  },
];

export function getPliniusLibrary(id: PliniusLibId): PliniusLibraryMeta | undefined {
  return PLINIUS_LIBRARIES.find((l) => l.id === id);
}

export function listPliniusStatus() {
  return PLINIUS_LIBRARIES.map((lib) => {
    const present = pliniusLibPresent(lib.id);
    return {
      ...lib,
      present,
      path: pliniusLibRoot(lib.id),
      status: present ? ("installed" as const) : ("missing_optional_clone" as const),
    };
  });
}

export const RESEARCH_LIB_IDS: PliniusLibId[] = [
  "g0dm0d3",
  "cl4r1t4s",
  "l1b3rt4s",
  "obliteratus",
];

export const PRODUCTION_LIB_IDS: PliniusLibId[] = ["t3mp3st", "st3gg"];

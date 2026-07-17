/**
 * Operator definitions + kill-chain phase templates.
 */

import type { MissionPhase, OperatorRole } from "@/lib/types";
import { uid } from "@/lib/utils";
import { buildDoctrinePrompt } from "@/lib/doctrine/plinian";
import { loadoutPromptBlock } from "@/loadouts/registry";
import { tempestArchetypePromptBlock } from "@/plinius/t3mp3st/adapter";

export const OPERATOR_META: Record<
  OperatorRole,
  { label: string; glyph: string; color: string; description: string }
> = {
  coordinator: {
    label: "Coordinator",
    glyph: "⌘",
    color: "#f59e0b",
    description: "Mission orchestration & phase control",
  },
  recon: {
    label: "Recon",
    glyph: "◉",
    color: "#38bdf8",
    description: "Asset & stack discovery",
  },
  scanner: {
    label: "Scanner",
    glyph: "▣",
    color: "#a78bfa",
    description: "Vuln & misconfig survey",
  },
  exploiter: {
    label: "Exploiter",
    glyph: "⚡",
    color: "#fb7185",
    description: "Gated PoC validation",
  },
  infiltrator: {
    label: "Infiltrator",
    glyph: "⇢",
    color: "#34d399",
    description: "Lateral path modeling",
  },
  exfiltrator: {
    label: "Exfiltrator",
    glyph: "⇪",
    color: "#f472b6",
    description: "Exfil & stego path testing",
  },
  ghost: {
    label: "Ghost",
    glyph: "◌",
    color: "#94a3b8",
    description: "OPSEC & detection gaps",
  },
  analyst: {
    label: "Analyst",
    glyph: "☰",
    color: "#2dd4bf",
    description: "Evidence → findings",
  },
};

export function operatorSystemPrompt(role: OperatorRole, loadouts: string[]): string {
  const tempest = tempestArchetypePromptBlock(role);
  return `${buildDoctrinePrompt(role, loadouts)}\n\n${loadoutPromptBlock(loadouts)}${
    tempest ? `\n\n${tempest}` : ""
  }`;
}

/** Default kill-chain phases for Cisco+Splunk missions. */
export function defaultPhases(): MissionPhase[] {
  const mk = (name: string, operatorRole: OperatorRole): MissionPhase => ({
    id: uid("ph"),
    name,
    operatorRole,
    status: "pending",
  });
  return [
    mk("Coordinate & scope lock", "coordinator"),
    mk("Stack reconnaissance", "recon"),
    mk("Vulnerability & misconfig scan", "scanner"),
    mk("Detection / OPSEC gap analysis", "ghost"),
    mk("Exfil channel (stego) assessment", "exfiltrator"),
    mk("Evidence synthesis & findings", "analyst"),
  ];
}

export const ALL_ROLES: OperatorRole[] = [
  "coordinator",
  "recon",
  "scanner",
  "exploiter",
  "infiltrator",
  "exfiltrator",
  "ghost",
  "analyst",
];

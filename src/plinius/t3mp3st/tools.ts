/**
 * Arsenal tools for T3MP3ST mission/operator bridge.
 */

import type { ToolDefinition } from "@/lib/types";
import {
  TEMPEST_ARCHETYPES,
  tempestArchetypePromptBlock,
  tempestDefaultRoE,
  tempestHealth,
  tempestKillChainPhases,
  tempestStrictRoE,
} from "@/plinius/t3mp3st/adapter";
import type { OperatorRole } from "@/lib/types";

export const t3mp3stTools: ToolDefinition[] = [
  {
    id: "t3mp3st.health",
    name: "T3MP3ST Health",
    description: "Verify optional T3MP3ST clone presence and bridge readiness.",
    vendor: "plinius",
    category: "mission",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {},
  },
  {
    id: "t3mp3st.profiles",
    name: "T3MP3ST Operator Profiles",
    description: "List bridged operator archetypes (MITRE + suggested ZERODAY tools).",
    vendor: "plinius",
    category: "mission",
    mode: "safe_local",
    roles: ["coordinator", "analyst", "recon"],
    parameters: {
      role: { type: "string", description: "Optional OperatorRole filter" },
    },
  },
  {
    id: "t3mp3st.roe",
    name: "T3MP3ST Rules of Engagement",
    description: "Return default or strict RoE profiles bridged from T3MP3ST.",
    vendor: "plinius",
    category: "mission",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {
      profile: { type: "string", description: "default|strict", default: "default" },
    },
  },
  {
    id: "t3mp3st.map_phases",
    name: "T3MP3ST Kill-Chain Phases",
    description: "Generate MissionPhase[] mapped from T3MP3ST kill-chain order.",
    vendor: "plinius",
    category: "mission",
    mode: "safe_local",
    roles: ["coordinator"],
    parameters: {},
  },
  {
    id: "t3mp3st.prompt_block",
    name: "T3MP3ST Archetype Prompt Block",
    description: "Operator system-prompt fragment from T3MP3ST archetype bridge.",
    vendor: "plinius",
    category: "mission",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {
      role: { type: "string", description: "OperatorRole", required: true },
    },
  },
];

export async function runT3mp3stTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "t3mp3st.health": {
      const health = tempestHealth();
      return {
        summary: health.ready ? "T3MP3ST clone ready" : "T3MP3ST clone missing/incomplete",
        data: health as unknown as Record<string, unknown>,
      };
    }
    case "t3mp3st.profiles": {
      const role = args.role ? String(args.role) : null;
      const profiles = role
        ? TEMPEST_ARCHETYPES.filter((p) => p.role === role)
        : TEMPEST_ARCHETYPES;
      return {
        summary: `${profiles.length} T3MP3ST archetypes bridged`,
        data: { profiles },
      };
    }
    case "t3mp3st.roe": {
      const profile = String(args.profile || "default");
      const roe = profile === "strict" ? tempestStrictRoE() : tempestDefaultRoE();
      return { summary: `T3MP3ST RoE (${roe.profile})`, data: { roe } };
    }
    case "t3mp3st.map_phases": {
      const phases = tempestKillChainPhases();
      return {
        summary: `Mapped ${phases.length} kill-chain phases from T3MP3ST`,
        data: { phases },
      };
    }
    case "t3mp3st.prompt_block": {
      const role = String(args.role) as OperatorRole;
      const block = tempestArchetypePromptBlock(role);
      return {
        summary: `Prompt block for ${role}`,
        data: { role, block },
      };
    }
    default:
      throw new Error(`Unhandled T3MP3ST tool ${toolId}`);
  }
}

/**
 * Optional MCP-shaped tool catalog for agent compatibility.
 * Exposes ZERODAY capabilities as structured tool descriptors.
 */

import { listTools } from "@/arsenal/registry";
import { listLoadouts } from "@/loadouts/registry";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Tools an MCP host can advertise for ZERODAY. */
export function mcpToolCatalog(): McpToolDescriptor[] {
  const arsenal = listTools().map((t) => ({
    name: `zeroday_${t.id.replace(/\./g, "_")}`,
    description: `[${t.mode}] ${t.description}`,
    inputSchema: {
      type: "object",
      properties: {
        missionId: { type: "string" },
        ...Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [
            k,
            { type: v.type, description: v.description },
          ])
        ),
      },
      required: [
        "missionId",
        ...Object.entries(t.parameters)
          .filter(([, v]) => v.required)
          .map(([k]) => k),
      ],
    },
  }));

  return [
    {
      name: "zeroday_list_missions",
      description: "List ZERODAY missions in the Evidence Vault store",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "zeroday_launch_mission",
      description: "Create a mission from a natural-language brief under Plinian Doctrine",
      inputSchema: {
        type: "object",
        properties: {
          brief: { type: "string", description: "Natural language engagement brief" },
        },
        required: ["brief"],
      },
    },
    {
      name: "zeroday_list_loadouts",
      description: "List vendor loadouts (Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS)",
      inputSchema: { type: "object", properties: {} },
    },
    ...arsenal,
  ];
}

export function mcpServerInfo() {
  return {
    name: "zeroday",
    version: "0.1.0",
    doctrine: "Scope + Authorization + Evidence + Retest",
    loadouts: listLoadouts().map((l) => l.id),
    tools: mcpToolCatalog().length,
  };
}

/**
 * Arsenal tools for optional research libraries (gated).
 */

import type { AppSettings, ToolDefinition } from "@/lib/types";
import { dbRepo } from "@/lib/db/repo";
import type { PliniusLibId } from "@/plinius/paths";
import {
  attemptResearchExecution,
  listResearchCatalog,
  listResearchFiles,
  previewResearchFile,
  researchLibraryReadme,
} from "@/plinius/research/catalog";
import { researchGateSummary } from "@/plinius/gates";

export const researchTools: ToolDefinition[] = [
  {
    id: "research.gates",
    name: "Research Gate Status",
    description: "Show research-library safety gate configuration (defaults OFF).",
    vendor: "plinius",
    category: "research",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {},
  },
  {
    id: "research.catalog",
    name: "Research Library Catalog",
    description: "List G0DM0D3 / CL4R1T4S / L1B3RT4S / OBLITERATUS gate status.",
    vendor: "plinius",
    category: "research",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {
      missionId: { type: "string", description: "Mission for audit trail" },
    },
  },
  {
    id: "research.list",
    name: "Research Library List Files",
    description: "List files in an enabled research library (catalog gate).",
    vendor: "plinius",
    category: "research",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {
      libraryId: {
        type: "string",
        description: "g0dm0d3|cl4r1t4s|l1b3rt4s|obliteratus",
        required: true,
      },
      prefix: { type: "string", description: "Optional path prefix" },
      missionId: { type: "string", description: "Mission for audit trail" },
    },
  },
  {
    id: "research.preview",
    name: "Research File Preview",
    description: "Truncated preview of a research file (content gate + receipt for spicy libs).",
    vendor: "plinius",
    category: "research",
    mode: "receipt_required",
    roles: ["coordinator", "analyst"],
    spicy: true,
    parameters: {
      libraryId: { type: "string", description: "Research library id", required: true },
      relPath: { type: "string", description: "Relative path within library", required: true },
      missionId: { type: "string", description: "Mission for audit trail" },
    },
  },
  {
    id: "research.readme",
    name: "Research Library README",
    description: "Truncated upstream README (still requires catalog gate).",
    vendor: "plinius",
    category: "research",
    mode: "safe_local",
    roles: ["coordinator", "analyst"],
    parameters: {
      libraryId: { type: "string", description: "Research library id", required: true },
    },
  },
  {
    id: "research.execute",
    name: "Research Execute (blocked)",
    description:
      "Acknowledges receipt but refuses in-process dual-use execution — out-of-band lab only.",
    vendor: "plinius",
    category: "research",
    mode: "receipt_required",
    roles: ["coordinator"],
    spicy: true,
    parameters: {
      libraryId: { type: "string", description: "Research library id", required: true },
      command: { type: "string", description: "Requested command (will not run in-process)", required: true },
      missionId: { type: "string", description: "Mission for audit trail" },
    },
  },
];

function settings(): AppSettings {
  return dbRepo.getSettings();
}

export async function runResearchTool(
  toolId: string,
  args: Record<string, unknown>,
  opts?: { hasReceipt?: boolean }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const s = settings();
  switch (toolId) {
    case "research.gates": {
      const summary = researchGateSummary(s);
      return {
        summary: summary.enabled ? "Research libraries ENABLED" : "Research libraries OFF (default)",
        data: summary as unknown as Record<string, unknown>,
      };
    }
    case "research.catalog": {
      const catalog = listResearchCatalog(s, args.missionId ? String(args.missionId) : undefined);
      return {
        summary: `Research catalog: ${catalog.filter((c) => c.browseable).length}/${catalog.length} browseable`,
        data: { catalog },
      };
    }
    case "research.list": {
      const result = listResearchFiles(s, String(args.libraryId) as PliniusLibId, {
        missionId: args.missionId ? String(args.missionId) : undefined,
        prefix: args.prefix ? String(args.prefix) : undefined,
      });
      return {
        summary: result.ok
          ? `Listed ${result.files.length} files in ${args.libraryId}`
          : result.gate.reason || "List denied",
        data: result as unknown as Record<string, unknown>,
      };
    }
    case "research.preview": {
      const result = previewResearchFile(
        s,
        String(args.libraryId) as PliniusLibId,
        String(args.relPath),
        {
          missionId: args.missionId ? String(args.missionId) : undefined,
          hasReceipt: opts?.hasReceipt,
        }
      );
      return {
        summary: result.ok
          ? `Preview ${args.relPath}`
          : result.gate.reason || "Preview denied",
        data: result as unknown as Record<string, unknown>,
      };
    }
    case "research.readme": {
      const libId = String(args.libraryId) as PliniusLibId;
      const catalog = listResearchCatalog(s);
      const entry = catalog.find((c) => c.id === libId);
      if (!entry?.browseable) {
        return {
          summary: entry?.gate.reason || "README denied",
          data: { ok: false, gate: entry?.gate },
        };
      }
      const readme = researchLibraryReadme(libId);
      return {
        summary: readme ? `README for ${libId}` : `No README for ${libId}`,
        data: { ok: Boolean(readme), readme },
      };
    }
    case "research.execute": {
      const result = attemptResearchExecution(
        s,
        String(args.libraryId) as PliniusLibId,
        String(args.command),
        {
          missionId: args.missionId ? String(args.missionId) : undefined,
          hasReceipt: opts?.hasReceipt,
        }
      );
      return {
        summary: result.gate.reason || "Execution policy response",
        data: result as unknown as Record<string, unknown>,
      };
    }
    default:
      throw new Error(`Unhandled research tool ${toolId}`);
  }
}

/**
 * Arsenal tool definitions for ST3GG (real stego).
 */

import type { ToolDefinition } from "@/lib/types";
import {
  st3ggAnalyze,
  st3ggCapacity,
  st3ggCryptoStatus,
  st3ggDecode,
  st3ggDemoImage,
  st3ggDetect,
  st3ggEncode,
  st3ggListTools,
  st3ggReadChunks,
  st3ggStatus,
} from "@/plinius/st3gg/adapter";

export const st3ggTools: ToolDefinition[] = [
  {
    id: "st3gg.status",
    name: "ST3GG Status",
    description: "Check optional ST3GG clone + Python/Pillow runtime readiness.",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost", "analyst", "coordinator"],
    parameters: {},
  },
  {
    id: "st3gg.analyze",
    name: "ST3GG Analyze",
    description: "Analyze an image for steganography indicators (sandboxed path).",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost", "analyst"],
    parameters: {
      imagePath: {
        type: "string",
        description: "Path under data/st3gg/workspace or vendor/plinius/st3gg/examples",
        required: false,
      },
      full: { type: "boolean", description: "Full analysis pass", default: false },
      useDemo: { type: "boolean", description: "Use ST3GG banner example", default: true },
    },
  },
  {
    id: "st3gg.detect",
    name: "ST3GG Detect",
    description: "Quick STEG header detection on a sandboxed image.",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost", "analyst"],
    parameters: {
      imagePath: { type: "string", description: "Sandboxed image path", required: false },
      useDemo: { type: "boolean", description: "Use demo banner", default: true },
    },
  },
  {
    id: "st3gg.capacity",
    name: "ST3GG Capacity",
    description: "Calculate LSB capacity for a carrier image.",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "analyst"],
    parameters: {
      imagePath: { type: "string", description: "Sandboxed image path", required: false },
      channels: { type: "string", description: "Channel preset", default: "RGB" },
      bits: { type: "number", description: "Bits per channel", default: 1 },
      useDemo: { type: "boolean", description: "Use demo banner when imagePath omitted", default: true },
    },
  },
  {
    id: "st3gg.encode",
    name: "ST3GG Encode",
    description: "Encode text into an image (receipt required — dual-use).",
    vendor: "plinius",
    category: "stego",
    mode: "receipt_required",
    spicy: true,
    roles: ["exfiltrator", "ghost"],
    parameters: {
      imagePath: { type: "string", description: "Carrier image (sandbox)", required: true },
      text: { type: "string", description: "Payload text", required: true },
      outputName: { type: "string", description: "Output filename in workspace" },
      channels: { type: "string", description: "Channel preset", default: "RGB" },
      bits: { type: "number", description: "Bits per channel", default: 1 },
      password: { type: "string", description: "Optional password (redacted in evidence)" },
    },
  },
  {
    id: "st3gg.decode",
    name: "ST3GG Decode",
    description: "Decode hidden data from an image (receipt required).",
    vendor: "plinius",
    category: "stego",
    mode: "receipt_required",
    spicy: true,
    roles: ["exfiltrator", "ghost", "analyst"],
    parameters: {
      imagePath: { type: "string", description: "Encoded image (sandbox)", required: true },
      password: { type: "string", description: "Optional password" },
      noAuto: { type: "boolean", description: "Disable auto-detect decode", default: false },
    },
  },
  {
    id: "st3gg.read_chunks",
    name: "ST3GG Read PNG Chunks",
    description: "Read PNG text/private chunks from a sandboxed image.",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["analyst", "exfiltrator"],
    parameters: {
      imagePath: { type: "string", description: "Sandboxed PNG path", required: true },
    },
  },
  {
    id: "st3gg.list_tools",
    name: "ST3GG List Analysis Tools",
    description: "List ST3GG analysis-tool actions.",
    vendor: "plinius",
    category: "stego",
    mode: "safe_local",
    roles: ["analyst", "coordinator"],
    parameters: {},
  },
];

function resolveImage(args: Record<string, unknown>): string {
  if (args.imagePath) return String(args.imagePath);
  if (args.useDemo !== false) return st3ggDemoImage();
  throw new Error("imagePath required (or set useDemo=true)");
}

export async function runSt3ggTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "st3gg.status": {
      const status = await st3ggStatus();
      return {
        summary: status.ready
          ? "ST3GG ready"
          : `ST3GG not ready: ${status.hint || "check optional clone/deps"}`,
        data: status as unknown as Record<string, unknown>,
      };
    }
    case "st3gg.analyze": {
      const result = await st3ggAnalyze(resolveImage(args), Boolean(args.full));
      return {
        summary: result.ok ? "ST3GG analyze complete" : `ST3GG analyze failed: ${result.error}`,
        data: { result },
      };
    }
    case "st3gg.detect": {
      const result = await st3ggDetect(resolveImage(args));
      return {
        summary: result.ok ? "ST3GG detect complete" : `ST3GG detect failed: ${result.error}`,
        data: { result },
      };
    }
    case "st3gg.capacity": {
      const result = await st3ggCapacity(
        resolveImage(args),
        String(args.channels || "RGB"),
        Number(args.bits ?? 1)
      );
      return {
        summary: result.ok ? "ST3GG capacity calculated" : `ST3GG capacity failed: ${result.error}`,
        data: { result },
      };
    }
    case "st3gg.encode": {
      const result = await st3ggEncode({
        imagePath: String(args.imagePath),
        text: String(args.text),
        outputName: args.outputName ? String(args.outputName) : undefined,
        channels: args.channels ? String(args.channels) : undefined,
        bits: args.bits !== undefined ? Number(args.bits) : undefined,
        password: args.password ? String(args.password) : undefined,
      });
      return {
        summary: result.ok
          ? `ST3GG encoded → ${result.outputPath}`
          : `ST3GG encode failed: ${result.error}`,
        data: {
          result: {
            ...result,
            // never echo password
            args: { imagePath: args.imagePath, outputPath: result.outputPath },
          },
        },
      };
    }
    case "st3gg.decode": {
      const result = await st3ggDecode({
        imagePath: String(args.imagePath),
        password: args.password ? String(args.password) : undefined,
        noAuto: Boolean(args.noAuto),
      });
      return {
        summary: result.ok ? "ST3GG decode complete" : `ST3GG decode failed: ${result.error}`,
        data: { result },
      };
    }
    case "st3gg.read_chunks": {
      const result = await st3ggReadChunks(String(args.imagePath));
      return {
        summary: result.ok ? "ST3GG chunks read" : `ST3GG read-chunks failed: ${result.error}`,
        data: { result },
      };
    }
    case "st3gg.list_tools": {
      const [tools, crypto] = await Promise.all([st3ggListTools(), st3ggCryptoStatus()]);
      return {
        summary: "ST3GG tool catalog",
        data: { tools, crypto },
      };
    }
    default:
      throw new Error(`Unhandled ST3GG tool ${toolId}`);
  }
}

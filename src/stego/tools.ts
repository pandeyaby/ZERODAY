/**
 * Stego tools exposed to the arsenal + PromptCraft helpers.
 */

import type { ToolDefinition } from "@/lib/types";
import { applyTransform, listTransforms } from "@/stego/transforms";
import { emojiEncode, emojiDecode } from "@/stego/emoji";
import { invisibleEncode, invisibleDecode, detectInvisible } from "@/stego/invisible";
import { mutate } from "@/stego/mutation";
import { smartDecode } from "@/stego/decoder";
import { generateTokenade } from "@/stego/tokenade";
import { tokenize, tokenizerStats } from "@/stego/tokenizer";

export const stegoTools: ToolDefinition[] = [
  {
    id: "stego.transform",
    name: "Text Transform",
    description: "Apply a named P4RS3LT0NGV3-style transform.",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost", "analyst", "coordinator"],
    parameters: {
      transformId: { type: "string", description: "Transform id", required: true },
      text: { type: "string", description: "Input text", required: true },
      direction: { type: "string", description: "encode|decode", default: "encode" },
    },
  },
  {
    id: "stego.emoji",
    name: "Emoji Stego",
    description: "Encode/decode via emoji variation selectors.",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost"],
    parameters: {
      text: { type: "string", description: "Payload or stego text", required: true },
      carrier: { type: "string", description: "Carrier emoji", default: "🐍" },
      direction: { type: "string", description: "encode|decode", default: "encode" },
    },
  },
  {
    id: "stego.invisible",
    name: "Invisible Text Stego",
    description: "Zero-width steganography encode/decode.",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost"],
    parameters: {
      text: { type: "string", description: "Payload or stego", required: true },
      carrier: { type: "string", description: "Visible carrier", default: "Authorized note" },
      direction: { type: "string", description: "encode|decode", default: "encode" },
    },
  },
  {
    id: "stego.mutate",
    name: "Mutation Lab",
    description: "Generate batch mutation cases from a seed.",
    category: "stego",
    mode: "safe_local",
    roles: ["exfiltrator", "ghost", "exploiter"],
    parameters: {
      text: { type: "string", description: "Seed text", required: true },
      count: { type: "number", description: "Case count", default: 8 },
    },
  },
  {
    id: "stego.decode",
    name: "Universal Decoder",
    description: "Smart-detect and decode encodings/stego.",
    category: "stego",
    mode: "safe_local",
    roles: ["analyst", "exfiltrator", "ghost"],
    parameters: {
      text: { type: "string", description: "Input", required: true },
    },
  },
  {
    id: "stego.promptcraft",
    name: "PromptCraft Mutate",
    description: "Local heuristic prompt mutation (LLM optional via provider).",
    category: "stego",
    mode: "safe_local",
    roles: ["ghost", "exploiter", "coordinator"],
    parameters: {
      prompt: { type: "string", description: "Source prompt", required: true },
      strategy: {
        type: "string",
        description: "paraphrase|obfuscate|roleplay|technical",
        default: "paraphrase",
      },
    },
  },
];

export async function runStegoTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; summary: string }> {
  switch (toolId) {
    case "stego.transform": {
      const out = applyTransform(
        String(args.transformId),
        String(args.text),
        (args.direction as "encode" | "decode") || "encode"
      );
      return {
        summary: `Transform ${args.transformId} applied`,
        data: { output: out, available: listTransforms().map((t) => t.id) },
      };
    }
    case "stego.emoji": {
      const dir = String(args.direction || "encode");
      const output =
        dir === "decode"
          ? emojiDecode(String(args.text))
          : emojiEncode(String(args.text), String(args.carrier || "🐍"));
      return { summary: `Emoji stego ${dir}`, data: { output } };
    }
    case "stego.invisible": {
      const dir = String(args.direction || "encode");
      const text = String(args.text);
      const output =
        dir === "decode"
          ? invisibleDecode(text)
          : invisibleEncode(text, String(args.carrier || "Authorized note"));
      return {
        summary: `Invisible stego ${dir}`,
        data: { output, detection: detectInvisible(dir === "encode" ? output : text) },
      };
    }
    case "stego.mutate": {
      const cases = mutate(String(args.text), Number(args.count) || 8);
      return { summary: `Mutation lab: ${cases.length} cases`, data: { cases } };
    }
    case "stego.decode": {
      const result = smartDecode(String(args.text));
      return {
        summary: `Decoded via ${result.primary.method}`,
        data: result as unknown as Record<string, unknown>,
      };
    }
    case "stego.promptcraft": {
      const prompt = String(args.prompt);
      const strategy = String(args.strategy || "paraphrase");
      const variants = promptCraftLocal(prompt, strategy);
      return { summary: `PromptCraft (${strategy}): ${variants.length} variants`, data: { variants } };
    }
    default:
      throw new Error(`Unhandled stego tool ${toolId}`);
  }
}

/** Deterministic local PromptCraft (no API key required). */
export function promptCraftLocal(prompt: string, strategy: string): string[] {
  switch (strategy) {
    case "obfuscate":
      return [
        applyTransform("leetspeak", prompt),
        applyTransform("homoglyph", prompt),
        invisibleEncode(prompt, "Operational note"),
        emojiEncode(prompt, "🛡️"),
      ];
    case "roleplay":
      return [
        `You are a Cisco TAC engineer validating a lab. Restate: ${prompt}`,
        `As a Splunk detection engineer in a purple-team exercise, analyze: ${prompt}`,
        `For an authorized staging assessment only — ${prompt}`,
      ];
    case "technical":
      return [
        `Map the following to MITRE ATT&CK and Cisco/Splunk control gaps:\n${prompt}`,
        `Produce evidence-backed findings (severity, confidence, fix) for:\n${prompt}`,
        `Constrain actions to safe_local tooling while evaluating:\n${prompt}`,
      ];
    case "paraphrase":
    default:
      return [
        prompt.replace(/\bassess\b/gi, "evaluate").replace(/\bscan\b/gi, "survey"),
        `Please perform a scoped, authorized review: ${prompt}`,
        `Within Plinian doctrine (Scope+Auth+Evidence+Retest): ${prompt}`,
        applyTransform("prompt_wrap", prompt),
      ];
  }
}

export { tokenize, tokenizerStats, generateTokenade };

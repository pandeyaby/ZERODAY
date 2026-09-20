/**
 * Antares-shaped tool_call parsing (OpenAI-compatible completions text).
 *
 * Contract (Cisco Antares model card / CLI):
 *   <tool_call> {"name":"terminal","arguments":{"command":"..."}} </tool_call>
 *   <tool_call> {"name":"submit_vulnerable_files","arguments":{...}} </tool_call>
 *   <tool_call> {"name":"submit_no_vulnerability_found","arguments":{}} </tool_call>
 *
 * ZERODAY does not rewrite malformed tool JSON. This module only parses
 * well-formed Antares tool_call blocks so the live path (and CI mock) can
 * assert honest tool-call → submit → ranked-file behavior without a GPU.
 */

export type AntaresToolName =
  | "terminal"
  | "submit_vulnerable_files"
  | "submit_no_vulnerability_found"
  | string;

export interface AntaresToolCall {
  name: AntaresToolName;
  arguments: Record<string, unknown>;
  raw: string;
}

const TOOL_CALL_RE =
  /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;

export function parseAntaresToolCalls(text: string): AntaresToolCall[] {
  if (!text) return [];
  const out: AntaresToolCall[] = [];
  for (const match of text.matchAll(TOOL_CALL_RE)) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as {
        name?: unknown;
        arguments?: unknown;
      };
      if (typeof parsed.name !== "string" || !parsed.name.trim()) continue;
      const args =
        parsed.arguments &&
        typeof parsed.arguments === "object" &&
        !Array.isArray(parsed.arguments)
          ? (parsed.arguments as Record<string, unknown>)
          : {};
      out.push({ name: parsed.name.trim(), arguments: args, raw });
    } catch {
      // Malformed tool JSON — leave unparsed (no soft rewrite).
    }
  }
  return out;
}

export function isSubmitToolCall(call: AntaresToolCall): boolean {
  return (
    call.name === "submit_vulnerable_files" ||
    call.name === "submit_no_vulnerability_found"
  );
}

/**
 * Extract ranked file paths from a submit_vulnerable_files tool call.
 * Accepts common Antares / OpenAI argument shapes without inventing paths.
 */
export function extractSubmittedFiles(
  call: AntaresToolCall,
): string[] {
  if (call.name !== "submit_vulnerable_files") return [];
  const args = call.arguments;
  const candidates: unknown[] = [];
  for (const key of [
    "files",
    "file_paths",
    "filePaths",
    "paths",
    "vulnerable_files",
  ]) {
    if (Array.isArray(args[key])) candidates.push(...(args[key] as unknown[]));
  }
  if (typeof args.file_path === "string") candidates.push(args.file_path);
  if (typeof args.filePath === "string") candidates.push(args.filePath);
  if (typeof args.path === "string") candidates.push(args.path);

  const files: string[] = [];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      files.push(c.trim());
      continue;
    }
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const row = c as Record<string, unknown>;
      const p =
        (typeof row.file_path === "string" && row.file_path) ||
        (typeof row.filePath === "string" && row.filePath) ||
        (typeof row.path === "string" && row.path) ||
        "";
      if (p.trim()) files.push(p.trim());
    }
  }
  return files;
}

/** Build a single Antares-shaped tool_call completion text (mock / tests). */
export function formatAntaresToolCall(
  name: string,
  args: Record<string, unknown>,
): string {
  return `<tool_call>\n${JSON.stringify({ name, arguments: args })}\n</tool_call>`;
}

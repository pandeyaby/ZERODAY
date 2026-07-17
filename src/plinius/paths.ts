/**
 * Resolve optional Plinius clone roots under vendor/plinius/.
 */

import fs from "fs";
import path from "path";

export type PliniusLibId =
  | "t3mp3st"
  | "st3gg"
  | "g0dm0d3"
  | "cl4r1t4s"
  | "l1b3rt4s"
  | "obliteratus";

const VENDOR_ROOT = path.join(process.cwd(), "vendor", "plinius");

const LIB_DIRS: Record<PliniusLibId, string> = {
  t3mp3st: "t3mp3st",
  st3gg: "st3gg",
  g0dm0d3: "g0dm0d3",
  cl4r1t4s: "cl4r1t4s",
  l1b3rt4s: "l1b3rt4s",
  obliteratus: "obliteratus",
};

export function pliniusVendorRoot(): string {
  return VENDOR_ROOT;
}

export function pliniusLibRoot(id: PliniusLibId): string {
  return path.join(VENDOR_ROOT, LIB_DIRS[id]);
}

export function pliniusLibPresent(id: PliniusLibId): boolean {
  try {
    const root = pliniusLibRoot(id);
    return fs.existsSync(root) && fs.statSync(root).isDirectory() && fs.readdirSync(root).length > 0;
  } catch {
    return false;
  }
}

export function st3ggCliPath(): string {
  return path.join(pliniusLibRoot("st3gg"), "stegg_cli.py");
}

export function st3ggWorkspaceDir(): string {
  const dir =
    process.env.ZERODAY_ST3GG_WORKSPACE ||
    path.join(process.env.ZERODAY_DATA_DIR || path.join(process.cwd(), "data"), "st3gg", "workspace");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function st3ggExamplesDir(): string {
  return path.join(pliniusLibRoot("st3gg"), "examples");
}

/**
 * Resolve a user-supplied path against allowed roots (workspace + ST3GG examples).
 * Rejects path traversal outside sandboxes.
 */
export function resolveSandboxedPath(
  input: string,
  opts?: { allowExamples?: boolean; mustExist?: boolean }
): { ok: true; path: string } | { ok: false; error: string } {
  const allowExamples = opts?.allowExamples !== false;
  const roots = [st3ggWorkspaceDir()];
  if (allowExamples) roots.push(st3ggExamplesDir());

  const expanded = input.startsWith("~")
    ? path.join(process.env.HOME || "", input.slice(1))
    : input;
  const abs = path.resolve(expanded);

  const allowed = roots.some((root) => {
    const r = path.resolve(root);
    return abs === r || abs.startsWith(r + path.sep);
  });
  if (!allowed) {
    return {
      ok: false,
      error: `Path not in ST3GG sandbox (workspace or vendor examples): ${input}`,
    };
  }
  if (opts?.mustExist && !fs.existsSync(abs)) {
    return { ok: false, error: `File not found: ${abs}` };
  }
  return { ok: true, path: abs };
}

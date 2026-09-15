/**
 * UI path sandbox — only allow paths under configured workspace roots.
 * Default roots: process.cwd() + optional env ZERODAY_UI_ROOTS
 * (colon / semicolon / comma separated). Rejects .. escape and FS escape.
 */

import fs from "node:fs";
import path from "node:path";

export class PathPolicyError extends Error {
  readonly code = "PATH_POLICY" as const;
  constructor(message: string) {
    super(message);
    this.name = "PathPolicyError";
  }
}

export function parseUiRootsEnv(raw?: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[:;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedRoots(options?: {
  cwd?: string;
  envRoots?: string | null;
}): string[] {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const env =
    options?.envRoots !== undefined
      ? options.envRoots
      : process.env.ZERODAY_UI_ROOTS;
  const extras = parseUiRootsEnv(env).map((p) => path.resolve(p));
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const r of [cwd, ...extras]) {
    const n = path.resolve(r);
    if (!seen.has(n)) {
      seen.add(n);
      roots.push(n);
    }
  }
  return roots;
}

function realIfExists(p: string): string {
  try {
    if (fs.existsSync(p)) return fs.realpathSync(p);
  } catch {
    /* fall through */
  }
  return path.resolve(p);
}

/** True when absPath is the root itself or a descendant (after normalize). */
export function isInsideRoot(absPath: string, root: string): boolean {
  const target = path.resolve(absPath);
  const base = path.resolve(root);
  const rel = path.relative(base, target);
  if (rel === "") return true;
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return true;
}

export interface AssertPathOptions {
  cwd?: string;
  envRoots?: string | null;
  roots?: string[];
  /** When true, path must already exist on disk. */
  mustExist?: boolean;
  kind?: "file" | "dir" | "any";
  label?: string;
}

/**
 * Resolve and assert a user-supplied path stays inside allowed roots.
 * Rejects empty input, null bytes, and paths outside the sandbox.
 */
export function assertPathAllowed(
  input: string,
  options?: AssertPathOptions,
): string {
  const label = options?.label ?? "path";
  if (typeof input !== "string" || !input.trim()) {
    throw new PathPolicyError(`${label}: path is required`);
  }
  if (input.includes("\0")) {
    throw new PathPolicyError(`${label}: null byte rejected`);
  }

  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const trimmed = input.trim();
  const abs = path.resolve(cwd, trimmed);
  const roots =
    options?.roots ??
    getAllowedRoots({ cwd, envRoots: options?.envRoots });

  const checkPath = realIfExists(abs);
  const allowed = roots.some((r) =>
    isInsideRoot(checkPath, realIfExists(r)),
  );
  if (!allowed) {
    throw new PathPolicyError(
      `${label}: path escapes sandbox — must be under allowed roots (${roots.join(", ")})`,
    );
  }

  if (options?.mustExist) {
    if (!fs.existsSync(abs)) {
      throw new PathPolicyError(`${label}: path does not exist: ${abs}`);
    }
    const st = fs.statSync(abs);
    if (options.kind === "file" && !st.isFile()) {
      throw new PathPolicyError(`${label}: expected a file: ${abs}`);
    }
    if (options.kind === "dir" && !st.isDirectory()) {
      throw new PathPolicyError(`${label}: expected a directory: ${abs}`);
    }
  }

  return abs;
}

/** Sandbox an optional output dir; default under cwd/zeroday-reports/<slug>. */
export function resolveOutputDir(
  input: string | undefined,
  slug: string,
  options?: AssertPathOptions,
): string {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const raw =
    input && input.trim()
      ? input.trim()
      : path.join(cwd, "zeroday-reports", slug);
  return assertPathAllowed(raw, {
    ...options,
    cwd,
    label: options?.label ?? "output",
  });
}

/**
 * Optional research libraries — catalog + gated truncated preview.
 * Never auto-executes jailbreak packs or model obliteration.
 */

import fs from "fs";
import path from "path";
import type { AppSettings } from "@/lib/types";
import { auditPliniusAccess } from "@/plinius/audit";
import {
  gateResearchCatalog,
  gateResearchContent,
  gateResearchExecution,
} from "@/plinius/gates";
import { pliniusLibPresent, pliniusLibRoot, type PliniusLibId } from "@/plinius/paths";
import { getPliniusLibrary, RESEARCH_LIB_IDS } from "@/plinius/registry";

const MAX_PREVIEW_BYTES = 4_096;
const MAX_LIST = 200;

const BLOCKED_EXEC_PATTERNS = [
  /obliterat/i,
  /jailbreak/i,
  /motherload/i,
  /\.py$/i,
  /\.sh$/i,
  /\.ipynb$/i,
];

export interface ResearchFileEntry {
  rel: string;
  size: number;
  kind: "file" | "dir";
}

function walkShallow(root: string, max = MAX_LIST): ResearchFileEntry[] {
  const out: ResearchFileEntry[] = [];
  const stack: string[] = [root];
  while (stack.length && out.length < max) {
    const dir = stack.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= max) break;
      if (ent.name.startsWith(".git")) continue;
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs);
      if (ent.isDirectory()) {
        out.push({ rel, size: 0, kind: "dir" });
        // Limit depth — one level of nesting for list, push children
        if (rel.split(path.sep).length < 3) stack.push(abs);
      } else if (ent.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          size = 0;
        }
        out.push({ rel, size, kind: "file" });
      }
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

export function listResearchCatalog(settings: AppSettings, missionId?: string) {
  return RESEARCH_LIB_IDS.map((id) => {
    const meta = getPliniusLibrary(id)!;
    const gate = gateResearchCatalog(settings, id);
    const present = pliniusLibPresent(id);
    if (!gate.allowed) {
      auditPliniusAccess({
        missionId,
        libraryId: id,
        action: "catalog",
        summary: gate.reason || "denied",
        denied: true,
        meta: { code: gate.code },
      });
    }
    return {
      ...meta,
      present,
      path: pliniusLibRoot(id),
      gate,
      browseable: gate.allowed && present,
    };
  });
}

export function listResearchFiles(
  settings: AppSettings,
  libId: PliniusLibId,
  opts?: { missionId?: string; prefix?: string }
) {
  const gate = gateResearchCatalog(settings, libId);
  if (!gate.allowed) {
    auditPliniusAccess({
      missionId: opts?.missionId,
      libraryId: libId,
      action: "list",
      summary: gate.reason || "denied",
      denied: true,
      meta: { code: gate.code },
    });
    return { ok: false as const, gate, files: [] as ResearchFileEntry[] };
  }
  if (!pliniusLibPresent(libId)) {
    return {
      ok: false as const,
      gate: { allowed: false, reason: "Submodule missing" },
      files: [] as ResearchFileEntry[],
    };
  }

  const root = pliniusLibRoot(libId);
  let files = walkShallow(root);
  if (opts?.prefix) {
    const p = opts.prefix.replace(/^\/+/, "");
    files = files.filter((f) => f.rel.startsWith(p));
  }

  auditPliniusAccess({
    missionId: opts?.missionId,
    libraryId: libId,
    action: "list",
    summary: `Listed ${files.length} entries`,
    meta: { count: files.length, prefix: opts?.prefix || null },
  });

  return { ok: true as const, gate, files, root };
}

export function previewResearchFile(
  settings: AppSettings,
  libId: PliniusLibId,
  relPath: string,
  opts?: { missionId?: string; hasReceipt?: boolean }
) {
  const gate = gateResearchContent(settings, libId, { hasReceipt: opts?.hasReceipt });
  if (!gate.allowed) {
    auditPliniusAccess({
      missionId: opts?.missionId,
      libraryId: libId,
      action: "preview",
      summary: gate.reason || "denied",
      denied: true,
      meta: { code: gate.code, relPath },
    });
    return { ok: false as const, gate, preview: null as string | null };
  }

  // Normalize + prevent traversal
  const root = pliniusLibRoot(libId);
  const abs = path.resolve(root, relPath);
  if (!abs.startsWith(path.resolve(root) + path.sep) && abs !== path.resolve(root)) {
    return {
      ok: false as const,
      gate: { allowed: false, reason: "Path traversal blocked" },
      preview: null,
    };
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return {
      ok: false as const,
      gate: { allowed: false, reason: "File not found" },
      preview: null,
    };
  }

  const buf = fs.readFileSync(abs);
  const truncated = buf.length > MAX_PREVIEW_BYTES;
  const slice = buf.subarray(0, MAX_PREVIEW_BYTES);
  // Avoid dumping binary
  const isBinary = slice.includes(0);
  const preview = isBinary
    ? `<binary ${buf.length} bytes; preview suppressed>`
    : slice.toString("utf8");

  auditPliniusAccess({
    missionId: opts?.missionId,
    libraryId: libId,
    action: "preview",
    summary: `Preview ${relPath} (${buf.length} bytes, truncated=${truncated})`,
    meta: {
      relPath,
      bytes: buf.length,
      truncated,
      binary: isBinary,
      receipt: Boolean(opts?.hasReceipt),
    },
  });

  return {
    ok: true as const,
    gate,
    preview,
    meta: {
      relPath,
      bytes: buf.length,
      truncated,
      maxPreviewBytes: MAX_PREVIEW_BYTES,
      binary: isBinary,
    },
  };
}

/** Explicitly blocked — returns gate denial unless research execution + receipt. */
export function attemptResearchExecution(
  settings: AppSettings,
  libId: PliniusLibId,
  command: string,
  opts?: { missionId?: string; hasReceipt?: boolean }
) {
  const gate = gateResearchExecution(settings, libId, { hasReceipt: opts?.hasReceipt });
  auditPliniusAccess({
    missionId: opts?.missionId,
    libraryId: libId,
    action: "execute",
    summary: gate.allowed
      ? `Execution requested: ${command.slice(0, 120)}`
      : gate.reason || "blocked",
    denied: !gate.allowed,
    meta: { command: command.slice(0, 500), code: gate.code },
  });

  if (!gate.allowed) {
    return { ok: false as const, gate, executed: false };
  }

  // Even when allowed, ZERODAY does not shell out to obliteratus/jailbreak runners.
  // We acknowledge the receipt and return a structured refusal to keep the harness safe.
  const looksDangerous = BLOCKED_EXEC_PATTERNS.some((re) => re.test(command));
  return {
    ok: false as const,
    gate: {
      allowed: false,
      code: "EXECUTION_BLOCKED" as const,
      reason: looksDangerous
        ? "ZERODAY acknowledges the receipt but refuses to execute dual-use research runners in-process. Use the upstream project in an isolated lab VM."
        : "Research execution is catalogued only — run upstream tools out-of-band under your RoE.",
    },
    executed: false,
    policy: "out_of_band_only",
  };
}

export function researchLibraryReadme(libId: PliniusLibId): string | null {
  const root = pliniusLibRoot(libId);
  const candidates = ["README.md", "readme.md", "SECURITY.md"];
  for (const c of candidates) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf8").slice(0, MAX_PREVIEW_BYTES);
    }
  }
  return null;
}

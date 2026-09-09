/**
 * File-based durable evidence vault — SHA-256 hashed, offline-verifiable.
 * Lives under zeroday-reports/<run-id>/evidence/ (not vibes, not SQLite missions).
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface EvidenceEntry {
  id: string;
  kind:
    | "input"
    | "submission"
    | "artifact"
    | "tool_log"
    | "claim"
    | "brief"
    | "schema";
  title: string;
  summary: string;
  /** Relative path under the run directory */
  relativePath: string;
  sha256: string;
  createdAt: string;
  /** Optional parent evidence ids for claim → source linkage */
  cites?: string[];
  tags?: string[];
}

export interface EvidenceManifest {
  schemaVersion: "zeroday-evidence-manifest/v1";
  runId: string;
  createdAt: string;
  updatedAt: string;
  entries: EvidenceEntry[];
  artifacts: Array<{
    name: string;
    relativePath: string;
    sha256: string;
    bytes: number;
  }>;
  posture: {
    localizationOnly: true;
    notExploitProof: true;
    noAutoMerge: true;
    noPoC: true;
    keylessDefault: true;
    offlineVerifiable: true;
  };
}

export function sha256Buffer(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(absPath: string): string {
  return sha256Buffer(fs.readFileSync(absPath));
}

export function evidenceDirFor(runDir: string): string {
  return path.join(runDir, "evidence");
}

export function manifestPathFor(runDir: string): string {
  return path.join(evidenceDirFor(runDir), "manifest.json");
}

export function createEmptyManifest(runId: string): EvidenceManifest {
  const now = new Date().toISOString();
  return {
    schemaVersion: "zeroday-evidence-manifest/v1",
    runId,
    createdAt: now,
    updatedAt: now,
    entries: [],
    artifacts: [],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      keylessDefault: true,
      offlineVerifiable: true,
    },
  };
}

export class EvidenceVault {
  readonly runDir: string;
  readonly evidenceDir: string;
  readonly runId: string;
  private manifest: EvidenceManifest;
  private seq = 0;

  constructor(runDir: string, runId: string) {
    this.runDir = path.resolve(runDir);
    this.runId = runId;
    this.evidenceDir = evidenceDirFor(this.runDir);
    fs.mkdirSync(this.evidenceDir, { recursive: true });
    this.manifest = createEmptyManifest(runId);
  }

  private nextId(kind: string): string {
    this.seq += 1;
    return `ev_${kind}_${String(this.seq).padStart(3, "0")}`;
  }

  /** Write bytes under evidence/ and register an entry. */
  putBlob(
    kind: EvidenceEntry["kind"],
    filename: string,
    content: string | Buffer,
    meta: { title: string; summary: string; cites?: string[]; tags?: string[] },
  ): EvidenceEntry {
    const abs = path.join(this.evidenceDir, filename);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    fs.writeFileSync(abs, buf);
    const relativePath = path.relative(this.runDir, abs).split(path.sep).join("/");
    const entry: EvidenceEntry = {
      id: this.nextId(kind),
      kind,
      title: meta.title,
      summary: meta.summary,
      relativePath,
      sha256: sha256Buffer(buf),
      createdAt: new Date().toISOString(),
      cites: meta.cites,
      tags: meta.tags,
    };
    this.manifest.entries.push(entry);
    this.manifest.updatedAt = entry.createdAt;
    return entry;
  }

  /** Register an already-written artifact outside evidence/ (report.json etc.). */
  registerArtifact(absPath: string, name?: string): EvidenceEntry {
    const rel = path.relative(this.runDir, absPath).split(path.sep).join("/");
    const hash = sha256File(absPath);
    const st = fs.statSync(absPath);
    const display = name || path.basename(absPath);
    this.manifest.artifacts.push({
      name: display,
      relativePath: rel,
      sha256: hash,
      bytes: st.size,
    });
    const entry: EvidenceEntry = {
      id: this.nextId("artifact"),
      kind: "artifact",
      title: display,
      summary: `Run artifact ${display}`,
      relativePath: rel,
      sha256: hash,
      createdAt: new Date().toISOString(),
      tags: ["artifact"],
    };
    this.manifest.entries.push(entry);
    this.manifest.updatedAt = entry.createdAt;
    return entry;
  }

  /** Record a claim that cites evidence ids (for report.md linkage). */
  putClaim(
    title: string,
    summary: string,
    cites: string[],
  ): EvidenceEntry {
    const body = JSON.stringify(
      { title, summary, cites, at: new Date().toISOString() },
      null,
      2,
    );
    return this.putBlob("claim", `claims/${this.seq + 1}-${slug(title)}.json`, body, {
      title,
      summary,
      cites,
      tags: ["claim"],
    });
  }

  flush(): string {
    this.manifest.updatedAt = new Date().toISOString();
    const mp = manifestPathFor(this.runDir);
    fs.writeFileSync(mp, JSON.stringify(this.manifest, null, 2));
    // Self-hash the manifest body without circular self-entry; store beside it
    const hashPath = path.join(this.evidenceDir, "manifest.sha256");
    fs.writeFileSync(hashPath, `${sha256File(mp)}\n`);
    return mp;
  }

  getManifest(): EvidenceManifest {
    return this.manifest;
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "claim";
}

export interface VerifyResult {
  ok: boolean;
  runDir: string;
  checked: number;
  failures: Array<{ path: string; reason: string }>;
  manifest?: EvidenceManifest;
}

/** Offline verify: recompute hashes and check schemaVersion. */
export function verifyRunDir(runDir: string): VerifyResult {
  const abs = path.resolve(runDir);
  const mp = manifestPathFor(abs);
  const failures: Array<{ path: string; reason: string }> = [];
  let checked = 0;

  if (!fs.existsSync(mp)) {
    return {
      ok: false,
      runDir: abs,
      checked: 0,
      failures: [{ path: mp, reason: "manifest.json missing" }],
    };
  }

  let manifest: EvidenceManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(mp, "utf8")) as EvidenceManifest;
  } catch (e) {
    return {
      ok: false,
      runDir: abs,
      checked: 0,
      failures: [{ path: mp, reason: `invalid JSON: ${(e as Error).message}` }],
    };
  }

  if (manifest.schemaVersion !== "zeroday-evidence-manifest/v1") {
    failures.push({
      path: mp,
      reason: `unexpected schemaVersion ${manifest.schemaVersion}`,
    });
  }

  for (const entry of manifest.entries) {
    const file = path.join(abs, entry.relativePath);
    checked += 1;
    if (!fs.existsSync(file)) {
      failures.push({ path: entry.relativePath, reason: "missing file" });
      continue;
    }
    const actual = sha256File(file);
    if (actual !== entry.sha256) {
      failures.push({
        path: entry.relativePath,
        reason: `hash mismatch (expected ${entry.sha256.slice(0, 12)}… got ${actual.slice(0, 12)}…)`,
      });
    }
  }

  for (const art of manifest.artifacts) {
    const file = path.join(abs, art.relativePath);
    checked += 1;
    if (!fs.existsSync(file)) {
      failures.push({ path: art.relativePath, reason: "missing artifact" });
      continue;
    }
    const actual = sha256File(file);
    if (actual !== art.sha256) {
      failures.push({
        path: art.relativePath,
        reason: `artifact hash mismatch`,
      });
    }
  }

  // Required localization artifacts when present in folder
  for (const required of ["report.json", "report.md", "report.sarif"]) {
    const p = path.join(abs, required);
    if (fs.existsSync(p)) {
      checked += 1;
      // Ensure registered in artifacts or entries
      const rel = required;
      const listed =
        manifest.artifacts.some((a) => a.relativePath === rel) ||
        manifest.entries.some((e) => e.relativePath === rel);
      if (!listed) {
        failures.push({
          path: rel,
          reason: "present on disk but not listed in manifest",
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    runDir: abs,
    checked,
    failures,
    manifest,
  };
}

/**
 * OSV advisory records (https://osv.dev) — public advisory metadata only.
 * Only the advisory id is sent; repository source never leaves the machine.
 *
 * Lookup order: $ZERODAY_OSV_DIR (read-only records, e.g. air-gapped mirrors or
 * test fixtures) → local cache (~/.cache/zeroday/osv) → api.osv.dev (unless offline).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OsvRange } from "./versions";

export interface OsvAffected {
  package?: { ecosystem: string; name: string; purl?: string };
  ranges?: OsvRange[];
  versions?: string[];
  ecosystem_specific?: { imports?: Array<{ path: string; symbols?: string[] }> } & Record<string, unknown>;
  database_specific?: Record<string, unknown>;
}

export interface OsvRecord {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  affected?: OsvAffected[];
  references?: Array<{ type: string; url: string }>;
  database_specific?: { cwe_ids?: string[]; severity?: string } & Record<string, unknown>;
}

export interface OsvFetchOptions {
  offline?: boolean;
  /** Test hook / custom client. */
  fetchImpl?: typeof fetch;
}

const OSV_API = "https://api.osv.dev/v1/vulns/";

function cacheDir(): string {
  return path.join(process.env.ZERODAY_CACHE_DIR ?? path.join(os.homedir(), ".cache", "zeroday"), "osv");
}

function safeName(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "_");
}

function readJson(file: string): OsvRecord | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as OsvRecord;
  } catch {
    return null;
  }
}

/** OSV spelling: `GHSA-xxxx-xxxx-xxxx` (lowercase body), `CVE-2021-1234`, `GO-2022-0969`. */
export function canonicalOsvId(id: string): string {
  const t = id.trim();
  const ghsa = /^ghsa-(.+)$/i.exec(t);
  if (ghsa) return `GHSA-${ghsa[1]!.toLowerCase()}`;
  return /^(?:cve|go|pysec|rustsec)-/i.test(t) ? t.toUpperCase() : t;
}

/** Fetch one OSV record by id (GHSA-…, CVE-…, GO-…, PYSEC-…). */
export async function fetchOsvRecord(rawId: string, opts: OsvFetchOptions = {}): Promise<OsvRecord | null> {
  const id = canonicalOsvId(rawId);
  const name = `${safeName(id)}.json`;
  const mirror = process.env.ZERODAY_OSV_DIR;
  if (mirror) {
    const rec = readJson(path.join(mirror, name));
    if (rec) return rec;
  }
  const cached = readJson(path.join(cacheDir(), name));
  if (cached) return cached;
  if (opts.offline || process.env.ZERODAY_OFFLINE === "1") return null;

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(OSV_API + encodeURIComponent(id), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const rec = (await res.json()) as OsvRecord;
    try {
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(path.join(cacheDir(), name), JSON.stringify(rec));
    } catch {
      /* cache is best-effort */
    }
    return rec;
  } catch {
    return null;
  }
}

/**
 * Records that carry package data for an advisory id. A CVE record usually has
 * none itself, so its GHSA / GO / PYSEC aliases are followed.
 */
export async function packageRecords(id: string, opts: OsvFetchOptions = {}): Promise<OsvRecord[]> {
  const root = await fetchOsvRecord(id, opts);
  if (!root) return [];
  const out: OsvRecord[] = [];
  const seen = new Set<string>();
  const add = (r: OsvRecord | null) => {
    if (!r || seen.has(r.id)) return;
    seen.add(r.id);
    if (r.affected?.some((a) => a.package?.ecosystem)) out.push(r);
  };
  add(root);
  for (const alias of root.aliases ?? []) {
    if (!/^(?:GHSA|GO|PYSEC|RUSTSEC)-/i.test(alias)) continue;
    add(await fetchOsvRecord(alias, opts));
  }
  return out;
}

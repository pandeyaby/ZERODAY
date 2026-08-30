/**
 * Resolve CVE / GHSA → CWE + generic category.
 *
 * Sources (defensive metadata only):
 * 1. Vendored map (data/advisory-map.json) — offline / CI
 * 2. Optional public NVD CVE API 2.0 (weaknesses[].description)
 * 3. Optional public GitHub Security Advisories API (cwes[])
 *
 * Never fetches exploit DB writeups or attack recipes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdvisoryKind, AdvisoryRef } from "./types";
import { categoryForCwe } from "./categories";
import {
  detectAdvisoryKind,
  normalizeAdvisoryId,
  normalizeKindId,
} from "./advisory-id";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface ResolvedAdvisory extends AdvisoryRef {
  category: string;
  source: "vendored" | "nvd" | "ghsa" | "cwe-direct" | "explicit-cwe";
  references?: string[];
}

interface VendoredEntry {
  cweId: string;
  category?: string;
  title?: string;
}

interface VendoredMap {
  categories?: Record<string, string>;
  advisories: Record<string, VendoredEntry>;
}

let cachedMap: VendoredMap | null = null;

export function advisoryMapPath(): string {
  return path.resolve(here, "../../data/advisory-map.json");
}

export function loadVendoredMap(): VendoredMap {
  if (cachedMap) return cachedMap;
  const p = advisoryMapPath();
  if (!fs.existsSync(p)) {
    cachedMap = { advisories: {} };
    return cachedMap;
  }
  cachedMap = JSON.parse(fs.readFileSync(p, "utf8")) as VendoredMap;
  return cachedMap;
}

/** Reset cache (tests). */
export function resetVendoredMapCache(): void {
  cachedMap = null;
}

function normalizeId(kind: AdvisoryKind, raw: string): string {
  return normalizeKindId(kind, raw);
}

function fromVendored(kind: AdvisoryKind, id: string): ResolvedAdvisory | null {
  const map = loadVendoredMap();
  const key = kind === "ghsa" ? id.toLowerCase() : id.toUpperCase().replace(/^GHSA/, "GHSA");
  const entry =
    map.advisories[key] ??
    map.advisories[key.toUpperCase()] ??
    map.advisories[key.toLowerCase()];
  if (!entry) {
    if (kind === "cwe") {
      const cat = map.categories?.[id] ?? categoryForCwe(id);
      return {
        kind,
        id,
        cweId: id,
        category: cat,
        source: "cwe-direct",
      };
    }
    return null;
  }
  return {
    kind,
    id: kind === "ghsa" ? id.toLowerCase() : id,
    cweId: entry.cweId,
    title: entry.title,
    category: entry.category ?? categoryForCwe(entry.cweId),
    source: "vendored",
  };
}

function pickPrimaryCwe(cwes: string[]): string | null {
  const normalized = cwes
    .map((c) => {
      const m = String(c).match(/CWE-?(\d{1,4})/i);
      return m ? `CWE-${m[1]}` : null;
    })
    .filter((x): x is string => Boolean(x));
  return normalized[0] ?? null;
}

/**
 * NVD CVE API 2.0 — weaknesses only (no exploit content).
 * https://services.nvd.nist.gov/rest/json/cves/2.0
 */
export async function resolveFromNvd(
  cveId: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<ResolvedAdvisory | null> {
  const fetchFn = opts?.fetchImpl ?? fetch;
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
  try {
    const res = await fetchFn(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      vulnerabilities?: Array<{
        cve?: {
          id?: string;
          descriptions?: Array<{ lang?: string; value?: string }>;
          weaknesses?: Array<{
            description?: Array<{ lang?: string; value?: string }>;
          }>;
          references?: Array<{ url?: string }>;
        };
      }>;
    };
    const cve = body.vulnerabilities?.[0]?.cve;
    if (!cve) return null;
    const cwes: string[] = [];
    for (const w of cve.weaknesses ?? []) {
      for (const d of w.description ?? []) {
        if (d.value && /CWE-\d+/i.test(d.value)) cwes.push(d.value);
      }
    }
    const cweId = pickPrimaryCwe(cwes);
    if (!cweId) return null;
    const title =
      cve.descriptions?.find((d) => d.lang === "en")?.value?.slice(0, 200) ??
      undefined;
    const references = (cve.references ?? [])
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u))
      .filter((u) => !/exploit-db|packetstorm|0day/i.test(u))
      .slice(0, 5);
    return {
      kind: "cve",
      id: cveId.toUpperCase(),
      cweId,
      title,
      category: categoryForCwe(cweId),
      source: "nvd",
      references,
    };
  } catch {
    return null;
  }
}

/**
 * GitHub Security Advisories REST API — CWE list only.
 * https://docs.github.com/en/rest/security-advisories
 */
export async function resolveFromGhsa(
  ghsaId: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch; token?: string },
): Promise<ResolvedAdvisory | null> {
  const fetchFn = opts?.fetchImpl ?? fetch;
  const id = ghsaId.toLowerCase();
  const url = `https://api.github.com/advisories/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ZERODAY-localizer",
  };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  try {
    const res = await fetchFn(url, {
      headers,
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ghsa_id?: string;
      summary?: string;
      cwes?: Array<{ cwe_id?: string; name?: string }>;
      references?: Array<{ url?: string }>;
    };
    const cwes = (body.cwes ?? [])
      .map((c) => c.cwe_id)
      .filter((x): x is string => Boolean(x));
    const cweId = pickPrimaryCwe(cwes);
    if (!cweId) return null;
    const references = (body.references ?? [])
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u))
      .filter((u) => !/exploit-db|packetstorm|0day/i.test(u))
      .slice(0, 5);
    return {
      kind: "ghsa",
      id,
      cweId,
      title: body.summary?.slice(0, 200),
      category: categoryForCwe(cweId),
      source: "ghsa",
      references,
    };
  } catch {
    return null;
  }
}

export interface ResolveOptions {
  /** Skip network (CI / offline). Default true when ZERODAY_OFFLINE=1 or fixture. */
  offline?: boolean;
  /** Explicit CWE override when CVE/GHSA is unknown */
  explicitCwe?: string;
  fetchImpl?: typeof fetch;
  githubToken?: string;
}

/**
 * Resolve any CWE / CVE / GHSA input to a CWE + category.
 */
export async function resolveAdvisory(
  raw: string,
  opts: ResolveOptions = {},
): Promise<ResolvedAdvisory> {
  const kind = detectAdvisoryKind(raw);
  if (!kind) {
    throw new Error(
      `Unrecognized advisory '${raw}'. Expected CWE-NNN, CVE-YYYY-NNNN, or GHSA-xxxx-xxxx-xxxx.`,
    );
  }
  const id = normalizeId(kind, raw);
  const offline =
    opts.offline === true ||
    process.env.ZERODAY_OFFLINE === "1" ||
    process.env.ZERODAY_OFFLINE === "true";

  if (opts.explicitCwe) {
    const cweKind = detectAdvisoryKind(opts.explicitCwe);
    if (cweKind !== "cwe") {
      throw new Error(`--cwe override must be a CWE id, got '${opts.explicitCwe}'`);
    }
    const cweId = normalizeId("cwe", opts.explicitCwe);
    return {
      kind,
      id: kind === "ghsa" ? id.toLowerCase() : id,
      cweId,
      title: undefined,
      category: categoryForCwe(cweId),
      source: "explicit-cwe",
    };
  }

  const vendored = fromVendored(kind, id);
  if (vendored && (kind === "cwe" || vendored.source === "vendored")) {
    if (kind === "cwe" || offline) return vendored;
    // Prefer vendored for known fixture/demo ids even when online
    if (vendored.source === "vendored") return vendored;
  }

  if (!offline) {
    if (kind === "cve") {
      const nvd = await resolveFromNvd(id, { fetchImpl: opts.fetchImpl });
      if (nvd) return nvd;
    }
    if (kind === "ghsa") {
      const ghsa = await resolveFromGhsa(id, {
        fetchImpl: opts.fetchImpl,
        token: opts.githubToken ?? process.env.GITHUB_TOKEN,
      });
      if (ghsa) return ghsa;
    }
  }

  if (vendored) return vendored;

  if (kind === "cwe") {
    return {
      kind: "cwe",
      id,
      cweId: id,
      category: categoryForCwe(id),
      source: "cwe-direct",
    };
  }

  throw new Error(
    `${id} could not be resolved to a CWE. ` +
      `Pass --cwe CWE-NNN explicitly, add a vendored mapping in data/advisory-map.json, ` +
      `or enable network resolve (unset ZERODAY_OFFLINE). Antares queries by CWE.`,
  );
}

/** Sync path for callers that already have a mapped id (tests / fixture). */
export function resolveAdvisorySync(raw: string): ResolvedAdvisory {
  const kind = detectAdvisoryKind(raw);
  if (!kind) {
    throw new Error(`Unrecognized advisory '${raw}'.`);
  }
  const id = normalizeId(kind, normalizeAdvisoryId(raw));
  const vendored = fromVendored(kind, id);
  if (vendored) return vendored;
  if (kind === "cwe") {
    return {
      kind: "cwe",
      id,
      cweId: id,
      category: categoryForCwe(id),
      source: "cwe-direct",
    };
  }
  throw new Error(
    `${id} is not in ZERODAY's vendored advisory→CWE map. Pass a CWE directly or use async resolveAdvisory().`,
  );
}

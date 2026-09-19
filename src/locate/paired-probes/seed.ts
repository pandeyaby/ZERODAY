/**
 * Minimal seed plumbing for RESEED (DIPTYCH open_loop).
 * Seed reshuffles multi-finding rankedFiles via mulberry32 — no new RNG product stack.
 * Seed may optionally leak into graded partialFingerprints (violating policy).
 */

import type { LocalizationResult, RankedFile } from "../types";
import { toSarif } from "../sarif";
import type { SarifLikeLog } from "./fingerprint";
import { decisionFingerprintFromSarif } from "./fingerprint";

/** Deterministic PRNG for RESEED / VARSCALE exploration noise (not a product RNG stack). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic shuffle of ranked files; ranks reassigned 1..n in new order. */
export function applySeedToResult(
  result: LocalizationResult,
  seed: string,
): LocalizationResult {
  const clone = structuredClone(result) as LocalizationResult;
  const rnd = mulberry32(hashSeed(seed));
  const files = [...clone.rankedFiles];
  for (let i = files.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }
  clone.rankedFiles = files.map((f: RankedFile, idx: number) => ({
    ...f,
    rank: idx + 1,
  }));
  return clone;
}

/**
 * Conforming RESEED policy: grade seed-independent channels only
 * (uri+ruleId+level+region — strip rank from partialFingerprints before hash).
 */
export function gradeSeedIndependent(result: LocalizationResult) {
  const sarif = toSarif(result) as SarifLikeLog;
  for (const r of sarif.runs?.[0]?.results ?? []) {
    if (r.partialFingerprints) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.partialFingerprints)) {
        // Drop rank-bearing primaryLocationLineHash so seed reshuffle is stable.
        if (k === "primaryLocationLineHash") {
          const parts = String(v).split("|");
          // cwe|uri|rank → cwe|uri
          next[k] = parts.length >= 2 ? `${parts[0]}|${parts[1]}` : String(v);
        } else if (!k.startsWith("zeroday_seed")) {
          next[k] = v;
        }
      }
      r.partialFingerprints = next;
    }
  }
  return decisionFingerprintFromSarif(sarif);
}

/**
 * Violating RESEED policy: seed leaks into graded fingerprints.
 */
export function gradeSeedLeaking(result: LocalizationResult, seed: string) {
  const sarif = toSarif(result) as SarifLikeLog;
  for (const r of sarif.runs?.[0]?.results ?? []) {
    r.partialFingerprints = {
      ...(r.partialFingerprints ?? {}),
      zeroday_seed_leak: seed,
    };
  }
  return decisionFingerprintFromSarif(sarif);
}

/** L∞ distance between two sha256 fingerprints (hex suffix as byte vectors). */
export function fingerprintLinfDistance(a: string, b: string): number {
  const ha = a.replace(/^sha256:/, "");
  const hb = b.replace(/^sha256:/, "");
  const n = Math.max(ha.length, hb.length);
  let max = 0;
  for (let i = 0; i < n; i += 2) {
    const ba = parseInt(ha.slice(i, i + 2) || "0", 16);
    const bb = parseInt(hb.slice(i, i + 2) || "0", 16);
    max = Math.max(max, Math.abs(ba - bb));
  }
  return max;
}

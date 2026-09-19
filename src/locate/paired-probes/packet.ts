/**
 * Serialize / restore LocalizationResult decision packets (FREEZEDRY / HISTSWAP).
 * Clock + rng are stripped on freeze; restored packet is bit-stable for graded channels.
 */

import type { LocalizationResult } from "../types";
import { toSarif } from "../sarif";
import type { SarifLikeLog } from "./fingerprint";
import { decisionFingerprintFromSarif } from "./fingerprint";

export interface FrozenDecisionPacket {
  schema: "zeroday-decision-packet/v1";
  freeze_channels: string[];
  /** LocalizationResult with generatedAt pinned when clock frozen. */
  result: LocalizationResult;
  frozenAt?: string;
}

export function freezePacket(
  result: LocalizationResult,
  freezeChannels: string[],
): FrozenDecisionPacket {
  const clone = structuredClone(result) as LocalizationResult;
  if (freezeChannels.includes("clock")) {
    clone.generatedAt = "1970-01-01T00:00:00.000Z";
  }
  return {
    schema: "zeroday-decision-packet/v1",
    freeze_channels: [...freezeChannels].sort(),
    result: clone,
    frozenAt: freezeChannels.includes("clock")
      ? "1970-01-01T00:00:00.000Z"
      : undefined,
  };
}

export function restorePacket(packet: FrozenDecisionPacket): LocalizationResult {
  return structuredClone(packet.result) as LocalizationResult;
}

export function packetToSarif(result: LocalizationResult): SarifLikeLog {
  return toSarif(result) as SarifLikeLog;
}

export function gradeFromResult(result: LocalizationResult) {
  const sarif = packetToSarif(result);
  const graded = decisionFingerprintFromSarif(sarif);
  return { sarif, ...graded };
}

/** Deep-stable JSON stringify for serialize_restore cassette bytes. */
export function serializePacket(packet: FrozenDecisionPacket): string {
  return JSON.stringify(packet);
}

export function deserializePacket(raw: string): FrozenDecisionPacket {
  const p = JSON.parse(raw) as FrozenDecisionPacket;
  if (p.schema !== "zeroday-decision-packet/v1") {
    throw new Error(`Unsupported decision packet schema: ${String(p.schema)}`);
  }
  if (!p.result || !Array.isArray(p.result.rankedFiles)) {
    throw new Error("Decision packet missing result.rankedFiles");
  }
  return p;
}

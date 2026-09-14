/**
 * Map inventory finding kinds → packet classification labels.
 * Deterministic only — no free-text guessing. Unmapped → unknown.
 */

import type { InventoryFindingKind } from "../factory/types";
import type { PacketClassification } from "./types";

export interface ClassificationRule {
  classification: PacketClassification;
  basis: string;
}

/**
 * Evidence-backed mapping from Desk B inventory kinds.
 * config_surface is excluded upstream (noise for security packet).
 */
const KIND_MAP: Partial<Record<InventoryFindingKind, ClassificationRule>> = {
  agent_harness: {
    classification: "agent-misfire",
    basis:
      "Inventory kind `agent_harness` — agent/skill config execution or remote-fetch hint",
  },
  dependency_harness: {
    classification: "dependency",
    basis:
      "Inventory kind `dependency_harness` — package install/remote-shell harness pattern",
  },
  ci_secret_pattern: {
    classification: "config",
    basis:
      "Inventory kind `ci_secret_pattern` — CI/workflow secret *name* reference (value not captured)",
  },
  env_example_honesty: {
    classification: "config",
    basis:
      "Inventory kind `env_example_honesty` — .env.example key surface / placeholder honesty",
  },
};

/**
 * Classify an inventory finding kind for the security packet.
 * Returns `unknown` when the kind is not in the evidence map (no guessing).
 */
export function classifyInventoryKind(
  kind: string,
): ClassificationRule & { classification: PacketClassification } {
  const mapped = KIND_MAP[kind as InventoryFindingKind];
  if (mapped) return mapped;
  return {
    classification: "unknown",
    basis:
      "No evidence-backed packet mapping for this inventory kind — left unknown (no guessing)",
  };
}

/** Kinds included in the security packet findings list. */
export function isPacketFindingKind(kind: string): boolean {
  return kind !== "config_surface";
}

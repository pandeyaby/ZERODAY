/**
 * Fixture-driven classifier: locate result + optional local telemetry → label.
 *
 * Honesty:
 * - Labels require human review before treated as truth.
 * - agent_misfire is a classifier OUTPUT on fixtures that support it —
 *   not a live detection capability against production agents.
 * - Never proof of exploitability or of a live adversary.
 */

import type { LocalizationResult } from "../locate/types";
import type {
  ClassificationLabel,
  ClassificationEvidence,
  CisoObject,
} from "./types";
import {
  type TelemetryFixture,
  hasLateralMovement,
  hasInfraFailure,
  hasAgentMisfire,
} from "./telemetry";

export interface ClassifyInput {
  locate?: LocalizationResult | null;
  telemetry?: TelemetryFixture | null;
  locateReportPath?: string;
  telemetryPath?: string;
}

export interface ClassifyResult {
  ciso: CisoObject;
}

function softwareSignal(locate?: LocalizationResult | null): boolean {
  return Boolean(locate && locate.rankedFiles.length > 0);
}

/**
 * Deterministic rule engine. Ambiguity → needs_human.
 */
export function classify(input: ClassifyInput): ClassifyResult {
  const locate = input.locate ?? null;
  const telemetry = input.telemetry ?? null;
  const events = telemetry?.events ?? [];

  const signals = {
    softwareDefect: softwareSignal(locate),
    possibleBreach: events.length > 0 && hasLateralMovement(events),
    infraFailure: events.length > 0 && hasInfraFailure(events),
    agentMisfire: events.length > 0 && hasAgentMisfire(events),
  };

  const evidence: ClassificationEvidence[] = [];
  if (locate) {
    for (const f of locate.rankedFiles) {
      evidence.push({
        kind: "locate_file",
        id: `file:${f.filePath}`,
        summary: f.title,
        filePath: f.filePath,
        cwe: f.cweIds[0] ?? locate.advisory.cweId,
      });
    }
  }
  for (const e of events) {
    evidence.push({
      kind: "telemetry_event",
      id: e.id,
      summary: e.notes || e.action || e.type,
      telemetryId: e.id,
    });
  }

  const active = (
    Object.entries(signals) as [keyof typeof signals, boolean][]
  ).filter(([, v]) => v);

  let classification: ClassificationLabel = "needs_human";
  let confidence = 0.35;
  const rationale: string[] = [];

  if (active.length === 0) {
    classification = "needs_human";
    confidence = 0.2;
    rationale.push("No software localization findings and no telemetry signals.");
  } else if (active.length >= 2) {
    // Competing signals → human must decide (e.g. lateral + agent_misfire)
    classification = "needs_human";
    confidence = 0.45;
    rationale.push(
      `Ambiguous: multiple signals (${active.map(([k]) => k).join(", ")}). Human review required.`,
    );
  } else {
    const only = active[0][0];
    if (only === "softwareDefect") {
      classification = "software_defect";
      confidence = 0.7;
      rationale.push(
        "Locate submitted ranked candidate file(s) with CWE evidence; no breach/infra/agent telemetry signals.",
      );
    } else if (only === "infraFailure") {
      classification = "infra_failure";
      confidence = 0.65;
      rationale.push(
        "Telemetry fixture shows infrastructure failure markers without competing signals.",
      );
    } else if (only === "agentMisfire") {
      classification = "agent_misfire";
      confidence = 0.6;
      rationale.push(
        "Telemetry fixture is tagged/shaped as an agent_session misfire (fixture-driven classifier output — not live agent detection).",
      );
    } else if (only === "possibleBreach") {
      classification = "possible_breach";
      confidence = 0.65;
      rationale.push(
        "Telemetry fixture shows lateral-movement-shaped traffic across hosts (fixture input — not a live adversary claim).",
      );
    }
  }

  // Soft bump: software + only breach was already needs_human via multi-signal.
  // Single software stays software_defect.

  const next =
    classification === "needs_human"
      ? "Human triage required: review ranked files and telemetry evidence; do not treat any label as truth until confirmed. Never auto-merge."
      : `Human triage required before accepting '${classification}': confirm evidence, dismiss or escalate. Localization is not exploitability. Never auto-merge.`;

  const ciso: CisoObject = {
    schema: "zeroday-ciso-v1",
    generatedAt: new Date().toISOString(),
    classification,
    confidence,
    needs_human: true,
    human_review_required: true,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      notLiveAdversaryProof: true,
      notProductionSoc: true,
      noAutoMerge: true,
      noPoC: true,
      fixtureDrivenClassifier: true,
    },
    inputs: {
      locateReport: input.locateReportPath,
      telemetryFixture: input.telemetryPath,
      advisoryId: locate?.advisory.id,
      cweId: locate?.advisory.cweId,
    },
    evidence,
    next_human_action: next,
    rationale,
    signals,
  };

  return { ciso };
}

export function isValidCisoObject(doc: unknown): doc is CisoObject {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  if (d.schema !== "zeroday-ciso-v1") return false;
  if (d.needs_human !== true || d.human_review_required !== true) return false;
  if (typeof d.classification !== "string") return false;
  if (!Array.isArray(d.evidence)) return false;
  const posture = d.posture as Record<string, unknown> | undefined;
  if (!posture?.fixtureDrivenClassifier) return false;
  return true;
}

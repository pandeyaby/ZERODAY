/**
 * Research-library safety gates (Plinian Doctrine).
 *
 * Production adapters (T3MP3ST, ST3GG) do not need the research gate.
 * G0DM0D3 / CL4R1T4S / L1B3RT4S / OBLITERATUS default OFF and require:
 *   1. researchLibrariesEnabled
 *   2. researchLibrariesAcknowledged (authorized lab use statement)
 *   3. library id in enabledResearchLibs
 *   4. for content preview / spicy actions: receipt or explicit allowContentReads
 */

import type { AppSettings } from "@/lib/types";
import type { PliniusLibId } from "@/plinius/paths";
import { getPliniusLibrary } from "@/plinius/registry";

export const RESEARCH_ACK_STATEMENT = `
I acknowledge that Plinius research libraries (G0DM0D3, CL4R1T4S, L1B3RT4S, OBLITERATUS)
contain dual-use offensive/jailbreak/abliteration material. I will use them only under
written authorization for lab research, detection engineering, or product security validation.
ZERODAY will not auto-inject these materials into missions. Content access is logged to the Evidence Vault.
`.trim();

export type GateDenialCode =
  | "RESEARCH_DISABLED"
  | "RESEARCH_NOT_ACKNOWLEDGED"
  | "LIBRARY_NOT_ENABLED"
  | "CONTENT_READS_DISABLED"
  | "RECEIPT_REQUIRED"
  | "EXECUTION_BLOCKED"
  | "UNKNOWN_LIBRARY";

export interface GateResult {
  allowed: boolean;
  code?: GateDenialCode;
  reason?: string;
}

export function isResearchLibrary(id: PliniusLibId): boolean {
  return Boolean(getPliniusLibrary(id)?.requiresResearchGate);
}

/** Catalog/metadata browse for a research library. */
export function gateResearchCatalog(settings: AppSettings, libId: PliniusLibId): GateResult {
  const meta = getPliniusLibrary(libId);
  if (!meta) return { allowed: false, code: "UNKNOWN_LIBRARY", reason: `Unknown library ${libId}` };
  if (!meta.requiresResearchGate) return { allowed: true };

  if (!settings.researchLibrariesEnabled) {
    return {
      allowed: false,
      code: "RESEARCH_DISABLED",
      reason:
        "Research libraries are OFF. Enable in Settings → Plinius Research (authorized use only).",
    };
  }
  if (!settings.researchLibrariesAcknowledged) {
    return {
      allowed: false,
      code: "RESEARCH_NOT_ACKNOWLEDGED",
      reason: "Acknowledge the research-library authorized-use statement before browsing.",
    };
  }
  const enabled = (settings.enabledResearchLibs || []) as string[];
  if (!enabled.includes(libId)) {
    return {
      allowed: false,
      code: "LIBRARY_NOT_ENABLED",
      reason: `${meta.name} is not in enabledResearchLibs. Enable it explicitly in Settings.`,
    };
  }
  return { allowed: true };
}

/** Truncated content preview (still gated harder than catalog). */
export function gateResearchContent(
  settings: AppSettings,
  libId: PliniusLibId,
  opts?: { hasReceipt?: boolean }
): GateResult {
  const catalog = gateResearchCatalog(settings, libId);
  if (!catalog.allowed) return catalog;

  if (!settings.allowResearchContentReads) {
    return {
      allowed: false,
      code: "CONTENT_READS_DISABLED",
      reason:
        "Content reads are disabled. Set allowResearchContentReads=true (and prefer receipts) for truncated previews.",
    };
  }

  // L1B3RT4S / OBLITERATUS always require a receipt for content
  if ((libId === "l1b3rt4s" || libId === "obliteratus") && !opts?.hasReceipt) {
    return {
      allowed: false,
      code: "RECEIPT_REQUIRED",
      reason: `${libId} content requires an explicit research receipt (approve via API/UI).`,
    };
  }

  return { allowed: true };
}

/**
 * Block model mutation / jailbreak execution paths.
 * OBLITERATUS CLI and L1B3RT4S "apply pack" stay blocked unless spicy research exec is on + receipt.
 */
export function gateResearchExecution(
  settings: AppSettings,
  libId: PliniusLibId,
  opts?: { hasReceipt?: boolean }
): GateResult {
  const catalog = gateResearchCatalog(settings, libId);
  if (!catalog.allowed) return catalog;

  if (!settings.allowResearchExecution) {
    return {
      allowed: false,
      code: "EXECUTION_BLOCKED",
      reason:
        "Research execution is blocked by default (allowResearchExecution=false). Catalog/browse only.",
    };
  }
  if (!opts?.hasReceipt) {
    return {
      allowed: false,
      code: "RECEIPT_REQUIRED",
      reason: "Research execution requires an explicit spicy receipt.",
    };
  }
  return { allowed: true };
}

export function researchGateSummary(settings: AppSettings) {
  return {
    enabled: Boolean(settings.researchLibrariesEnabled),
    acknowledged: Boolean(settings.researchLibrariesAcknowledged),
    enabledLibs: settings.enabledResearchLibs || [],
    allowContentReads: Boolean(settings.allowResearchContentReads),
    allowExecution: Boolean(settings.allowResearchExecution),
    ackStatement: RESEARCH_ACK_STATEMENT,
    defaults: {
      researchLibrariesEnabled: false,
      allowResearchContentReads: false,
      allowResearchExecution: false,
    },
  };
}

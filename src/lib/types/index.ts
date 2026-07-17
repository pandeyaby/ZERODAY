/**
 * ZERODAY core domain types.
 * Everything in the War Room flows through these contracts.
 */

/** Tool execution modes — Plinian Doctrine gating. */
export type ToolMode = "safe_local" | "receipt_required" | "catalog_only";

/** Operator archetypes (8-cell kill chain). */
export type OperatorRole =
  | "recon"
  | "scanner"
  | "exploiter"
  | "infiltrator"
  | "exfiltrator"
  | "ghost"
  | "coordinator"
  | "analyst";

export type MissionStatus =
  | "draft"
  | "awaiting_authorization"
  | "queued"
  | "running"
  | "paused"
  | "awaiting_retest"
  | "completed"
  | "aborted"
  | "failed";

export type FindingSeverity =
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type FindingConfidence = "tentative" | "probable" | "confirmed";

export type FindingStatus =
  | "draft"
  | "needs_retest"
  | "retested"
  | "promoted"
  | "dismissed"
  | "false_positive";

export type EvidenceKind =
  | "tool_output"
  | "observation"
  | "artifact"
  | "screenshot"
  | "config"
  | "log"
  | "stego"
  | "operator_note"
  | "authorization";

export interface ScopeTarget {
  id: string;
  hostname?: string;
  cidr?: string;
  url?: string;
  vendor?: string;
  product?: string;
  environment: "lab" | "staging" | "production" | "sandbox";
  notes?: string;
}

export interface AuthorizationRecord {
  id: string;
  authorizedBy: string;
  authorizedAt: string;
  expiresAt?: string;
  scopeSummary: string;
  rulesOfEngagement: string;
  writtenApprovalRef?: string;
  acknowledged: boolean;
}

export interface Mission {
  id: string;
  name: string;
  objective: string;
  status: MissionStatus;
  loadouts: string[];
  targets: ScopeTarget[];
  authorization?: AuthorizationRecord;
  phases: MissionPhase[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  tags: string[];
  naturalLanguageBrief?: string;
}

export interface MissionPhase {
  id: string;
  name: string;
  operatorRole: OperatorRole;
  status: "pending" | "running" | "completed" | "skipped" | "failed";
  startedAt?: string;
  completedAt?: string;
  summary?: string;
}

export interface OperatorState {
  id: string;
  missionId: string;
  role: OperatorRole;
  status: "idle" | "thinking" | "tool_call" | "waiting" | "done" | "error";
  currentThought?: string;
  lastAction?: string;
  toolCalls: number;
  startedAt?: string;
  updatedAt: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  vendor?: string;
  category: string;
  mode: ToolMode;
  roles: OperatorRole[];
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
      default?: unknown;
    }
  >;
  /** If true, never auto-run without explicit receipt. */
  spicy?: boolean;
}

export interface ToolCallRequest {
  toolId: string;
  args: Record<string, unknown>;
  missionId: string;
  operatorRole: OperatorRole;
  modeOverride?: ToolMode;
}

export interface ToolCallResult {
  ok: boolean;
  toolId: string;
  mode: ToolMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: string;
  data: Record<string, unknown>;
  evidenceId?: string;
  scopeDenied?: boolean;
  receiptRequired?: boolean;
  error?: string;
  redacted: boolean;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  operatorRole?: OperatorRole;
  toolId?: string;
  kind: EvidenceKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  /** SHA-256 of canonical JSON payload for provenance. */
  hash: string;
  parentIds: string[];
  createdAt: string;
  tags: string[];
  containsSecrets: boolean;
  redacted: boolean;
}

export interface Finding {
  id: string;
  missionId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  status: FindingStatus;
  vendorImpact: string[];
  evidenceIds: string[];
  recommendedFix: string;
  mitreTactics?: string[];
  cveIds?: string[];
  createdAt: string;
  updatedAt: string;
  retestNotes?: string;
  promotedAt?: string;
}

export interface RetestItem {
  id: string;
  findingId: string;
  missionId: string;
  status: "queued" | "in_progress" | "passed" | "failed" | "cancelled";
  reason: string;
  createdAt: string;
  completedAt?: string;
  resultNotes?: string;
}

export type ResearchLibId = "g0dm0d3" | "cl4r1t4s" | "l1b3rt4s" | "obliteratus";

export interface AppSettings {
  llmProvider: "keyless" | "openrouter" | "anthropic" | "openai" | "ollama" | "custom";
  llmBaseUrl?: string;
  llmModel?: string;
  /** Never persisted in plaintext evidence; UI-only / env overlay. */
  hasApiKeyConfigured: boolean;
  defaultToolMode: ToolMode;
  requireAuthorization: boolean;
  redactSecrets: boolean;
  theme: "warroom";
  pollingIntervalMs: number;
  /**
   * Plinius research libraries (G0DM0D3 / CL4R1T4S / L1B3RT4S / OBLITERATUS).
   * All default OFF. Production adapters T3MP3ST + ST3GG ignore these flags.
   */
  researchLibrariesEnabled: boolean;
  researchLibrariesAcknowledged: boolean;
  researchAcknowledgedAt?: string;
  researchAcknowledgedBy?: string;
  enabledResearchLibs: ResearchLibId[];
  /** Truncated file previews (still audited). */
  allowResearchContentReads: boolean;
  /**
   * Even when true, ZERODAY refuses in-process dual-use execution and points
   * operators to isolated lab VMs — receipts are still required.
   */
  allowResearchExecution: boolean;
}

export interface OperatorEvent {
  id: string;
  missionId: string;
  operatorRole: OperatorRole;
  type: "thought" | "tool_call" | "tool_result" | "finding" | "phase" | "error" | "info";
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

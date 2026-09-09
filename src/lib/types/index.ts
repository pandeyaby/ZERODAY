/**
 * ZERODAY app settings — local UI prefs only.
 * Default path is keyless (coding-agent operator). No research/jailbreak gates.
 */

export interface AppSettings {
  /** Always keyless for default operate path */
  llmProvider: "keyless" | "local-antares";
  llmBaseUrl?: string;
  llmModel?: string;
  hasApiKeyConfigured: boolean;
  redactSecrets: boolean;
  theme: "warroom";
  pollingIntervalMs: number;
}

/** Kept for optional local UI persistence — not a kill-chain product surface. */
export type FindingSeverity =
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "critical";

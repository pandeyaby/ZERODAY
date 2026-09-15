/**
 * Desk Console Live brain wizard (UI-3) — configure opt-in completions
 * endpoints (Antares-1B / local OpenAI-compatible) under the UI path sandbox.
 *
 * Reuses doctor shape-check + completions probe + live locate guards.
 * Never stores secret token values; never auto-provisions RunPod; no new
 * inference engines. Spend requires explicit human ACK in the request.
 */

import fs from "node:fs";
import path from "node:path";
import {
  assertPathAllowed,
  canonicalizePath,
  PathPolicyError,
  resolveOutputDir,
} from "../lib/path-policy";
import {
  checkLocalBrainEndpointShape,
  formatLocalBrainDoctorChecklist,
  type LocalBrainEndpointCheck,
} from "../doctor/index";
import {
  assertNotChatCompletions,
  normalizeCompletionsEndpoint,
  probeCompletionsEndpoint,
  type CompletionsProbeResult,
} from "../locate/completions";
import { resolveLocateMode } from "../locate/live-guard";
import { DEFAULT_ANTARES_MODEL, locate } from "../locate/index";
import type { LocalizationResult } from "../locate/types";
import { remoteInferenceAcked } from "../factory/provider";

export const DESK_ENDPOINT_SCHEMA = "zeroday-desk-endpoint/v1" as const;
export const DESK_ENDPOINT_REL = path.join(".zeroday", "desk-endpoint.json");

export const HF_ANTARES_TERMS_URL =
  "https://huggingface.co/fdtn-ai/antares-1b";

export const LIVE_ACTIONS = [
  "catalog",
  "load",
  "save",
  "doctor",
  "locate",
] as const;

export type LiveAction = (typeof LIVE_ACTIONS)[number];

export type LivePresetId = "antares-1b" | "local-openai" | "custom";

export interface LiveEndpointConfig {
  schema: typeof DESK_ENDPOINT_SCHEMA;
  preset: LivePresetId;
  endpoint: string;
  model: string;
  /** Maps to --remote-inference / ZERODAY_REMOTE_INFERENCE_ACK */
  remoteInference: boolean;
  /**
   * Env var *name* for HF / auth token (e.g. HF_TOKEN). Never the secret value.
   */
  tokenEnvVar?: string;
  note?: string;
  updatedAt?: string;
}

export interface LivePreset {
  id: LivePresetId;
  label: string;
  description: string;
  endpoint: string;
  model: string;
  remoteInference: boolean;
  tokenEnvVar?: string;
  hfGated?: boolean;
  hfTermsUrl?: string;
}

export const LIVE_PRESETS: LivePreset[] = [
  {
    id: "antares-1b",
    label: "Antares-1B",
    description:
      "Recommended live brain (fdtn-ai/antares-1b). HF gated — accept terms yourself; ZERODAY never scrapes or bypasses.",
    endpoint: "http://127.0.0.1:8000/v1",
    model: DEFAULT_ANTARES_MODEL,
    remoteInference: false,
    tokenEnvVar: "HF_TOKEN",
    hfGated: true,
    hfTermsUrl: HF_ANTARES_TERMS_URL,
  },
  {
    id: "local-openai",
    label: "Local OpenAI-compatible",
    description:
      "Ollama / vLLM / LM Studio completions host you already started. Completions-only (/v1/completions); chat-only refused. Arbitrary local models ≠ Antares File F1.",
    endpoint: "http://127.0.0.1:11434/v1",
    model: "local-model",
    remoteInference: false,
  },
];

const SPEND_BANNER =
  "Live locate may spend GPU / host resources and can send prompts + repo-derived context to the endpoint. Keyless stays default — you must click confirm. No auto RunPod / auto-spend.";

const HONESTY = [
  "Keyless stays default; live is opt-in with an explicit human click + spend banner",
  "UI-2 “No live Antares” meant validate/CI didn’t exercise spend — live path already exists via locate --endpoint + doctor; UI-3 makes it first-class in Desk Console",
  "Reuses --endpoint / live-guard / doctor — no new inference engines",
  "Non-loopback requires remote-inference ACK (UI checkbox)",
  "HF / auth tokens stay in env (tokenEnvVar name only in config) — never written to reports/SARIF",
  "No auto RunPod · no PoC · needs_human · private",
];

export class LiveEndpointError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "LiveEndpointError";
    this.code = code;
  }
}

export interface LiveCatalog {
  kind: "live-catalog";
  schema: typeof DESK_ENDPOINT_SCHEMA;
  configPath: string;
  presets: LivePreset[];
  checklistPreview: string;
  honesty: string[];
  spendBanner: string;
  defaults: LiveEndpointConfig;
}

export interface LiveLoadResult {
  kind: "live-load";
  config: LiveEndpointConfig | null;
  configPath: string;
  exists: boolean;
  honesty: string[];
}

export interface LiveSaveResult {
  kind: "live-save";
  config: LiveEndpointConfig;
  configPath: string;
  honesty: string[];
}

export interface LiveDoctorCheckItem {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
}

export interface LiveDoctorResult {
  kind: "live-doctor";
  ok: boolean;
  shape: LocalBrainEndpointCheck;
  probe?: CompletionsProbeResult;
  checks: LiveDoctorCheckItem[];
  checklist: string;
  endpoint: string;
  model: string;
  remoteInference: boolean;
  remoteAckRequired: boolean;
  honesty: string[];
}

export interface LiveLocateResult {
  kind: "live-locate";
  mode: LocalizationResult["mode"];
  action: "live";
  advisory: string;
  cweId: string;
  findingCount: number;
  rankedFiles: Array<{
    rank: number;
    filePath: string;
    title: string;
    cweIds: string[];
  }>;
  outputDir: string;
  paths: { json: string; sarif: string; report: string };
  endpoint: string;
  model: string;
  remoteInference: boolean;
  warnings: string[];
  needs_human: true;
  honesty: string;
  /** Confirms no secret token values were scanned into artifacts */
  tokenHygiene: { scanned: boolean; leaked: boolean };
}

export type LiveResult =
  | LiveCatalog
  | LiveLoadResult
  | LiveSaveResult
  | LiveDoctorResult
  | LiveLocateResult;

export interface LiveRunRequest {
  action: LiveAction;
  endpoint?: string;
  model?: string;
  preset?: LivePresetId;
  remoteInference?: boolean;
  tokenEnvVar?: string;
  note?: string;
  /** Repo for live locate (sandboxed). */
  repo?: string;
  cwe?: string;
  output?: string;
  /** Explicit human spend/cost confirm — required for locate. */
  spendAcknowledged?: boolean;
  cwd?: string;
  /** Test seam: skip network doctor probe */
  probeResult?: CompletionsProbeResult;
  /** Test seam: custom fetch for probe */
  probeFetch?: typeof fetch;
  /** Test seam: inject locate probe for live gate */
  locateProbeResult?: CompletionsProbeResult;
}

function defaultConfig(): LiveEndpointConfig {
  const p = LIVE_PRESETS[0]!;
  return {
    schema: DESK_ENDPOINT_SCHEMA,
    preset: p.id,
    endpoint: p.endpoint,
    model: p.model,
    remoteInference: false,
    tokenEnvVar: p.tokenEnvVar,
  };
}

/** Resolve request cwd for path checks (canonical when the dir exists). */
export function resolveLiveCwd(cwd?: string): string {
  const raw = path.resolve(cwd ?? process.cwd());
  try {
    if (fs.existsSync(raw)) return canonicalizePath(raw);
  } catch {
    /* keep resolved form */
  }
  return raw;
}

export function resolveDeskEndpointPath(options?: { cwd?: string }): string {
  const cwd = resolveLiveCwd(options?.cwd);
  return assertPathAllowed(DESK_ENDPOINT_REL, {
    cwd,
    label: "desk-endpoint config",
  });
}

function sanitizeTokenEnvVar(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  // Reject pasted secret values (opaque hf_/sk-/ghp_ blobs). Keep ENV_VAR names.
  if (
    /[\s=]/.test(v) ||
    /^(hf_|sk-|ghp_)[A-Za-z0-9]{16,}$/i.test(v)
  ) {
    throw new LiveEndpointError(
      "tokenEnvVar must be an environment variable name (e.g. HF_TOKEN), never a secret value",
      "TOKEN_ENV_REFUSED",
    );
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v) || v.length > 64) {
    throw new LiveEndpointError(
      "tokenEnvVar must be a valid env var name (A-Z, 0-9, _)",
      "TOKEN_ENV_REFUSED",
    );
  }
  return v;
}

/** Strip any accidental secret-shaped fields before persist / response. */
export function sanitizeLiveConfig(
  input: Partial<LiveEndpointConfig> & {
    endpoint?: string;
    model?: string;
  },
): LiveEndpointConfig {
  const endpoint = (input.endpoint || "").trim();
  const model = (input.model || "").trim() || DEFAULT_ANTARES_MODEL;
  if (!endpoint) {
    throw new LiveEndpointError("endpoint is required", "ENDPOINT_REQUIRED");
  }
  // Refuse chat-only shapes early
  assertNotChatCompletions(endpoint);
  const shape = checkLocalBrainEndpointShape(endpoint);
  if (!shape.ok) {
    throw new LiveEndpointError(shape.detail, "BAD_ENDPOINT_SHAPE");
  }

  const preset: LivePresetId =
    input.preset === "antares-1b" ||
    input.preset === "local-openai" ||
    input.preset === "custom"
      ? input.preset
      : "custom";

  const remoteInference = input.remoteInference === true;
  if (shape.remoteAckRequired && !remoteInference) {
    // Allow save without ACK (operator may ACK later), but flag is stored as-is.
    // Locate/doctor will enforce ACK when firing live.
  }

  const tokenEnvVar = sanitizeTokenEnvVar(input.tokenEnvVar);

  // Prefer storing base …/v1 form for UX (normalize adds /completions)
  const trimmed = endpoint.replace(/\/+$/, "");
  const storedEndpoint = /\/v1\/completions$/i.test(trimmed)
    ? trimmed.replace(/\/completions$/i, "")
    : trimmed;

  const cfg: LiveEndpointConfig = {
    schema: DESK_ENDPOINT_SCHEMA,
    preset,
    endpoint: storedEndpoint,
    model,
    remoteInference,
    updatedAt: new Date().toISOString(),
  };

  if (tokenEnvVar) cfg.tokenEnvVar = tokenEnvVar;
  if (input.note?.trim()) cfg.note = input.note.trim().slice(0, 500);

  return cfg;
}

export function applyPreset(id: LivePresetId): LiveEndpointConfig {
  if (id === "custom") {
    return { ...defaultConfig(), preset: "custom" };
  }
  const p = LIVE_PRESETS.find((x) => x.id === id);
  if (!p) {
    throw new LiveEndpointError(`Unknown preset: ${id}`, "UNKNOWN_PRESET");
  }
  return sanitizeLiveConfig({
    preset: p.id,
    endpoint: p.endpoint,
    model: p.model,
    remoteInference: p.remoteInference,
    tokenEnvVar: p.tokenEnvVar,
  });
}

export function liveCatalog(options?: { cwd?: string }): LiveCatalog {
  const cwd = resolveLiveCwd(options?.cwd);
  return {
    kind: "live-catalog",
    schema: DESK_ENDPOINT_SCHEMA,
    configPath: resolveDeskEndpointPath({ cwd }),
    presets: LIVE_PRESETS,
    checklistPreview: formatLocalBrainDoctorChecklist(),
    honesty: HONESTY,
    spendBanner: SPEND_BANNER,
    defaults: defaultConfig(),
  };
}

export function loadLiveEndpointConfig(options?: {
  cwd?: string;
}): LiveLoadResult {
  const cwd = resolveLiveCwd(options?.cwd);
  const configPath = resolveDeskEndpointPath({ cwd });
  if (!fs.existsSync(configPath)) {
    return {
      kind: "live-load",
      config: null,
      configPath,
      exists: false,
      honesty: HONESTY,
    };
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<
    string,
    unknown
  >;
  // Refuse loading files that embed secret values
  for (const key of Object.keys(raw)) {
    if (/token|api[_-]?key|secret|password|authorization/i.test(key)) {
      if (key !== "tokenEnvVar") {
        throw new LiveEndpointError(
          `Config refuses secret field "${key}" — store only tokenEnvVar name, never the value`,
          "SECRET_FIELD_REFUSED",
        );
      }
    }
  }
  const config = sanitizeLiveConfig({
    schema: DESK_ENDPOINT_SCHEMA,
    preset: raw.preset as LivePresetId,
    endpoint: String(raw.endpoint || ""),
    model: String(raw.model || ""),
    remoteInference: raw.remoteInference === true,
    tokenEnvVar:
      typeof raw.tokenEnvVar === "string" ? raw.tokenEnvVar : undefined,
    note: typeof raw.note === "string" ? raw.note : undefined,
  });
  return {
    kind: "live-load",
    config,
    configPath,
    exists: true,
    honesty: HONESTY,
  };
}

export function saveLiveEndpointConfig(
  input: Partial<LiveEndpointConfig>,
  options?: { cwd?: string },
): LiveSaveResult {
  const cwd = resolveLiveCwd(options?.cwd);
  const configPath = resolveDeskEndpointPath({ cwd });
  const dir = path.dirname(configPath);
  // Ensure .zeroday stays under sandbox
  assertPathAllowed(dir, { cwd, label: ".zeroday" });
  fs.mkdirSync(dir, { recursive: true });

  const config = sanitizeLiveConfig(input);
  const serialized = JSON.stringify(config, null, 2) + "\n";
  // Defense: never write env secret values into the file
  assertNoSecretLeak(serialized, config.tokenEnvVar);
  fs.writeFileSync(configPath, serialized, "utf8");

  return {
    kind: "live-save",
    config,
    configPath,
    honesty: HONESTY,
  };
}

function assertNoSecretLeak(text: string, tokenEnvVar?: string): void {
  if (!tokenEnvVar) return;
  const val = process.env[tokenEnvVar];
  if (val && val.length >= 8 && text.includes(val)) {
    throw new LiveEndpointError(
      `Refusing to persist or return secret value from $${tokenEnvVar}`,
      "TOKEN_LEAK_REFUSED",
    );
  }
}

export async function runLiveDoctor(
  req: LiveRunRequest,
): Promise<LiveDoctorResult> {
  const cwd = resolveLiveCwd(req.cwd);
  let endpoint = req.endpoint?.trim();
  let model = req.model?.trim();
  let remoteInference = req.remoteInference === true;

  if (!endpoint) {
    const loaded = loadLiveEndpointConfig({ cwd });
    if (!loaded.config) {
      throw new LiveEndpointError(
        "No endpoint configured — save a preset first or pass endpoint",
        "NO_CONFIG",
      );
    }
    endpoint = loaded.config.endpoint;
    model = model || loaded.config.model;
    remoteInference = remoteInference || loaded.config.remoteInference;
  }
  model = model || DEFAULT_ANTARES_MODEL;

  const shape = checkLocalBrainEndpointShape(endpoint);
  const checks: LiveDoctorCheckItem[] = [
    {
      id: "completions-shape",
      ok: shape.ok,
      label: "Completions URL shape (not chat-only)",
      detail: shape.detail,
    },
    {
      id: "loopback-or-ack",
      ok: shape.ok
        ? !shape.remoteAckRequired ||
          remoteInferenceAcked({ remoteInference })
        : false,
      label: "Loopback or remote-inference ACK",
      detail: !shape.ok
        ? "Skipped — fix endpoint shape first"
        : shape.remoteAckRequired
          ? remoteInferenceAcked({ remoteInference })
            ? "Non-loopback ACK present (UI checkbox / env)"
            : "Non-loopback host requires remoteInference checkbox or ZERODAY_REMOTE_INFERENCE_ACK=1"
          : "Loopback — remote ACK not required",
    },
  ];

  let probe: CompletionsProbeResult | undefined;
  if (shape.ok) {
    probe =
      req.probeResult ??
      (await probeCompletionsEndpoint(shape.endpoint || endpoint, {
        fetchImpl: req.probeFetch,
      }));
    checks.push({
      id: "endpoint-ping",
      ok: probe.ok,
      label: "Doctor ping (GET /v1/models)",
      detail: probe.detail,
    });
  } else {
    checks.push({
      id: "endpoint-ping",
      ok: false,
      label: "Doctor ping (GET /v1/models)",
      detail: "Skipped — bad endpoint shape",
    });
  }

  const ok = checks.every((c) => c.ok);
  return {
    kind: "live-doctor",
    ok,
    shape,
    probe,
    checks,
    checklist: formatLocalBrainDoctorChecklist(),
    endpoint: shape.endpoint || endpoint,
    model,
    remoteInference,
    remoteAckRequired: shape.remoteAckRequired,
    honesty: HONESTY,
  };
}

function scanArtifactsForTokenLeak(
  paths: string[],
  tokenEnvVar?: string,
): { scanned: boolean; leaked: boolean } {
  if (!tokenEnvVar) return { scanned: true, leaked: false };
  const val = process.env[tokenEnvVar];
  if (!val || val.length < 8) return { scanned: true, leaked: false };
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    if (text.includes(val)) return { scanned: true, leaked: true };
  }
  return { scanned: true, leaked: false };
}

export async function runLiveLocate(
  req: LiveRunRequest,
): Promise<LiveLocateResult> {
  const cwd = resolveLiveCwd(req.cwd);

  if (req.spendAcknowledged !== true) {
    throw new LiveEndpointError(
      `Live locate refused without spend confirmation. ${SPEND_BANNER}`,
      "SPEND_ACK_REQUIRED",
    );
  }

  let endpoint = req.endpoint?.trim();
  let model = req.model?.trim();
  let remoteInference = req.remoteInference === true;
  let tokenEnvVar: string | undefined = sanitizeTokenEnvVar(req.tokenEnvVar);

  if (!endpoint) {
    const loaded = loadLiveEndpointConfig({ cwd });
    if (!loaded.config) {
      throw new LiveEndpointError(
        "No endpoint configured — save first",
        "NO_CONFIG",
      );
    }
    endpoint = loaded.config.endpoint;
    model = model || loaded.config.model;
    remoteInference = remoteInference || loaded.config.remoteInference;
    tokenEnvVar = tokenEnvVar || loaded.config.tokenEnvVar;
  }
  model = model || DEFAULT_ANTARES_MODEL;

  // Enforce live-guard (chat refuse + remote ACK) before locate
  resolveLocateMode({
    live: true,
    endpoint,
    remoteInference,
  });

  const repoRel =
    req.repo?.trim() || path.join("fixtures", "locate", "rules-sample");
  const repo = assertPathAllowed(repoRel, {
    cwd,
    mustExist: true,
    kind: "dir",
    label: "repo",
  });
  const outputDir = resolveOutputDir(
    req.output,
    `desk-live-${Date.now()}`,
    { cwd },
  );

  const artifacts = await locate({
    repo,
    advisory: (req.cwe || "CWE-89").trim(),
    live: true,
    endpoint,
    model,
    remoteInference,
    outputDir,
    probeResult: req.locateProbeResult ?? req.probeResult,
    probeFetch: req.probeFetch,
  });

  const paths = {
    json: artifacts.jsonPath,
    sarif: artifacts.sarifPath,
    report: artifacts.reportPath,
  };
  const tokenHygiene = scanArtifactsForTokenLeak(
    [paths.json, paths.sarif, paths.report],
    tokenEnvVar,
  );
  if (tokenHygiene.leaked) {
    throw new LiveEndpointError(
      `Token value from $${tokenEnvVar} appeared in locate artifacts — refusing to return report (hygiene fail)`,
      "TOKEN_IN_REPORT",
    );
  }

  // Also scrub response text
  const responseProbe = JSON.stringify({
    endpoint,
    model,
    paths,
  });
  assertNoSecretLeak(responseProbe, tokenEnvVar);

  return {
    kind: "live-locate",
    mode: artifacts.result.mode,
    action: "live",
    advisory: artifacts.result.advisory.id,
    cweId: artifacts.result.advisory.cweId,
    findingCount: artifacts.result.summary.findingCount,
    rankedFiles: artifacts.result.rankedFiles.map((f) => ({
      rank: f.rank,
      filePath: f.filePath,
      title: f.title,
      cweIds: f.cweIds,
    })),
    outputDir: artifacts.outputDir,
    paths,
    endpoint: normalizeCompletionsEndpoint(endpoint).replace(
      /\/completions$/i,
      "",
    ),
    model,
    remoteInference:
      remoteInference || remoteInferenceAcked({ remoteInference }),
    warnings: artifacts.result.warnings,
    needs_human: true,
    honesty: `${SPEND_BANNER} · needs_human · no PoC · localization ≠ exploitability`,
    tokenHygiene,
  };
}

export async function runLiveAction(
  req: LiveRunRequest,
): Promise<LiveResult> {
  const action = req.action;
  if (!action || !LIVE_ACTIONS.includes(action)) {
    throw new Error(`action must be one of: ${LIVE_ACTIONS.join("|")}`);
  }
  switch (action) {
    case "catalog":
      return liveCatalog({ cwd: req.cwd });
    case "load":
      return loadLiveEndpointConfig({ cwd: req.cwd });
    case "save": {
      // Preset fills defaults when endpoint omitted; explicit fields win.
      const fromPreset =
        req.preset && req.preset !== "custom"
          ? applyPreset(req.preset)
          : null;
      return saveLiveEndpointConfig(
        {
          preset: req.preset || fromPreset?.preset || "custom",
          endpoint: req.endpoint?.trim() || fromPreset?.endpoint,
          model: req.model?.trim() || fromPreset?.model,
          remoteInference:
            req.remoteInference ?? fromPreset?.remoteInference ?? false,
          tokenEnvVar:
            req.tokenEnvVar !== undefined
              ? req.tokenEnvVar
              : fromPreset?.tokenEnvVar,
          note: req.note,
        },
        { cwd: req.cwd },
      );
    }
    case "doctor":
      return runLiveDoctor(req);
    case "locate":
      return runLiveLocate(req);
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

export { PathPolicyError, SPEND_BANNER };

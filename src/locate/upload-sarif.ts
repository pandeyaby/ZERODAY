/**
 * Upload a locate SARIF to GitHub Code Scanning
 * (`POST /repos/{owner}/{repo}/code-scanning/sarifs`).
 *
 * Localization SARIF only — not exploit proof. Live upload needs
 * `security_events: write` (Actions: `security-events: write`).
 * Dry-run never hits the network.
 */

import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isValidSarifShape } from "./sarif";

export const UPLOAD_SARIF_POSTURE = {
  localizationOnly: true,
  notExploitProof: true,
  requiresSecurityEventsWrite: true,
} as const;

export class UploadSarifError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadSarifError";
    this.code = code;
  }
}

export interface UploadSarifRequestBody {
  commit_sha: string;
  ref: string;
  sarif: string;
  tool_name?: string;
}

export interface UploadSarifPayload {
  owner: string;
  repo: string;
  endpoint: string;
  method: "POST";
  accept: "application/vnd.github+json";
  body: UploadSarifRequestBody;
  sarifBytes: number;
  sarifGzipBase64Bytes: number;
  dryRun: boolean;
  posture: typeof UPLOAD_SARIF_POSTURE;
}

export interface UploadSarifOptions {
  /** Path to SARIF 2.1 file (required). */
  sarifPath: string;
  /** owner/repo — defaults from GITHUB_REPOSITORY or `gh repo view`. */
  repository?: string;
  /** Git ref, e.g. refs/heads/main or refs/pull/1/head. */
  ref?: string;
  /** Full commit SHA (40 hex). */
  commit?: string;
  /** Optional tool_name override for the API body. */
  toolName?: string;
  /** When true, validate + build payload but never call GitHub. */
  dryRun?: boolean;
  /** Optional path to write the dry-run request JSON. */
  writeRequest?: string;
  /**
   * Injectable transport for tests. Must not be called when dryRun=true.
   * Default uses `gh api` (same ecosystem path as Actions upload-sarif).
   */
  transport?: (payload: UploadSarifPayload) => UploadSarifResult;
}

export interface UploadSarifResult {
  ok: boolean;
  dryRun: boolean;
  payload: UploadSarifPayload;
  /** Present on live upload when GitHub returns an id. */
  uploadId?: string;
  message: string;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/**
 * Fail-closed SARIF load: missing file, bad JSON, or invalid 2.1 shape → throw.
 */
export function loadAndValidateSarif(sarifPath: string): {
  resolved: string;
  raw: string;
  doc: unknown;
  bytes: number;
} {
  const resolved = path.resolve(sarifPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new UploadSarifError(
      "missing_sarif",
      `SARIF file not found: ${resolved}`,
    );
  }
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (e) {
    throw new UploadSarifError(
      "unreadable_sarif",
      `Cannot read SARIF: ${resolved} (${(e as Error).message})`,
    );
  }
  if (!raw.trim()) {
    throw new UploadSarifError(
      "invalid_sarif",
      `SARIF file is empty: ${resolved}`,
    );
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    throw new UploadSarifError(
      "invalid_sarif",
      `SARIF is not valid JSON: ${resolved} (${(e as Error).message})`,
    );
  }
  if (!isValidSarifShape(doc)) {
    throw new UploadSarifError(
      "invalid_sarif",
      `Invalid SARIF 2.1 shape (need version 2.1.0, runs[0].tool.driver, results[]): ${resolved}`,
    );
  }
  return { resolved, raw, doc, bytes: Buffer.byteLength(raw, "utf8") };
}

/** Gzip then base64 — GitHub Code Scanning contract. */
export function encodeSarifForGitHub(sarifUtf8: string): string {
  const gz = gzipSync(Buffer.from(sarifUtf8, "utf8"));
  return gz.toString("base64");
}

export function parseOwnerRepo(spec: string): { owner: string; repo: string } {
  const cleaned = spec.trim().replace(/\.git$/, "");
  const urlMatch = cleaned.match(
    /(?:github\.com[/:]|:)([\w.-]+)\/([\w.-]+)$/i,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const slash = cleaned.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (slash) {
    return { owner: slash[1], repo: slash[2] };
  }
  throw new UploadSarifError(
    "bad_repository",
    `Repository must be owner/repo (got: ${spec})`,
  );
}

function gitRevParse(arg: string): string | undefined {
  const r = spawnSync("git", ["rev-parse", arg], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  if (r.status !== 0) return undefined;
  const out = (r.stdout || "").trim();
  return out || undefined;
}

function resolveCommit(explicit?: string): string {
  if (explicit?.trim()) {
    const c = explicit.trim();
    if (!/^[0-9a-f]{40}$/i.test(c)) {
      throw new UploadSarifError(
        "bad_commit",
        `commit must be a 40-char hex SHA (got: ${c})`,
      );
    }
    return c.toLowerCase();
  }
  const fromEnv =
    process.env.GITHUB_SHA?.trim() ||
    process.env.ZERODAY_UPLOAD_COMMIT?.trim();
  if (fromEnv && /^[0-9a-f]{40}$/i.test(fromEnv)) {
    return fromEnv.toLowerCase();
  }
  const head = gitRevParse("HEAD");
  if (head && /^[0-9a-f]{40}$/i.test(head)) return head.toLowerCase();
  throw new UploadSarifError(
    "missing_commit",
    "Provide --commit <sha> (or set GITHUB_SHA / run inside a git checkout)",
  );
}

function resolveRef(explicit?: string): string {
  if (explicit?.trim()) {
    const r = explicit.trim();
    if (r.startsWith("refs/")) return r;
    if (/^[\w./-]+$/.test(r) && !r.includes("..")) {
      return `refs/heads/${r}`;
    }
    throw new UploadSarifError("bad_ref", `Invalid git ref: ${r}`);
  }
  const prRef = process.env.GITHUB_REF?.trim();
  if (prRef?.startsWith("refs/")) return prRef;
  const fromEnv = process.env.ZERODAY_UPLOAD_REF?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("refs/") ? fromEnv : `refs/heads/${fromEnv}`;
  }
  const abbrev = gitRevParse("--abbrev-ref HEAD");
  if (abbrev && abbrev !== "HEAD") {
    return `refs/heads/${abbrev}`;
  }
  throw new UploadSarifError(
    "missing_ref",
    "Provide --ref refs/heads/<branch> (or set GITHUB_REF)",
  );
}

function resolveRepository(explicit?: string): { owner: string; repo: string } {
  if (explicit?.trim()) return parseOwnerRepo(explicit.trim());
  const env =
    process.env.GITHUB_REPOSITORY?.trim() ||
    process.env.ZERODAY_UPLOAD_REPO?.trim();
  if (env) return parseOwnerRepo(env);

  const gh = spawnSync(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
    { encoding: "utf8", cwd: process.cwd() },
  );
  if (gh.status === 0 && (gh.stdout || "").trim()) {
    return parseOwnerRepo((gh.stdout || "").trim());
  }
  throw new UploadSarifError(
    "missing_repository",
    "Provide --repository owner/repo (or set GITHUB_REPOSITORY / use gh auth)",
  );
}

function toolNameFromSarif(doc: unknown): string | undefined {
  const root = asRecord(doc);
  const runs = Array.isArray(root?.runs) ? root!.runs : [];
  const run0 = asRecord(runs[0]);
  const tool = asRecord(run0?.tool);
  const driver = asRecord(tool?.driver);
  return typeof driver?.name === "string" ? driver.name : undefined;
}

export function buildUploadPayload(
  opts: Omit<UploadSarifOptions, "dryRun" | "transport" | "writeRequest"> & {
    dryRun: boolean;
  },
): UploadSarifPayload {
  const loaded = loadAndValidateSarif(opts.sarifPath);
  const { owner, repo } = resolveRepository(opts.repository);
  const ref = resolveRef(opts.ref);
  const commit_sha = resolveCommit(opts.commit);
  const sarif = encodeSarifForGitHub(loaded.raw);
  const tool =
    opts.toolName?.trim() || toolNameFromSarif(loaded.doc) || "ZERODAY";

  return {
    owner,
    repo,
    endpoint: `/repos/${owner}/${repo}/code-scanning/sarifs`,
    method: "POST",
    accept: "application/vnd.github+json",
    body: {
      commit_sha,
      ref,
      sarif,
      tool_name: tool,
    },
    sarifBytes: loaded.bytes,
    sarifGzipBase64Bytes: Buffer.byteLength(sarif, "utf8"),
    dryRun: opts.dryRun,
    posture: UPLOAD_SARIF_POSTURE,
  };
}

/**
 * Default live transport: `gh api` POST.
 * Never used when dryRun=true.
 */
export function ghApiUploadTransport(
  payload: UploadSarifPayload,
): UploadSarifResult {
  if (payload.dryRun) {
    throw new UploadSarifError(
      "dry_run_transport",
      "Internal error: transport invoked during dry-run",
    );
  }
  const bodyJson = JSON.stringify(payload.body);
  const r = spawnSync(
    "gh",
    [
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      payload.endpoint,
      "--input",
      "-",
    ],
    {
      encoding: "utf8",
      input: bodyJson,
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (r.status !== 0) {
    const err =
      (r.stderr || r.stdout || "").trim() || `gh api exit ${r.status}`;
    throw new UploadSarifError(
      "upload_failed",
      `GitHub SARIF upload failed: ${err}`,
    );
  }
  let uploadId: string | undefined;
  try {
    const parsed = JSON.parse((r.stdout || "").trim() || "{}") as {
      id?: string | number;
    };
    if (parsed.id != null) uploadId = String(parsed.id);
  } catch {
    // response may be empty on some API versions
  }
  return {
    ok: true,
    dryRun: false,
    payload,
    uploadId,
    message: uploadId
      ? `Uploaded SARIF to Code Scanning (id=${uploadId})`
      : "Uploaded SARIF to Code Scanning",
  };
}

/**
 * Build + optionally upload. Dry-run never calls transport / network.
 */
export function uploadSarif(opts: UploadSarifOptions): UploadSarifResult {
  const dryRun = opts.dryRun === true;
  const payload = buildUploadPayload({
    sarifPath: opts.sarifPath,
    repository: opts.repository,
    ref: opts.ref,
    commit: opts.commit,
    toolName: opts.toolName,
    dryRun,
  });

  if (opts.writeRequest) {
    const out = path.resolve(opts.writeRequest);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      payload,
      message:
        `Dry-run OK — would POST ${payload.endpoint} ` +
        `(sarif ${payload.sarifBytes} B → gzip+b64 ${payload.sarifGzipBase64Bytes} B). ` +
        `Localization SARIF only · not exploit proof · live upload needs security_events: write.`,
    };
  }

  const transport = opts.transport ?? ghApiUploadTransport;
  return transport(payload);
}

/** Compact printable request shape (omits full base64 for console). */
export function formatDryRunSummary(payload: UploadSarifPayload): string {
  return [
    "ZERODAY upload-sarif (dry-run)",
    `  method   : ${payload.method}`,
    `  endpoint : ${payload.endpoint}`,
    `  accept   : ${payload.accept}`,
    `  ref      : ${payload.body.ref}`,
    `  commit   : ${payload.body.commit_sha}`,
    `  tool     : ${payload.body.tool_name ?? "—"}`,
    `  sarif    : ${payload.sarifBytes} bytes → gzip+base64 ${payload.sarifGzipBase64Bytes} bytes`,
    `  posture  : localization only · not exploit proof · needs security_events write for live`,
  ].join("\n");
}

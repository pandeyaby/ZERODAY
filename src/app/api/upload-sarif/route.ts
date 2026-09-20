/**
 * GET/POST /api/upload-sarif — Desk Code Scanning upload dry-run.
 *
 * Always dry-run: validates SARIF + returns request JSON from upload-sarif module.
 * Never calls GitHub. Rejects live upload / dryRun:false. Fail-closed on
 * missing/invalid SARIF. Live upload stays CLI with security_events: write.
 */

import { NextResponse } from "next/server";
import {
  runUploadSarifDryRun,
  uploadSarifDeskCatalog,
  UploadSarifDeskError,
  UPLOAD_SARIF_DESK_SCHEMA,
} from "@/desk/upload-sarif";
import { PathPolicyError } from "@/lib/path-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadSarifBody = {
  sarifPath?: unknown;
  fixture?: unknown;
  repository?: unknown;
  ref?: unknown;
  commit?: unknown;
  toolName?: unknown;
  dryRun?: unknown;
  live?: unknown;
  upload?: unknown;
};

const BANNED_KEYS = [
  "token",
  "apiKey",
  "api_key",
  "secret",
  "password",
  "authorization",
  "hfToken",
  "runpodApiKey",
  "RUNPOD_API_KEY",
  "HF_TOKEN",
  "GITHUB_TOKEN",
  "githubToken",
  "ghToken",
] as const;

const LIVE_REFUSED_KEYS = ["live", "upload", "forceLive", "noDryRun"] as const;

function optionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new UploadSarifDeskError(`${field} must be a string`, "FIELD_TYPE");
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new UploadSarifDeskError(`${field} must be a boolean`, "FIELD_TYPE");
  }
  return value;
}

function statusForCode(code: string | undefined): number {
  switch (code) {
    case "missing_sarif":
    case "PATH_POLICY":
      return 404;
    case "LIVE_REFUSED":
    case "SECRET_FIELD_REFUSED":
      return 403;
    case "invalid_sarif":
    case "unreadable_sarif":
    case "bad_repository":
    case "bad_commit":
    case "bad_ref":
    case "missing_commit":
    case "missing_ref":
    case "missing_repository":
    case "FIELD_TYPE":
      return 400;
    case "dry_run_transport":
      return 500;
    default:
      return 400;
  }
}

export async function GET() {
  return NextResponse.json(uploadSarifDeskCatalog());
}

export async function POST(req: Request) {
  let body: UploadSarifBody = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as UploadSarifBody;
    } catch {
      return NextResponse.json(
        {
          error:
            'Expected JSON body (optional { "sarifPath", "fixture", "repository", "ref", "commit" })',
          ok: false,
          dryRun: true,
          schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
        },
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body as object)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing secret/provision field "${key}" — Desk upload-sarif is dry-run only`,
          code: "SECRET_FIELD_REFUSED",
          ok: false,
          dryRun: true,
          schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
        },
        { status: 403 },
      );
    }
  }

  // Fail-closed: never honor live upload from Desk.
  if (body.dryRun === false) {
    return NextResponse.json(
      {
        error:
          "Desk refuses live upload (dryRun:false). Desk is dry-run only; live upload stays CLI with security_events: write.",
        code: "LIVE_REFUSED",
        ok: false,
        dryRun: true,
        schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
      },
      { status: 403 },
    );
  }

  for (const key of LIVE_REFUSED_KEYS) {
    const v = (body as Record<string, unknown>)[key];
    if (v === true) {
      return NextResponse.json(
        {
          error: `Desk refuses "${key}: true" — dry-run only; live upload stays CLI with security_events: write.`,
          code: "LIVE_REFUSED",
          ok: false,
          dryRun: true,
          schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
        },
        { status: 403 },
      );
    }
  }

  try {
    const sarifPath = optionalString(body.sarifPath, "sarifPath");
    const repository = optionalString(body.repository, "repository");
    const ref = optionalString(body.ref, "ref");
    const commit = optionalString(body.commit, "commit");
    const toolName = optionalString(body.toolName, "toolName");
    const fixture = optionalBoolean(body.fixture, "fixture");

    const result = runUploadSarifDryRun({
      sarifPath,
      fixture,
      repository,
      ref,
      commit,
      toolName,
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isDesk = err instanceof UploadSarifDeskError;
    const isPolicy = err instanceof PathPolicyError;
    const code = isDesk
      ? (err as UploadSarifDeskError).code
      : isPolicy
        ? "PATH_POLICY"
        : undefined;
    const status = statusForCode(code);
    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        error: err.message,
        code,
        schemaVersion: UPLOAD_SARIF_DESK_SCHEMA,
      },
      { status },
    );
  }
}

/**
 * GET/POST /api/report — Desk CISO localization summary (zeroday.report/v1).
 *
 * Calls existing `runReport` in-process. Fail-closed. Never invents findings.
 * Localization only — no PoC / exploit / auto-fix. runpod: false —
 * never starts RunPod / no GPU spend. Returns JSON (+ markdown) matching
 * CLI `zeroday report` / `--out report.json|report.md`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  runReport,
  formatReportMarkdown,
  reportCatalog,
  ReportError,
  parseReportTop,
  REPORT_SCHEMA,
  REPORT_DEFAULT_FROM,
  REPORT_REPO_ROOT,
  type ZerodayReport,
} from "@/locate/report-summary";
import { PROVE_DOORS_SCHEMA } from "@/desk/prove-doors";
import {
  assertAllowedReadPath,
  PathPolicyError,
} from "@/lib/path-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  "endpoint",
  "liveUrl",
] as const;

type ReportBody = {
  from?: unknown;
  sarif?: unknown;
  proveDoors?: unknown;
  gpuEvidence?: unknown;
  markdown?: unknown;
  /** Alias for from=fixture default when true. */
  fixture?: unknown;
  /**
   * Optional top-N truncate (same as CLI `--top N`).
   * Positive integer; omit for full ranked list. Fail-closed via parseReportTop.
   */
  top?: unknown;
};

function reportErrorBody(
  message: string,
  code?: string,
  extras?: Record<string, unknown>,
) {
  return {
    ok: false as const,
    error: message,
    ...(code ? { code } : {}),
    schemaVersion: REPORT_SCHEMA,
    runpod: false as const,
    startsRunPod: false as const,
    ...extras,
  };
}

function optionalString(
  value: unknown,
  field: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed || undefined };
}

function optionalBoolean(
  value: unknown,
  field: string,
): { ok: true; value: boolean | undefined } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean` };
  }
  return { ok: true, value };
}

function statusForReportCode(code: string | undefined): number {
  switch (code) {
    case "INPUT_MISSING":
      return 404;
    case "PATH_POLICY":
    case "INPUT_CORRUPT":
    case "INPUT_SCHEMA":
    case "INPUT_INVALID":
    case "FIELD_TYPE":
    case "BAD_JSON":
      return 400;
    case "SECRET_FIELD_REFUSED":
      return 403;
    case "WRITE_FAILED":
      return 500;
    default:
      return 500;
  }
}

/**
 * Optional top-N: omit/null → full list; otherwise fail-closed parseReportTop
 * (same helper as CLI `--top`).
 */
function optionalTop(
  value: unknown,
): { ok: true; value: number | undefined } | { ok: false; error: string; code: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: parseReportTop(value) };
  } catch (e) {
    const err = e as Error;
    const code =
      err instanceof ReportError ? (err as ReportError).code : "INPUT_INVALID";
    return { ok: false, error: err.message, code };
  }
}

function fixtureProveDoorsAbs(): string {
  const fixtureAbs = path.join(REPORT_REPO_ROOT, REPORT_DEFAULT_FROM);
  if (!fs.existsSync(fixtureAbs)) {
    throw new ReportError(
      `Default prove-doors fixture missing: ${fixtureAbs}`,
      "INPUT_MISSING",
    );
  }
  return fixtureAbs;
}

/**
 * Resolve --from:
 * - omitted / "prove-doors" / "fixture" / fixture:true → checked-in sample
 * - otherwise fail-closed Desk read allowlist under package root
 */
function resolveFromPath(
  fromRaw: string | undefined,
  fixtureFlag: boolean | undefined,
): { from: string; source: "fixture" | "path" } {
  const useFixture =
    fixtureFlag === true ||
    !fromRaw ||
    fromRaw === "prove-doors" ||
    fromRaw === "fixture";

  if (useFixture) {
    return { from: fixtureProveDoorsAbs(), source: "fixture" };
  }

  // File (prove-doors.json) or directory (evidence-pack) — runReport decides.
  // PathPolicyError propagates → HTTP 400 (fail-closed allowlist).
  const resolved = assertAllowedReadPath(REPORT_REPO_ROOT, fromRaw, {
    mustExist: true,
    kind: "any",
    label: "from",
  });
  return { from: resolved, source: "path" };
}

function resolveSarifPath(sarifRaw: string | undefined): string | undefined {
  if (!sarifRaw) return undefined;
  return assertAllowedReadPath(REPORT_REPO_ROOT, sarifRaw, {
    mustExist: true,
    kind: "file",
    label: "sarif",
  });
}

function resolveGpuEvidencePath(
  gpuRaw: string | undefined,
): string | undefined {
  if (!gpuRaw) return undefined;
  return assertAllowedReadPath(REPORT_REPO_ROOT, gpuRaw, {
    mustExist: true,
    kind: "file",
    label: "gpuEvidence",
  });
}

function buildReportResponse(
  report: ZerodayReport,
  meta: {
    source: string;
    includeMarkdown: boolean;
  },
) {
  const body: Record<string, unknown> = {
    ok: true as const,
    ...report,
    runpod: false as const,
    startsRunPod: false as const,
    source: meta.source,
  };
  if (meta.includeMarkdown) {
    body.markdown = formatReportMarkdown(report);
  }
  return NextResponse.json(body);
}

async function runReportFromRequest(opts: {
  from?: string;
  sarif?: string;
  proveDoors?: unknown;
  gpuEvidence?: string;
  fixture?: boolean;
  includeMarkdown: boolean;
  /** Positive integer; omit for full ranked list (CLI `--top` semantics). */
  top?: number;
}): Promise<NextResponse> {
  let tmpRoot: string | undefined;

  try {
    let fromPath: string | undefined;
    let sourceLabel = "fixture";

    const sarifPath = resolveSarifPath(opts.sarif);
    const gpuPath = resolveGpuEvidencePath(opts.gpuEvidence);

    if (opts.proveDoors !== undefined) {
      if (
        typeof opts.proveDoors !== "object" ||
        opts.proveDoors === null ||
        Array.isArray(opts.proveDoors)
      ) {
        return NextResponse.json(
          reportErrorBody(
            "proveDoors must be a JSON object (zeroday-prove-doors/v1)",
            "FIELD_TYPE",
          ),
          { status: 400 },
        );
      }
      const raw = opts.proveDoors as Record<string, unknown>;
      if (raw.schemaVersion !== PROVE_DOORS_SCHEMA) {
        return NextResponse.json(
          reportErrorBody(
            `proveDoors.schemaVersion want ${PROVE_DOORS_SCHEMA} got ${String(raw.schemaVersion)}`,
            "INPUT_SCHEMA",
          ),
          { status: 400 },
        );
      }
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-report-"));
      fromPath = path.join(tmpRoot, "prove-doors.json");
      fs.writeFileSync(
        fromPath,
        `${JSON.stringify(opts.proveDoors, null, 2)}\n`,
        "utf8",
      );
      sourceLabel = sarifPath ? "inline-prove-doors+sarif" : "inline-prove-doors";
    } else if (opts.sarif && !opts.from && opts.fixture !== true) {
      // Explicit SARIF-only (no from / fixture) — do not invent prove-doors.
      fromPath = undefined;
      sourceLabel = "sarif";
    } else {
      const resolved = resolveFromPath(opts.from, opts.fixture);
      fromPath = resolved.from;
      sourceLabel = sarifPath ? `${resolved.source}+sarif` : resolved.source;
    }

    if (!fromPath && !sarifPath) {
      return NextResponse.json(
        reportErrorBody(
          "Provide from / proveDoors and/or sarif (or omit body for fixture prove-doors)",
          "INPUT_MISSING",
        ),
        { status: 404 },
      );
    }

    const report = runReport({
      ...(fromPath ? { from: fromPath } : {}),
      ...(sarifPath ? { sarif: sarifPath } : {}),
      ...(gpuPath ? { gpuEvidence: gpuPath } : {}),
      ...(opts.top !== undefined ? { top: opts.top } : {}),
      cwd: REPORT_REPO_ROOT,
    });

    return buildReportResponse(report, {
      source: sourceLabel,
      includeMarkdown: opts.includeMarkdown,
    });
  } catch (e) {
    const err = e as Error;
    const isR = err instanceof ReportError;
    const code = isR
      ? (err as ReportError).code
      : err instanceof PathPolicyError
        ? "PATH_POLICY"
        : undefined;
    return NextResponse.json(
      reportErrorBody(err.message, code),
      { status: statusForReportCode(code) },
    );
  } finally {
    if (tmpRoot) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("catalog") === "1") {
    return NextResponse.json(reportCatalog());
  }

  const fromQ = url.searchParams.get("from") ?? undefined;
  const sarifQ = url.searchParams.get("sarif") ?? undefined;
  const fixtureQ = url.searchParams.get("fixture");
  const mdQ = url.searchParams.get("markdown");
  const topQ = url.searchParams.has("top")
    ? url.searchParams.get("top")
    : undefined;
  const top = optionalTop(topQ);
  if (!top.ok) {
    return NextResponse.json(reportErrorBody(top.error, top.code), {
      status: 400,
    });
  }

  return runReportFromRequest({
    from: fromQ?.trim() || undefined,
    sarif: sarifQ?.trim() || undefined,
    fixture: fixtureQ === "1" || fixtureQ === "true",
    includeMarkdown: mdQ !== "0" && mdQ !== "false",
    top: top.value,
  });
}

export async function POST(req: Request) {
  let body: ReportBody = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ReportBody;
    } catch {
      return NextResponse.json(
        reportErrorBody(
          'Expected JSON body (optional { "from", "sarif", "proveDoors", "fixture", "top" })',
          "BAD_JSON",
        ),
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body as object)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        reportErrorBody(
          `Refusing secret/provision field "${key}" — report never provisions or accepts secrets`,
          "SECRET_FIELD_REFUSED",
        ),
        { status: 403 },
      );
    }
  }

  const from = optionalString(body.from, "from");
  if (!from.ok) {
    return NextResponse.json(reportErrorBody(from.error, "FIELD_TYPE"), {
      status: 400,
    });
  }
  const sarif = optionalString(body.sarif, "sarif");
  if (!sarif.ok) {
    return NextResponse.json(reportErrorBody(sarif.error, "FIELD_TYPE"), {
      status: 400,
    });
  }
  const gpuEvidence = optionalString(body.gpuEvidence, "gpuEvidence");
  if (!gpuEvidence.ok) {
    return NextResponse.json(reportErrorBody(gpuEvidence.error, "FIELD_TYPE"), {
      status: 400,
    });
  }
  const fixture = optionalBoolean(body.fixture, "fixture");
  if (!fixture.ok) {
    return NextResponse.json(reportErrorBody(fixture.error, "FIELD_TYPE"), {
      status: 400,
    });
  }
  const markdown = optionalBoolean(body.markdown, "markdown");
  if (!markdown.ok) {
    return NextResponse.json(reportErrorBody(markdown.error, "FIELD_TYPE"), {
      status: 400,
    });
  }
  const top = optionalTop(body.top);
  if (!top.ok) {
    return NextResponse.json(reportErrorBody(top.error, top.code), {
      status: 400,
    });
  }

  return runReportFromRequest({
    from: from.value,
    sarif: sarif.value,
    proveDoors: body.proveDoors,
    gpuEvidence: gpuEvidence.value,
    fixture: fixture.value,
    includeMarkdown: markdown.value !== false,
    top: top.value,
  });
}

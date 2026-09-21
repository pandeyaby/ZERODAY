/**
 * GET/POST /api/evidence-pack — Desk design-partner evidence pack.
 *
 * POST runs existing `runEvidencePack` in-process (prove-doors + historical
 * gpu-evidence + report + manifest). Fail-closed. Historical gpu-evidence only —
 * never starts RunPod / no GPU spend. Returns pack JSON matching CLI
 * `out/evidence/` file names for browser download (temp write, cleaned up).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  runEvidencePack,
  evidencePackCatalog,
  EvidencePackError,
  EVIDENCE_PACK_SCHEMA,
  EVIDENCE_PACK_DEFAULT_OUT,
  EVIDENCE_PACK_PROVE_DOORS_FILE,
  EVIDENCE_PACK_GPU_EVIDENCE_FILE,
  EVIDENCE_PACK_REPORT_JSON_FILE,
  EVIDENCE_PACK_REPORT_MD_FILE,
  EVIDENCE_PACK_MANIFEST_FILE,
  EVIDENCE_PACK_REPO_ROOT,
  type EvidencePackManifest,
} from "@/locate/evidence-pack";
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

type EvidencePackBody = {
  gpuEvidenceFrom?: unknown;
};

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

export async function GET() {
  return NextResponse.json(evidencePackCatalog());
}

export async function POST(req: Request) {
  let body: EvidencePackBody = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as EvidencePackBody;
    } catch {
      return NextResponse.json(
        {
          error: 'Expected JSON body (optional { "gpuEvidenceFrom" })',
          ok: false,
          schemaVersion: EVIDENCE_PACK_SCHEMA,
          startsRunPod: false,
          historicalGpuEvidenceOnly: true,
        },
        { status: 400 },
      );
    }
  }

  for (const key of Object.keys(body as object)) {
    if ((BANNED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        {
          error: `Refusing secret/provision field "${key}" — evidence-pack never provisions or accepts secrets`,
          code: "SECRET_FIELD_REFUSED",
          ok: false,
          schemaVersion: EVIDENCE_PACK_SCHEMA,
          startsRunPod: false,
          historicalGpuEvidenceOnly: true,
        },
        { status: 403 },
      );
    }
  }

  const gpuEvidenceFrom = optionalString(body.gpuEvidenceFrom, "gpuEvidenceFrom");
  if (!gpuEvidenceFrom.ok) {
    return NextResponse.json(
      {
        error: gpuEvidenceFrom.error,
        code: "FIELD_TYPE",
        ok: false,
        schemaVersion: EVIDENCE_PACK_SCHEMA,
        startsRunPod: false,
        historicalGpuEvidenceOnly: true,
      },
      { status: 400 },
    );
  }

  let gatedGpuFrom: string | undefined;
  if (gpuEvidenceFrom.value) {
    try {
      gatedGpuFrom = assertAllowedReadPath(
        EVIDENCE_PACK_REPO_ROOT,
        gpuEvidenceFrom.value,
        { label: "gpuEvidenceFrom" },
      );
    } catch (e) {
      if (e instanceof PathPolicyError) {
        return NextResponse.json(
          {
            ok: false,
            error: e.message,
            code: "PATH_POLICY",
            schemaVersion: EVIDENCE_PACK_SCHEMA,
            startsRunPod: false,
            historicalGpuEvidenceOnly: true,
          },
          { status: 400 },
        );
      }
      throw e;
    }
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-evidence-pack-"));
  const outDir = path.join(tmpRoot, "evidence");

  try {
    const result = await runEvidencePack({
      out: outDir,
      ...(gatedGpuFrom ? { gpuEvidenceFrom: gatedGpuFrom } : {}),
    });

    // Downloadable manifest uses CLI default out path (not server temp).
    const manifest: EvidencePackManifest = {
      ...result.manifest,
      outDir: EVIDENCE_PACK_DEFAULT_OUT,
    };

    return NextResponse.json({
      ok: true,
      schemaVersion: EVIDENCE_PACK_SCHEMA,
      historicalGpuEvidenceOnly: true as const,
      startsRunPod: false as const,
      defaultOut: EVIDENCE_PACK_DEFAULT_OUT,
      files: {
        [EVIDENCE_PACK_MANIFEST_FILE]: manifest,
        [EVIDENCE_PACK_PROVE_DOORS_FILE]: result.proveDoors,
        [EVIDENCE_PACK_GPU_EVIDENCE_FILE]: result.gpuEvidence,
        [EVIDENCE_PACK_REPORT_JSON_FILE]: result.report,
        [EVIDENCE_PACK_REPORT_MD_FILE]: result.reportMarkdown,
      },
      manifest,
      proveDoors: result.proveDoors,
      gpuEvidence: result.gpuEvidence,
      report: result.report,
      reportMarkdown: result.reportMarkdown,
    });
  } catch (e) {
    const err = e as Error;
    const isEp = err instanceof EvidencePackError;
    const isPolicy = err instanceof PathPolicyError;
    const code = isEp
      ? (err as EvidencePackError).code
      : isPolicy
        ? "PATH_POLICY"
        : undefined;
    const status =
      code === "PATH_POLICY"
        ? 400
        : code === "GPU_EVIDENCE_FAILED"
          ? 422
          : code === "PROVE_DOORS_FAILED"
            ? 422
            : code === "REPORT_FAILED"
              ? 422
              : code === "WRITE_FAILED"
                ? 500
                : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code,
        schemaVersion: EVIDENCE_PACK_SCHEMA,
        startsRunPod: false,
        historicalGpuEvidenceOnly: true,
      },
      { status },
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

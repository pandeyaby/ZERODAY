/**
 * GET /api/gpu-evidence — Desk Prove doors Measured A40 evidence (read-only).
 *
 * Loads checked-in docs/reports/a40-live-locate-20260920.json.
 * Fail-closed: missing → 404 · corrupt/schema → 422.
 * Does not start RunPod / no GPU spend.
 */

import { NextResponse } from "next/server";
import {
  loadGpuEvidence,
  gpuEvidenceCatalog,
  GpuEvidenceError,
} from "@/desk/gpu-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("catalog") === "1") {
    return NextResponse.json(gpuEvidenceCatalog());
  }

  try {
    const result = loadGpuEvidence();
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isGe = err instanceof GpuEvidenceError;
    const code = isGe ? (err as GpuEvidenceError).code : undefined;
    const status =
      code === "EVIDENCE_MISSING"
        ? 404
        : code === "EVIDENCE_CORRUPT" || code === "EVIDENCE_SCHEMA"
          ? 422
          : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code,
        schemaVersion: "zeroday-gpu-evidence/v1",
        startsRunPod: false,
        historical: true,
      },
      { status },
    );
  }
}

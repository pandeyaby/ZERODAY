/**
 * POST /api/reports — list / preview sandboxed zeroday-reports + org cassette
 * record/replay (UI-2). Redact default ON; refuses --no-redact.
 * No live Antares / RunPod / arbitrary file download.
 */

import { NextResponse } from "next/server";
import {
  REPORTS_ACTIONS,
  listReports,
  runReportsAction,
  type ReportsAction,
  type ReportsRunRequest,
  PathPolicyError,
  RecordRefuseError,
} from "@/desk/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listReports());
}

export async function POST(req: Request) {
  let body: ReportsRunRequest = { action: "list" };
  try {
    body = (await req.json()) as ReportsRunRequest;
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with { action }" },
      { status: 400 },
    );
  }

  const action = body.action as ReportsAction | undefined;
  if (!action || !REPORTS_ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        error: `action must be one of: ${REPORTS_ACTIONS.join("|")}`,
      },
      { status: 400 },
    );
  }

  // Hard lock: never honor --no-redact from the UI API
  if (action === "record" && body.redact === false) {
    return NextResponse.json(
      {
        error:
          "Desk UI refuses --no-redact: org cassettes require redaction (Keyless K3 / GRAX).",
        code: "NO_REDACT_REFUSED",
      },
      { status: 403 },
    );
  }

  try {
    const result = await runReportsAction({ ...body, action });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const isPolicy = err instanceof PathPolicyError;
    const isRefuse = err instanceof RecordRefuseError;
    const status = isPolicy || isRefuse ? 403 : 500;
    return NextResponse.json(
      {
        error: err.message,
        code: isPolicy
          ? "PATH_POLICY"
          : isRefuse
            ? "RECORD_REFUSED"
            : undefined,
      },
      { status },
    );
  }
}

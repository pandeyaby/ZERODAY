/**
 * POST /api/desk — Desk Console in-process runners (rules / from-sarif /
 * inventory → packet → harden → classify → craft).
 * Path-sandboxed. Keyless Commands tab — live brain is /api/live (UI-3).
 */

import { NextResponse } from "next/server";
import {
  DESK_ACTIONS,
  deskCatalog,
  runDeskAction,
  type DeskAction,
  type DeskRunRequest,
  PathPolicyError,
} from "@/desk/console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(deskCatalog());
}

export async function POST(req: Request) {
  let body: DeskRunRequest = { action: "catalog" };
  try {
    body = (await req.json()) as DeskRunRequest;
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with { action }" },
      { status: 400 },
    );
  }

  const action = body.action as DeskAction | undefined;
  if (!action || !DESK_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${DESK_ACTIONS.join("|")}` },
      { status: 400 },
    );
  }

  try {
    const result = await runDeskAction({ ...body, action });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    const status = err instanceof PathPolicyError ? 403 : 500;
    return NextResponse.json(
      {
        error: err.message,
        code: err instanceof PathPolicyError ? "PATH_POLICY" : undefined,
      },
      { status },
    );
  }
}

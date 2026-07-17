/**
 * Plinius bridge API — status, research gates, T3MP3ST, ST3GG, research browse.
 */

import { NextRequest, NextResponse } from "next/server";
import { dbRepo } from "@/lib/db/repo";
import { nowIso } from "@/lib/utils";
import { RESEARCH_ACK_STATEMENT, researchGateSummary } from "@/plinius/gates";
import { listPliniusStatus } from "@/plinius/registry";
import type { PliniusLibId } from "@/plinius/paths";
import {
  attemptResearchExecution,
  listResearchCatalog,
  listResearchFiles,
  previewResearchFile,
  researchLibraryReadme,
} from "@/plinius/research/catalog";
import { tempestHealth, tempestKillChainPhases, TEMPEST_ARCHETYPES, tempestDefaultRoE, tempestStrictRoE } from "@/plinius/t3mp3st/adapter";
import {
  st3ggAnalyze,
  st3ggCapacity,
  st3ggDecode,
  st3ggDemoImage,
  st3ggDetect,
  st3ggEncode,
  st3ggStatus,
} from "@/plinius/st3gg/adapter";
import type { ResearchLibId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";
  const settings = dbRepo.getSettings();

  switch (action) {
    case "status":
      return NextResponse.json({
        libraries: listPliniusStatus(),
        research: researchGateSummary(settings),
        t3mp3st: tempestHealth(),
        st3gg: await st3ggStatus(),
      });
    case "research":
      return NextResponse.json({
        gates: researchGateSummary(settings),
        catalog: listResearchCatalog(settings),
        ackStatement: RESEARCH_ACK_STATEMENT,
      });
    case "t3mp3st":
      return NextResponse.json({
        health: tempestHealth(),
        archetypes: TEMPEST_ARCHETYPES,
        roe: { default: tempestDefaultRoE(), strict: tempestStrictRoE() },
        phases: tempestKillChainPhases(),
      });
    case "st3gg":
      return NextResponse.json(await st3ggStatus());
    default:
      return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");
  const settings = dbRepo.getSettings();
  const missionId = body.missionId ? String(body.missionId) : undefined;

  try {
    switch (action) {
      case "acknowledge_research": {
        const by = String(body.acknowledgedBy || "operator");
        const updated = dbRepo.updateSettings({
          researchLibrariesAcknowledged: true,
          researchAcknowledgedAt: nowIso(),
          researchAcknowledgedBy: by,
        });
        return NextResponse.json({
          ok: true,
          settings: updated,
          statement: RESEARCH_ACK_STATEMENT,
        });
      }
      case "update_research_gates": {
        const patch: Record<string, unknown> = {};
        if (typeof body.researchLibrariesEnabled === "boolean") {
          patch.researchLibrariesEnabled = body.researchLibrariesEnabled;
        }
        if (Array.isArray(body.enabledResearchLibs)) {
          patch.enabledResearchLibs = (body.enabledResearchLibs as string[]).filter((id) =>
            ["g0dm0d3", "cl4r1t4s", "l1b3rt4s", "obliteratus"].includes(id)
          ) as ResearchLibId[];
        }
        if (typeof body.allowResearchContentReads === "boolean") {
          patch.allowResearchContentReads = body.allowResearchContentReads;
        }
        if (typeof body.allowResearchExecution === "boolean") {
          patch.allowResearchExecution = body.allowResearchExecution;
        }
        // Turning master off clears spicy flags
        if (patch.researchLibrariesEnabled === false) {
          patch.allowResearchContentReads = false;
          patch.allowResearchExecution = false;
        }
        const updated = dbRepo.updateSettings(patch);
        return NextResponse.json({ ok: true, settings: updated, gates: researchGateSummary(updated) });
      }
      case "research_list": {
        const result = listResearchFiles(settings, String(body.libraryId) as PliniusLibId, {
          missionId,
          prefix: body.prefix ? String(body.prefix) : undefined,
        });
        return NextResponse.json(result, { status: result.ok ? 200 : 403 });
      }
      case "research_preview": {
        const result = previewResearchFile(
          settings,
          String(body.libraryId) as PliniusLibId,
          String(body.relPath),
          { missionId, hasReceipt: Boolean(body.hasReceipt) }
        );
        return NextResponse.json(result, { status: result.ok ? 200 : 403 });
      }
      case "research_readme": {
        const libId = String(body.libraryId) as PliniusLibId;
        const catalog = listResearchCatalog(settings, missionId);
        const entry = catalog.find((c) => c.id === libId);
        if (!entry?.browseable) {
          return NextResponse.json({ ok: false, gate: entry?.gate }, { status: 403 });
        }
        return NextResponse.json({ ok: true, readme: researchLibraryReadme(libId) });
      }
      case "research_execute": {
        const result = attemptResearchExecution(
          settings,
          String(body.libraryId) as PliniusLibId,
          String(body.command || ""),
          { missionId, hasReceipt: Boolean(body.hasReceipt) }
        );
        return NextResponse.json(result, { status: 403 });
      }
      case "st3gg_analyze": {
        const image = String(body.imagePath || st3ggDemoImage());
        const result = await st3ggAnalyze(image, Boolean(body.full));
        return NextResponse.json({ ok: result.ok, result });
      }
      case "st3gg_detect": {
        const image = String(body.imagePath || st3ggDemoImage());
        const result = await st3ggDetect(image);
        return NextResponse.json({ ok: result.ok, result });
      }
      case "st3gg_capacity": {
        const image = String(body.imagePath || st3ggDemoImage());
        const result = await st3ggCapacity(
          image,
          String(body.channels || "RGB"),
          Number(body.bits ?? 1)
        );
        return NextResponse.json({ ok: result.ok, result });
      }
      case "st3gg_encode": {
        // Encode stays spicy — require mission authorization acknowledgment when mission provided
        if (missionId) {
          const mission = dbRepo.getMission(missionId);
          if (!mission?.authorization?.acknowledged) {
            return NextResponse.json(
              { ok: false, error: "Mission authorization required for ST3GG encode" },
              { status: 403 }
            );
          }
        }
        if (!body.receipt) {
          return NextResponse.json(
            { ok: false, error: "receipt required for st3gg_encode", receiptRequired: true },
            { status: 403 }
          );
        }
        const result = await st3ggEncode({
          imagePath: String(body.imagePath || st3ggDemoImage()),
          text: String(body.text || ""),
          outputName: body.outputName ? String(body.outputName) : undefined,
          channels: body.channels ? String(body.channels) : undefined,
          bits: body.bits !== undefined ? Number(body.bits) : undefined,
          password: body.password ? String(body.password) : undefined,
        });
        return NextResponse.json({ ok: result.ok, result });
      }
      case "st3gg_decode": {
        if (!body.receipt) {
          return NextResponse.json(
            { ok: false, error: "receipt required for st3gg_decode", receiptRequired: true },
            { status: 403 }
          );
        }
        const result = await st3ggDecode({
          imagePath: String(body.imagePath),
          password: body.password ? String(body.password) : undefined,
          noAuto: Boolean(body.noAuto),
        });
        return NextResponse.json({ ok: result.ok, result });
      }
      default:
        return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

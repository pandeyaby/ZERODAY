/**
 * Tool Arsenal — adapter registry with mode gates.
 */

import { AUTH_REQUIRED, RECEIPT_REQUIRED, defaultModeForRole } from "@/lib/doctrine/plinian";
import { checkScope } from "@/lib/scope/gate";
import type {
  Mission,
  OperatorRole,
  ToolCallRequest,
  ToolCallResult,
  ToolDefinition,
  ToolMode,
} from "@/lib/types";
import { nowIso, redactSecrets } from "@/lib/utils";
import { captureEvidence } from "@/evidence/vault";
import { generalTools, runGeneralTool } from "@/arsenal/adapters/general";
import { ciscoTools, runCiscoTool } from "@/cisco/adapters/index";
import { splunkTools, runSplunkTool } from "@/splunk/adapters/index";
import { paloaltoTools, runPaloAltoTool } from "@/paloalto/adapters/index";
import { fortinetTools, runFortinetTool } from "@/fortinet/adapters/index";
import { crowdstrikeTools, runCrowdStrikeTool } from "@/crowdstrike/adapters/index";
import { awsTools, runAwsTool } from "@/aws/adapters/index";
import { stegoTools, runStegoTool } from "@/stego/tools";
import { t3mp3stTools, runT3mp3stTool } from "@/plinius/t3mp3st/tools";
import { st3ggTools, runSt3ggTool } from "@/plinius/st3gg/tools";
import { researchTools, runResearchTool } from "@/plinius/research/tools";

const TOOLS: ToolDefinition[] = [
  ...generalTools,
  ...ciscoTools,
  ...splunkTools,
  ...paloaltoTools,
  ...fortinetTools,
  ...crowdstrikeTools,
  ...awsTools,
  ...stegoTools,
  ...t3mp3stTools,
  ...st3ggTools,
  ...researchTools,
];

export function listTools(filter?: { vendor?: string; role?: OperatorRole; mode?: ToolMode }): ToolDefinition[] {
  return TOOLS.filter((t) => {
    if (filter?.vendor && t.vendor !== filter.vendor) return false;
    if (filter?.role && !t.roles.includes(filter.role)) return false;
    if (filter?.mode && t.mode !== filter.mode) return false;
    return true;
  });
}

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}

export interface ExecuteToolContext {
  mission: Mission;
  /** Explicit spicy receipts approved for this session. */
  approvedReceipts?: Set<string>;
  simulate?: boolean;
}

/**
 * Execute a tool under Plinian gates: auth → scope → mode → adapter.
 */
export async function executeTool(
  req: ToolCallRequest,
  ctx: ExecuteToolContext
): Promise<ToolCallResult> {
  const startedAt = nowIso();
  const t0 = Date.now();
  const tool = getTool(req.toolId);

  if (!tool) {
    return fail(req.toolId, startedAt, t0, "safe_local", `Unknown tool: ${req.toolId}`);
  }

  const settingsAuth = true; // doctrine: always check when requireAuthorization
  if (settingsAuth && (!ctx.mission.authorization || !ctx.mission.authorization.acknowledged)) {
    return fail(tool.id, startedAt, t0, tool.mode, AUTH_REQUIRED, { receiptRequired: false });
  }

  const mode: ToolMode = req.modeOverride || tool.mode || defaultModeForRole(req.operatorRole);

  if (mode === "catalog_only") {
    return {
      ok: true,
      toolId: tool.id,
      mode,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      summary: `Catalog only: ${tool.name} — ${tool.description}`,
      data: { catalog: true, tool },
      redacted: false,
    };
  }

  if ((mode === "receipt_required" || tool.spicy) && !ctx.approvedReceipts?.has(tool.id)) {
    return {
      ok: false,
      toolId: tool.id,
      mode,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      summary: RECEIPT_REQUIRED,
      data: { toolId: tool.id, spicy: tool.spicy },
      receiptRequired: true,
      error: RECEIPT_REQUIRED,
      redacted: false,
    };
  }

  // Scope check on any host-like args
  const hostKeys = ["host", "hostname", "target", "url", "baseUrl", "endpoint", "accountId"];
  for (const key of hostKeys) {
    const val = req.args[key];
    if (typeof val === "string" && val.length > 0) {
      // AWS account IDs are scoped via hostname-as-account pattern
      const candidate = key === "accountId" ? val : val;
      const scope = checkScope(candidate, ctx.mission.targets);
      if (!scope.allowed) {
        // Allow 12-digit account IDs when any AWS target exists in scope
        if (
          key === "accountId" &&
          /^\d{12}$/.test(val) &&
          ctx.mission.targets.some((t) => /aws/i.test(`${t.vendor || ""} ${t.product || ""}`) || /^\d{12}$/.test(t.hostname || ""))
        ) {
          continue;
        }
        return {
          ok: false,
          toolId: tool.id,
          mode,
          startedAt,
          finishedAt: nowIso(),
          durationMs: Date.now() - t0,
          summary: scope.reason || "SCOPE DENIED",
          data: {},
          scopeDenied: true,
          error: scope.reason,
          redacted: false,
        };
      }
    }
  }

  try {
    const simulate = ctx.simulate !== false; // default safe simulation
    let data: Record<string, unknown>;
    let summary: string;

    if (tool.id.startsWith("cisco.")) {
      ({ data, summary } = await runCiscoTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    } else if (tool.id.startsWith("splunk.")) {
      ({ data, summary } = await runSplunkTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    } else if (tool.id.startsWith("paloalto.")) {
      ({ data, summary } = await runPaloAltoTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    } else if (tool.id.startsWith("fortinet.")) {
      ({ data, summary } = await runFortinetTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    } else if (tool.id.startsWith("crowdstrike.")) {
      ({ data, summary } = await runCrowdStrikeTool(tool.id, req.args, {
        simulate,
        mission: ctx.mission,
      }));
    } else if (tool.id.startsWith("aws.")) {
      ({ data, summary } = await runAwsTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    } else if (tool.id.startsWith("stego.")) {
      ({ data, summary } = await runStegoTool(tool.id, req.args));
    } else if (tool.id.startsWith("t3mp3st.")) {
      ({ data, summary } = await runT3mp3stTool(tool.id, req.args));
    } else if (tool.id.startsWith("st3gg.")) {
      ({ data, summary } = await runSt3ggTool(tool.id, req.args));
    } else if (tool.id.startsWith("research.")) {
      ({ data, summary } = await runResearchTool(tool.id, req.args, {
        hasReceipt: Boolean(ctx.approvedReceipts?.has(tool.id)),
      }));
    } else {
      ({ data, summary } = await runGeneralTool(tool.id, req.args, { simulate, mission: ctx.mission }));
    }

    data = redactSecrets(data);

    const evidence = captureEvidence({
      missionId: req.missionId,
      operatorRole: req.operatorRole,
      toolId: tool.id,
      kind: tool.id.startsWith("stego.") ? "stego" : "tool_output",
      title: `${tool.name} result`,
      summary,
      payload: { args: redactSecrets(req.args), result: data, mode, simulate },
      tags: [tool.category, tool.vendor || "general", mode],
    });

    return {
      ok: true,
      toolId: tool.id,
      mode,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      summary,
      data,
      evidenceId: evidence.id,
      redacted: true,
    };
  } catch (err) {
    return fail(
      tool.id,
      startedAt,
      t0,
      mode,
      err instanceof Error ? err.message : String(err)
    );
  }
}

function fail(
  toolId: string,
  startedAt: string,
  t0: number,
  mode: ToolMode,
  error: string,
  extra?: Partial<ToolCallResult>
): ToolCallResult {
  return {
    ok: false,
    toolId,
    mode,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Date.now() - t0,
    summary: error,
    data: {},
    error,
    redacted: false,
    ...extra,
  };
}


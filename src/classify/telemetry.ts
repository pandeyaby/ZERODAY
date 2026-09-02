/**
 * Local telemetry fixture schema (INPUT only — not a scanner we invent).
 * NetFlow-like / firewall / agent-session shaped JSON for classifier fixtures.
 * No live Cisco / Splunk / Talos feeds.
 */

export const TELEMETRY_SCHEMA = "zeroday-telemetry-v1" as const;

export type TelemetryEventType =
  | "netflow"
  | "firewall"
  | "agent_session"
  | "infra";

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  type: TelemetryEventType;
  src_host?: string;
  dst_host?: string;
  action?: string;
  protocol?: string;
  /** Free-text analyst note in the fixture — not attack steps */
  notes?: string;
  /** Optional tags the fixture author sets for deterministic classification */
  tags?: string[];
  /** Infra failure code when type=infra */
  failure_code?: string;
  /** Agent id when type=agent_session */
  agent_id?: string;
}

export interface TelemetryFixture {
  schema: typeof TELEMETRY_SCHEMA;
  source: "fixture";
  title: string;
  description?: string;
  events: TelemetryEvent[];
}

export function isTelemetryFixture(doc: unknown): doc is TelemetryFixture {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  if (d.schema !== TELEMETRY_SCHEMA) return false;
  if (d.source !== "fixture") return false;
  if (!Array.isArray(d.events)) return false;
  return true;
}

/** Heuristic: distinct hosts with east-west / lateral-looking tags or actions */
export function hasLateralMovement(events: TelemetryEvent[]): boolean {
  const hosts = new Set<string>();
  let lateralTagged = false;
  for (const e of events) {
    if (e.src_host) hosts.add(e.src_host);
    if (e.dst_host) hosts.add(e.dst_host);
    const tags = (e.tags ?? []).map((t) => t.toLowerCase());
    const action = (e.action ?? "").toLowerCase();
    const notes = (e.notes ?? "").toLowerCase();
    if (
      tags.includes("lateral_movement") ||
      tags.includes("east_west") ||
      action.includes("lateral") ||
      notes.includes("lateral movement")
    ) {
      lateralTagged = true;
    }
  }
  return lateralTagged || (hosts.size >= 3 && events.some((e) => e.type === "netflow" || e.type === "firewall"));
}

export function hasInfraFailure(events: TelemetryEvent[]): boolean {
  return events.some((e) => {
    if (e.type !== "infra") return false;
    const tags = (e.tags ?? []).map((t) => t.toLowerCase());
    return (
      Boolean(e.failure_code) ||
      tags.includes("infra_failure") ||
      tags.includes("outage") ||
      /(timeout|unreachable|dns|cert|capacity)/i.test(e.notes ?? "")
    );
  });
}

export function hasAgentMisfire(events: TelemetryEvent[]): boolean {
  return events.some((e) => {
    if (e.type !== "agent_session") return false;
    const tags = (e.tags ?? []).map((t) => t.toLowerCase());
    const notes = (e.notes ?? "").toLowerCase();
    const action = (e.action ?? "").toLowerCase();
    return (
      tags.includes("agent_misfire") ||
      tags.includes("bad_judgment") ||
      tags.includes("tool_loop") ||
      action.includes("misfire") ||
      notes.includes("agent misfire") ||
      notes.includes("bad judgment") ||
      notes.includes("tool loop") ||
      notes.includes("legitimate agent")
    );
  });
}

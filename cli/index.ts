#!/usr/bin/env node
/**
 * ZERODAY CLI — headless / CI parity with the War Room.
 *
 * Usage:
 *   npx tsx cli/index.ts health
 *   npx tsx cli/index.ts missions
 *   npx tsx cli/index.ts launch "Assess Cisco DNA + Splunk staging"
 *   npx tsx cli/index.ts authorize <missionId> --by "Lead"
 *   npx tsx cli/index.ts start <missionId>
 *   npx tsx cli/index.ts status <missionId>
 *   npx tsx cli/index.ts stego transform --id base64 --text "hello"
 */

import { Command } from "commander";

const BASE = process.env.ZERODAY_URL || "http://127.0.0.1:3333";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exitCode = 1;
    return json;
  }
  console.log(JSON.stringify(json, null, 2));
  return json;
}

const program = new Command();
program.name("zeroday").description("ZERODAY — enterprise AI red team CLI").version("0.1.0");

program
  .command("health")
  .description("Check War Room API health")
  .action(async () => {
    await api("/api/health");
  });

program
  .command("missions")
  .description("List missions")
  .action(async () => {
    await api("/api/missions");
  });

program
  .command("launch")
  .argument("<brief>", "Natural language mission brief")
  .description("Create a mission from a brief")
  .action(async (brief: string) => {
    await api("/api/missions", { method: "POST", body: JSON.stringify({ brief }) });
  });

program
  .command("authorize")
  .argument("<missionId>")
  .option("--by <name>", "Authorizing person", "CLI Operator")
  .action(async (missionId: string, opts: { by: string }) => {
    await api("/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "authorize", missionId, authorizedBy: opts.by }),
    });
  });

program
  .command("start")
  .argument("<missionId>")
  .action(async (missionId: string) => {
    await api("/api/missions", {
      method: "POST",
      body: JSON.stringify({ action: "start", missionId }),
    });
  });

program
  .command("status")
  .argument("<missionId>")
  .action(async (missionId: string) => {
    await api(`/api/missions/${missionId}`);
  });

program
  .command("findings")
  .argument("[missionId]")
  .action(async (missionId?: string) => {
    const q = missionId ? `?missionId=${missionId}` : "";
    await api(`/api/findings${q}`);
  });

program
  .command("stego")
  .argument("<action>")
  .option("--id <transformId>", "Transform id", "base64")
  .option("--text <text>", "Input text", "")
  .action(async (action: string, opts: { id: string; text: string }) => {
    await api("/api/stego", {
      method: "POST",
      body: JSON.stringify({
        action,
        transformId: opts.id,
        text: opts.text,
        prompt: opts.text,
      }),
    });
  });

program
  .command("plinius")
  .argument("[action]", "status|research|t3mp3st|st3gg", "status")
  .description("Plinius bridge status / research gates / adapters")
  .action(async (action: string) => {
    await api(`/api/plinius?action=${encodeURIComponent(action || "status")}`);
  });

program.parseAsync(process.argv);

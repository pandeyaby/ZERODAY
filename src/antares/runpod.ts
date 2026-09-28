/**
 * `zeroday antares up | down | status` — Antares-1B on a RunPod GPU in one command.
 *
 * Runs only when the operator types `antares up` and confirms: the pod is
 * created on the operator's own RunPod account (RUNPOD_API_KEY) with their own
 * Hugging Face token (terms for fdtn-ai/antares-1b accepted by them), both read
 * from the environment and never written to disk. Every pod gets a deadline: a
 * detached watchdog deletes it when the deadline passes, and `antares down`
 * deletes it sooner. State lives in .zeroday/antares-pod.json (no secrets).
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export const RUNPOD_API = "https://rest.runpod.io/v1";
export const DEFAULT_GPUS = ["NVIDIA A40", "NVIDIA L40S", "NVIDIA RTX A6000"];
export const DEFAULT_MODEL = "fdtn-ai/antares-1b";
/** cisco-antares-cli 0.1 plans for a 16K context window. */
export const DEFAULT_MAX_MODEL_LEN = 16384;
export const DEFAULT_MAX_MINUTES = 30;
const STATE_REL = path.join(".zeroday", "antares-pod.json");
const DESK_ENDPOINT_REL = path.join(".zeroday", "desk-endpoint.json");

export interface PodState {
  podId: string;
  gpu: string | null;
  model: string;
  endpoint: string;
  createdAt: string;
  deadline: string;
  maxMinutes: number;
  costPerHr: number | null;
  watchdogPid?: number;
  readyAt?: string;
  deletedAt?: string;
}

export class RunpodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunpodError";
  }
}

export function statePath(cwd = process.cwd()): string {
  return path.join(cwd, STATE_REL);
}

export function readState(cwd = process.cwd()): PodState | null {
  try {
    return JSON.parse(fs.readFileSync(statePath(cwd), "utf8")) as PodState;
  } catch {
    return null;
  }
}

export function writeState(state: PodState, cwd = process.cwd()): void {
  fs.mkdirSync(path.dirname(statePath(cwd)), { recursive: true });
  fs.writeFileSync(statePath(cwd), JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
}

export function runpodKey(env = process.env): string {
  const key = env.RUNPOD_API_KEY?.trim();
  if (!key) throw new RunpodError("RUNPOD_API_KEY is not set. Create one at https://www.runpod.io/console/user/settings and export it.");
  return key;
}

export function hfToken(env = process.env): string {
  const t = (env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN || "").trim();
  if (!t) {
    throw new RunpodError(
      "HF_TOKEN is not set. Accept the terms at https://huggingface.co/fdtn-ai/antares-1b, create a read token, and export HF_TOKEN.",
    );
  }
  return t;
}

async function api<T>(method: string, route: string, key: string, body?: unknown): Promise<{ status: number; data: T | null; text: string }> {
  const res = await fetch(`${RUNPOD_API}${route}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, data, text: text.slice(0, 500) };
}

export function proxyEndpoint(podId: string): string {
  return `https://${podId}-8000.proxy.runpod.net/v1`;
}

export interface CreatePodOptions {
  gpus?: string[];
  model?: string;
  maxModelLen?: number;
  maxMinutes?: number;
  env?: NodeJS.ProcessEnv;
}

export async function createPod(opts: CreatePodOptions = {}): Promise<PodState> {
  const key = runpodKey(opts.env);
  const token = hfToken(opts.env);
  const model = opts.model ?? DEFAULT_MODEL;
  const maxMinutes = opts.maxMinutes ?? DEFAULT_MAX_MINUTES;
  const res = await api<{ id?: string; costPerHr?: number; machine?: { gpuTypeId?: string }; gpu?: { id?: string } }>("POST", "/pods", key, {
    name: `zeroday-antares-${Date.now().toString(36)}`,
    imageName: "vllm/vllm-openai:latest",
    gpuTypeIds: opts.gpus ?? DEFAULT_GPUS,
    gpuCount: 1,
    cloudType: "SECURE",
    interruptible: false,
    containerDiskInGb: 40,
    volumeInGb: 0,
    ports: ["8000/http"],
    env: { HF_TOKEN: token, HUGGING_FACE_HUB_TOKEN: token },
    dockerStartCmd: ["--model", model, "--max-model-len", String(opts.maxModelLen ?? DEFAULT_MAX_MODEL_LEN), "--host", "0.0.0.0", "--port", "8000"],
  });
  if (res.status >= 300 || !res.data?.id) {
    throw new RunpodError(`RunPod did not create the pod (HTTP ${res.status}): ${res.text}`);
  }
  const now = new Date();
  return {
    podId: res.data.id,
    gpu: res.data.machine?.gpuTypeId ?? res.data.gpu?.id ?? null,
    model,
    endpoint: proxyEndpoint(res.data.id),
    createdAt: now.toISOString(),
    deadline: new Date(now.getTime() + maxMinutes * 60_000).toISOString(),
    maxMinutes,
    costPerHr: typeof res.data.costPerHr === "number" ? res.data.costPerHr : null,
  };
}

export async function getPod(podId: string, env = process.env): Promise<{ exists: boolean; desiredStatus?: string; costPerHr?: number; gpu?: string }> {
  const res = await api<{ desiredStatus?: string; costPerHr?: number; machine?: { gpuTypeId?: string } }>("GET", `/pods/${podId}`, runpodKey(env));
  if (res.status === 404) return { exists: false };
  if (res.status >= 300) throw new RunpodError(`RunPod GET pod failed (HTTP ${res.status}): ${res.text}`);
  const d = res.data ?? {};
  return {
    exists: d.desiredStatus !== "TERMINATED",
    ...(d.desiredStatus ? { desiredStatus: d.desiredStatus } : {}),
    ...(typeof d.costPerHr === "number" ? { costPerHr: d.costPerHr } : {}),
    ...(d.machine?.gpuTypeId ? { gpu: d.machine.gpuTypeId } : {}),
  };
}

/** Deletes the pod; true once RunPod no longer reports it running. */
export async function deletePod(podId: string, env = process.env): Promise<boolean> {
  const res = await api("DELETE", `/pods/${podId}`, runpodKey(env));
  if (res.status >= 300 && res.status !== 404) throw new RunpodError(`RunPod DELETE pod failed (HTTP ${res.status}): ${res.text}`);
  for (let i = 0; i < 10; i++) {
    if (!(await getPod(podId, env)).exists) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

/** Waits until vLLM answers GET /v1/models with the model. */
export async function waitReady(
  state: PodState,
  opts: { timeoutMs?: number; onTick?: (msg: string) => void } = {},
): Promise<boolean> {
  const until = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
  let last = "";
  while (Date.now() < until) {
    try {
      const res = await fetch(`${state.endpoint}/models`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const body = (await res.json()) as { data?: Array<{ id?: string }> };
        if ((body.data ?? []).some((m) => m.id === state.model)) return true;
        last = "server up, model not listed yet";
      } else {
        last = `HTTP ${res.status} (image pulling / model loading)`;
      }
    } catch {
      last = "not reachable yet (pod starting)";
    }
    opts.onTick?.(last);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return false;
}

/**
 * Saves the pod as the Desk's last good Antares endpoint, so `locate --live`
 * and Live brain use it without flags. Creating a remote GPU pod is the
 * remote-inference acknowledgement: code goes to that pod for inference.
 */
export function saveEndpoint(state: PodState, cwd = process.cwd()): void {
  const p = path.join(cwd, DESK_ENDPOINT_REL);
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    /* new config */
  }
  const lastGoodAntares = { endpoint: state.endpoint, model: state.model, remoteInference: true, updatedAt: new Date().toISOString() };
  const next = {
    ...cfg,
    ...(cfg.endpoint ? {} : { preset: "antares-1b", endpoint: state.endpoint, model: state.model, remoteInference: true }),
    lastGoodAntares,
  };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
}

/** Removes the pod from the saved endpoint once it is gone. */
export function forgetEndpoint(state: PodState, cwd = process.cwd()): void {
  const p = path.join(cwd, DESK_ENDPOINT_REL);
  try {
    const cfg = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown> & { lastGoodAntares?: { endpoint?: string } };
    if (cfg.lastGoodAntares?.endpoint === state.endpoint) delete cfg.lastGoodAntares;
    if (cfg.endpoint === state.endpoint) {
      delete cfg.endpoint;
      delete cfg.model;
      delete cfg.remoteInference;
      delete cfg.preset;
    }
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
  } catch {
    /* nothing saved */
  }
}

/** Detached watchdog process: deletes the pod at the deadline even if this terminal closes. */
export function startWatchdog(state: PodState, zerodayBin: string, cwd = process.cwd()): number | undefined {
  const child = spawn(process.execPath, [zerodayBin, "antares", "watchdog", "--pod", state.podId, "--at", state.deadline], {
    cwd,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return child.pid;
}

/**
 * Stop the watchdog started by startWatchdog. It is spawned detached, so it
 * leads its own process group; the bin launcher runs tsx → node inside that
 * group, and killing only the launcher pid would leave them waiting for the
 * deadline. Kill the whole group, falling back to the pid (e.g. Windows).
 */
export function stopWatchdog(pid: number): void {
  try {
    process.kill(-pid, "SIGTERM");
    return;
  } catch {
    /* no such group, or unsupported */
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already exited */
  }
}

export function minutesAlive(state: PodState, now = Date.now()): number {
  const end = state.deletedAt ? Date.parse(state.deletedAt) : now;
  return Math.max(0, (end - Date.parse(state.createdAt)) / 60_000);
}

export function costSoFar(state: PodState, now = Date.now()): number | null {
  return state.costPerHr === null ? null : Math.round(((minutesAlive(state, now) / 60) * state.costPerHr) * 1000) / 1000;
}

/** Installs the official Antares CLI when missing (uv, else pipx). */
export function ensureAntaresCli(install: boolean): { ok: boolean; detail: string } {
  const has = (cmd: string) => spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }).stdout.trim();
  if (has("antares")) return { ok: true, detail: `antares CLI: ${has("antares")}` };
  if (!install) return { ok: false, detail: "antares CLI not found — install with: uv tool install cisco-antares-cli" };
  const tool = has("uv") ? ["uv", ["tool", "install", "cisco-antares-cli"]] : has("pipx") ? ["pipx", ["install", "cisco-antares-cli"]] : null;
  if (!tool) return { ok: false, detail: "antares CLI not found and neither uv nor pipx is installed — https://docs.astral.sh/uv/ then: uv tool install cisco-antares-cli" };
  const r = spawnSync(tool[0] as string, tool[1] as string[], { stdio: "inherit" });
  return r.status === 0 && has("antares")
    ? { ok: true, detail: `installed cisco-antares-cli (${has("antares")})` }
    : { ok: false, detail: `installing cisco-antares-cli failed (exit ${r.status}); if uv installed it, add $(uv tool dir --bin) to PATH` };
}

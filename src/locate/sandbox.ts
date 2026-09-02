/**
 * Isolated Docker sandbox for live/query exploration.
 *
 * - Image: ubuntu:24.04 (or ZERODAY_SANDBOX_IMAGE)
 * - network=none
 * - command timeout default 10s
 * - memory/cpu limits when Docker supports them
 * - read-only repo snapshot mounted at /snapshot
 * - allowlisted inspection commands only (grep/find/cat/…)
 * - destroy after each session / run
 *
 * Fixture locate and GitHub Action stay container-free.
 * Inference (vLLM) stays on the host — sandbox has no network.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  ALLOWED_BINARIES,
  SANDBOX_MOUNT,
  parseAllowlistedCommand,
} from "./sandbox-allowlist";

export const DEFAULT_SANDBOX_IMAGE =
  process.env.ZERODAY_SANDBOX_IMAGE || "ubuntu:24.04";

export const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;

export const DEFAULT_MEMORY_LIMIT = process.env.ZERODAY_SANDBOX_MEMORY || "512m";
export const DEFAULT_CPUS = process.env.ZERODAY_SANDBOX_CPUS || "1";

export interface DockerAvailability {
  available: boolean;
  detail: string;
  version?: string;
}

export interface SandboxExecResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  argv: string[];
  durationMs: number;
}

export interface SandboxSessionInfo {
  containerId: string;
  containerName: string;
  image: string;
  snapshotHostPath: string;
  mountPath: string;
  network: "none";
  memoryLimit: string;
  cpus: string;
  commandTimeoutMs: number;
}

function dockerInvocation(args: string[]): { command: string; args: string[] } {
  if (process.env.ZERODAY_DOCKER_SUDO === "1") {
    return { command: "sudo", args: ["docker", ...args] };
  }
  return { command: "docker", args };
}

function runDocker(
  args: string[],
  opts?: { timeoutMs?: number; input?: string },
): {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
} {
  const inv = dockerInvocation(args);
  const run = spawnSync(inv.command, inv.args, {
    encoding: "utf8",
    timeout: opts?.timeoutMs ?? 60_000,
    input: opts?.input,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    status: run.status,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    timedOut: Boolean(run.error && (run.error as NodeJS.ErrnoException).code === "ETIMEDOUT"),
    error: run.error || undefined,
  };
}

export function detectDocker(): DockerAvailability {
  const which = spawnSync("sh", ["-c", "command -v docker"], {
    encoding: "utf8",
  });
  if (!which.stdout?.trim()) {
    return {
      available: false,
      detail: "docker not on PATH (fixture/CI paths do not require Docker)",
    };
  }
  let info = runDocker(["info", "--format", "{{.ServerVersion}}"], {
    timeoutMs: 8_000,
  });
  // Permission on docker.sock — retry once with sudo when explicitly allowed or auto-detected
  if (
    info.status !== 0 &&
    /permission denied/i.test(info.stderr || "") &&
    process.env.ZERODAY_DOCKER_SUDO !== "0"
  ) {
    process.env.ZERODAY_DOCKER_SUDO = "1";
    info = runDocker(["info", "--format", "{{.ServerVersion}}"], {
      timeoutMs: 8_000,
    });
  }
  if (info.status !== 0 || info.timedOut || info.error) {
    return {
      available: false,
      detail: `docker present but daemon unreachable: ${(info.stderr || info.error?.message || "unknown").slice(0, 200)}`,
    };
  }
  return {
    available: true,
    detail: `docker engine ${info.stdout.trim() || "ok"}`,
    version: info.stdout.trim() || undefined,
  };
}

function ensureImage(image: string): void {
  const inspect = runDocker(["image", "inspect", image], { timeoutMs: 15_000 });
  if (inspect.status === 0) return;
  const pull = runDocker(["pull", image], { timeoutMs: 5 * 60_000 });
  if (pull.status !== 0) {
    throw new Error(
      `Failed to pull sandbox image ${image}: ${(pull.stderr || pull.stdout).slice(0, 500)}`,
    );
  }
}

/**
 * One sandbox session: long-running paused container with RO snapshot mount.
 * Call exec() for allowlisted commands; always destroy() in finally.
 */
export class SandboxSession {
  readonly info: SandboxSessionInfo;
  private destroyed = false;

  private constructor(info: SandboxSessionInfo) {
    this.info = info;
  }

  static create(
    snapshotHostPath: string,
    opts?: {
      image?: string;
      memoryLimit?: string;
      cpus?: string;
      commandTimeoutMs?: number;
      pullIfMissing?: boolean;
    },
  ): SandboxSession {
    const abs = path.resolve(snapshotHostPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new Error(`Sandbox snapshot path missing or not a directory: ${abs}`);
    }

    const docker = detectDocker();
    if (!docker.available) {
      throw new Error(`Sandbox requires Docker: ${docker.detail}`);
    }

    const image = opts?.image ?? DEFAULT_SANDBOX_IMAGE;
    if (opts?.pullIfMissing !== false) {
      ensureImage(image);
    }

    const name = `zeroday-sbx-${randomBytes(6).toString("hex")}`;
    const memoryLimit = opts?.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
    const cpus = opts?.cpus ?? DEFAULT_CPUS;
    const commandTimeoutMs = opts?.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

    // Create a stopped-capable long-lived container: sleep infinity, we docker exec into it.
    // network=none, read-only rootfs where supported, snapshot RO bind mount.
    const createArgs = [
      "create",
      "--name",
      name,
      "--network",
      "none",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--memory",
      memoryLimit,
      "--memory-swap",
      memoryLimit,
      "--cpus",
      cpus,
      "--pids-limit",
      "128",
      "--security-opt",
      "no-new-privileges",
      "--user",
      "65534:65534", // nobody
      "--workdir",
      SANDBOX_MOUNT,
      "-v",
      `${abs}:${SANDBOX_MOUNT}:ro`,
      image,
      "sleep",
      "infinity",
    ];

    const created = runDocker(createArgs, { timeoutMs: 60_000 });
    if (created.status !== 0) {
      throw new Error(
        `docker create failed: ${(created.stderr || created.stdout).slice(0, 800)}`,
      );
    }
    const containerId = created.stdout.trim();
    if (!containerId) {
      throw new Error("docker create returned empty container id");
    }

    const started = runDocker(["start", containerId], { timeoutMs: 30_000 });
    if (started.status !== 0) {
      runDocker(["rm", "-f", containerId], { timeoutMs: 30_000 });
      throw new Error(
        `docker start failed: ${(started.stderr || started.stdout).slice(0, 800)}`,
      );
    }

    return new SandboxSession({
      containerId,
      containerName: name,
      image,
      snapshotHostPath: abs,
      mountPath: SANDBOX_MOUNT,
      network: "none",
      memoryLimit,
      cpus,
      commandTimeoutMs,
    });
  }

  /**
   * Run one allowlisted command inside the sandbox.
   * Timeout defaults to 10s. Does not destroy the session.
   */
  exec(argv: string[], opts?: { timeoutMs?: number }): SandboxExecResult {
    if (this.destroyed) {
      throw new Error("SandboxSession already destroyed");
    }
    const parsed = parseAllowlistedCommand(argv);
    const timeoutMs = opts?.timeoutMs ?? this.info.commandTimeoutMs;
    const started = Date.now();

    // docker exec with explicit timeout via `timeout` if available in image;
    // also enforce spawnSync timeout on the host docker client.
    const execArgs = [
      "exec",
      "--workdir",
      SANDBOX_MOUNT,
      this.info.containerId,
      ...parsed.argv,
    ];
    const run = runDocker(execArgs, {
      timeoutMs: timeoutMs + 2_000, // small client grace
    });
    const durationMs = Date.now() - started;
    const timedOut =
      run.timedOut || durationMs >= timeoutMs + 1_500;

    return {
      ok: run.status === 0 && !timedOut,
      status: timedOut ? 124 : run.status,
      stdout: (run.stdout || "").slice(0, 200_000),
      stderr: timedOut
        ? `sandbox command timed out after ${timeoutMs}ms`
        : (run.stderr || "").slice(0, 50_000),
      timedOut,
      argv: parsed.argv,
      durationMs,
    };
  }

  /** Destroy container (force remove). Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    runDocker(["rm", "-f", this.info.containerId], { timeoutMs: 30_000 });
  }
}

/**
 * Run a single allowlisted command in a one-shot container (create → exec → destroy).
 * Preferred for isolated one-offs.
 */
export function runSandboxedCommand(
  snapshotHostPath: string,
  argv: string[],
  opts?: {
    image?: string;
    timeoutMs?: number;
    memoryLimit?: string;
    cpus?: string;
    pullIfMissing?: boolean;
  },
): SandboxExecResult & { session?: SandboxSessionInfo } {
  const session = SandboxSession.create(snapshotHostPath, {
    image: opts?.image,
    memoryLimit: opts?.memoryLimit,
    cpus: opts?.cpus,
    commandTimeoutMs: opts?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    pullIfMissing: opts?.pullIfMissing,
  });
  try {
    const result = session.exec(argv, { timeoutMs: opts?.timeoutMs });
    return { ...result, session: session.info };
  } finally {
    session.destroy();
  }
}

/**
 * Live-path helper: open sandbox, run a tiny allowlisted preflight, return session
 * for further execs. Caller must destroy().
 * Returns null when Docker is unavailable (live may continue without container isolation).
 */
export function tryOpenLiveSandbox(
  snapshotHostPath: string,
): {
  session: SandboxSession | null;
  preflight: SandboxExecResult | null;
  detail: string;
} {
  const docker = detectDocker();
  if (!docker.available) {
    return {
      session: null,
      preflight: null,
      detail: `Sandbox skipped: ${docker.detail}`,
    };
  }
  try {
    const session = SandboxSession.create(snapshotHostPath, {
      pullIfMissing: true,
    });
    const preflight = session.exec(["ls", SANDBOX_MOUNT]);
    return {
      session,
      preflight,
      detail: `Sandbox active (${session.info.image}, network=none, mem=${session.info.memoryLimit}, cpus=${session.info.cpus}, timeout=${session.info.commandTimeoutMs}ms)`,
    };
  } catch (e) {
    return {
      session: null,
      preflight: null,
      detail: `Sandbox failed to start: ${(e as Error).message}`,
    };
  }
}

export { ALLOWED_BINARIES, SANDBOX_MOUNT, parseAllowlistedCommand };

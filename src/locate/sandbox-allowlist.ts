/**
 * Allowlisted inspection commands for the ZERODAY exploration sandbox.
 * Matches Antares tool surface: grep / find / cat (+ safe cousins).
 * No shells with untrusted scripts, no network tools, no package managers.
 */

export const SANDBOX_MOUNT = "/snapshot";

/** Binaries permitted inside the sandbox (basename match). */
export const ALLOWED_BINARIES = new Set([
  "grep",
  "egrep",
  "fgrep",
  "rg", // if present in image; ubuntu base may lack it — still allowlisted
  "find",
  "cat",
  "head",
  "tail",
  "wc",
  "ls",
  "tree",
  "stat",
  "file",
  "realpath",
  "basename",
  "dirname",
  "pwd",
  "echo",
  "test",
  "[",
  "true",
  "false",
]);

/** Forbidden tokens even if binary is allowlisted (defense in depth). */
const FORBIDDEN_SUBSTRINGS = [
  "curl",
  "wget",
  "nc",
  "ncat",
  "ssh",
  "docker",
  "podman",
  "python",
  "node",
  "perl",
  "ruby",
  "bash",
  "sh",
  "zsh",
  "exec",
  "/dev/",
  "proc/",
  "sys/",
  "`",
  "$(",
  "${",
  ">",
  "|",
  ";",
  "&&",
  "||",
  "\n",
];

export interface ParsedSandboxCommand {
  argv: string[];
  binary: string;
}

/**
 * Parse and validate an allowlisted argv.
 * Rejects shell metacharacters and non-allowlisted binaries.
 */
export function parseAllowlistedCommand(
  argv: string[],
): ParsedSandboxCommand {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error("Sandbox command argv must be a non-empty array");
  }
  if (argv.some((a) => typeof a !== "string" || a.length === 0)) {
    throw new Error("Sandbox argv entries must be non-empty strings");
  }
  if (argv.length > 64) {
    throw new Error("Sandbox argv too long (max 64 tokens)");
  }
  const joined = argv.join(" ");
  for (const bad of FORBIDDEN_SUBSTRINGS) {
    // Allow binary names that are themselves in the forbid list only as false positives
    // when they appear as path fragments — check token-wise for tools.
    if (bad === "sh" || bad === "bash" || bad === "zsh") {
      if (argv.some((t) => t === bad || t.endsWith(`/${bad}`))) {
        throw new Error(`Sandbox forbids shell binary '${bad}'`);
      }
      continue;
    }
    if (bad.length <= 2) {
      // metacharacters
      if (joined.includes(bad)) {
        throw new Error(`Sandbox forbids shell metacharacter '${bad}'`);
      }
      continue;
    }
    if (argv.some((t) => t === bad || t.endsWith(`/${bad}`))) {
      throw new Error(`Sandbox forbids token '${bad}'`);
    }
  }

  const binaryPath = argv[0];
  const binary = binaryPath.split("/").pop()!;
  if (!ALLOWED_BINARIES.has(binary)) {
    throw new Error(
      `Sandbox binary '${binary}' is not allowlisted. ` +
        `Allowed: ${[...ALLOWED_BINARIES].sort().join(", ")}`,
    );
  }

  // Paths must stay under /snapshot when absolute
  for (const arg of argv.slice(1)) {
    if (arg.startsWith("/") && !arg.startsWith(`${SANDBOX_MOUNT}/`) && arg !== SANDBOX_MOUNT) {
      throw new Error(
        `Sandbox path '${arg}' must be under ${SANDBOX_MOUNT} (read-only snapshot mount)`,
      );
    }
    if (arg.includes("..")) {
      throw new Error("Sandbox rejects '..' path segments");
    }
  }

  return { argv, binary };
}

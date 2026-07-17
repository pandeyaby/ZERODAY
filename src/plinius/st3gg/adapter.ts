/**
 * ST3GG production adapter — real stego via sandboxed CLI.
 */

import path from "path";
import {
  resolveSandboxedPath,
  st3ggExamplesDir,
  st3ggWorkspaceDir,
} from "@/plinius/paths";
import { checkSt3ggRuntime, runSteggCli } from "@/plinius/st3gg/runner";

export async function st3ggStatus() {
  const runtime = await checkSt3ggRuntime();
  return {
    library: "st3gg" as const,
    ...runtime,
    workspace: st3ggWorkspaceDir(),
    examples: st3ggExamplesDir(),
    ready: runtime.present && runtime.cliExists && runtime.pillow,
  };
}

export async function st3ggAnalyze(imagePath: string, full = false) {
  const resolved = resolveSandboxedPath(imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  const args = ["analyze", resolved.path];
  if (full) args.push("--full");
  return runSteggCli(args);
}

export async function st3ggDetect(imagePath: string) {
  const resolved = resolveSandboxedPath(imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  return runSteggCli(["detect", resolved.path]);
}

export async function st3ggCapacity(imagePath: string, channels = "RGB", bits = 1) {
  const resolved = resolveSandboxedPath(imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  return runSteggCli([
    "capacity",
    resolved.path,
    "--channels",
    channels,
    "--bits",
    String(bits),
  ]);
}

export async function st3ggEncode(input: {
  imagePath: string;
  text: string;
  outputName?: string;
  channels?: string;
  bits?: number;
  password?: string;
}) {
  const resolved = resolveSandboxedPath(input.imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  const outName = (input.outputName || `encoded-${Date.now()}.png`).replace(/[/\\]/g, "_");
  const outPath = path.join(st3ggWorkspaceDir(), outName);
  const args = [
    "encode",
    "-i",
    resolved.path,
    "-t",
    input.text,
    "-o",
    outPath,
    "--channels",
    input.channels || "RGB",
    "--bits",
    String(input.bits ?? 1),
  ];
  if (input.password) {
    args.push("--password", input.password);
  }
  const result = await runSteggCli(args);
  return { ...result, outputPath: outPath };
}

export async function st3ggDecode(input: {
  imagePath: string;
  password?: string;
  noAuto?: boolean;
}) {
  const resolved = resolveSandboxedPath(input.imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  const args = ["decode", "-i", resolved.path];
  if (input.noAuto) args.push("--no-auto");
  if (input.password) args.push("--password", input.password);
  return runSteggCli(args);
}

export async function st3ggReadChunks(imagePath: string) {
  const resolved = resolveSandboxedPath(imagePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  return runSteggCli(["read-chunks", resolved.path]);
}

export async function st3ggListTools() {
  return runSteggCli(["list-tools"]);
}

export async function st3ggCryptoStatus() {
  return runSteggCli(["crypto-status"]);
}

/** Demo path — banner in examples (safe analyze target). */
export function st3ggDemoImage(): string {
  return path.join(st3ggExamplesDir(), "st3gg_banner.png");
}

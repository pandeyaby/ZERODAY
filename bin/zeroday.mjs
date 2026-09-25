#!/usr/bin/env node
// npm / npx entry point: run the TypeScript CLI through tsx, exactly as
// `npm run zeroday` does in a clone (no build step, same module semantics).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const entry = fileURLToPath(new URL("../cli/index.ts", import.meta.url));

const r = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (r.error) {
  console.error(`zeroday: failed to start CLI: ${r.error.message}`);
  process.exit(1);
}
if (r.signal) process.kill(process.pid, r.signal);
process.exit(r.status ?? 1);

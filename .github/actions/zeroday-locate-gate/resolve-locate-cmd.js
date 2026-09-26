/**
 * Resolve the keyless locate CLI invocation for the composite Action.
 * Default: fixture (CI / no-GPU). Live / endpoint never allowed here.
 *
 * @param {{ mode?: string, cwe?: string, advisory?: string, repo?: string, output?: string, recording?: string, baseline?: string, changedSince?: string, offline?: string }} inputs
 * @returns {{ argv: string[], cliArgs: string[], expectedMode: string, label: string }}
 */
function resolveLocateCmd(inputs = {}) {
  const resolved = resolveBase(inputs);
  const extra = [];
  const baseline = String(inputs.baseline || "").trim();
  const changedSince = String(inputs.changedSince || "").trim();
  if (baseline) extra.push("--baseline", baseline);
  if (changedSince) extra.push("--changed-since", changedSince);
  const argv = [...resolved.argv, ...extra];
  // cliArgs: the same invocation for `node <zeroday>/bin/zeroday.mjs …` (no npm script).
  return { ...resolved, argv, cliArgs: argv.slice(argv.indexOf("--") + 1) };
}

/** Advisory flag for the locate CLI: --cve / --ghsa / --cwe. */
function advisoryArgs(cwe, advisory) {
  const a = String(advisory || "").trim();
  if (/^CVE-\d{4}-\d+$/i.test(a)) return ["--cve", a];
  if (/^GHSA-/i.test(a)) return ["--ghsa", a];
  if (a) throw new Error("zeroday-locate-gate: advisory must be a CVE-… or GHSA-… id (got " + a + ")");
  return ["--cwe", cwe];
}

function resolveBase(inputs) {
  const mode = String(inputs.mode || "fixture").trim().toLowerCase();
  const cwe = String(inputs.cwe || "CWE-89").trim();
  const repo = String(inputs.repo || "fixtures/locate/demo-app").trim();
  const output = String(inputs.output || "zeroday-reports/ci").trim();
  const recording = String(inputs.recording || "").trim();
  const advisory = String(inputs.advisory || "").trim();
  // CWE scans stay offline; CVE / GHSA scans read public OSV advisory metadata unless offline=true.
  const offline = String(inputs.offline || "auto").trim().toLowerCase();
  const offlineArgs = offline === "true" || (offline === "auto" && !advisory) ? ["--offline"] : [];

  if (mode === "live" || mode === "endpoint") {
    throw new Error(
      "zeroday-locate-gate refused mode=" +
        mode +
        ": live Antares / --endpoint is never the Action default. " +
        "Run live on a workstation after human spend approval (docs/org-ops-runbook.md).",
    );
  }

  if (mode === "fixture") {
    return {
      argv: [
        "run",
        "zeroday",
        "--",
        "locate",
        "--cwe",
        cwe,
        "--repo",
        repo,
        "--fixture",
        "--output",
        output,
      ],
      expectedMode: "fixture",
      label: "CI/no-GPU fixture locate",
    };
  }

  if (mode === "rules") {
    return {
      argv: [
        "run",
        "zeroday",
        "--",
        "locate",
        ...advisoryArgs(cwe, advisory),
        "--repo",
        repo,
        "--rules",
        ...offlineArgs,
        "--output",
        output,
      ],
      expectedMode: "rules",
      label: "keyless rules locate (authorized repo snapshot)",
    };
  }

  if (mode === "recording") {
    if (!recording) {
      throw new Error(
        "zeroday-locate-gate mode=recording requires input `recording` (org cassette path)",
      );
    }
    return {
      argv: [
        "run",
        "zeroday",
        "--",
        "locate",
        "--recording",
        recording,
        "--output",
        output,
      ],
      expectedMode: "recording",
      label: "org cassette replay (Keyless K3)",
    };
  }

  throw new Error(
    "zeroday-locate-gate unknown mode=" +
      mode +
      " (allowed: fixture | rules | recording). Live is opt-in workstation-only.",
  );
}

module.exports = { resolveLocateCmd };

if (require.main === module) {
  const mode = process.env.ZERODAY_GATE_MODE || process.argv[2] || "fixture";
  const resolved = resolveLocateCmd({
    mode,
    cwe: process.env.CWE || process.argv[3],
    repo: process.env.REPO || process.argv[4],
    output: process.env.OUT || process.argv[5],
    recording: process.env.RECORDING || process.argv[6],
    advisory: process.env.ADVISORY,
    baseline: process.env.BASELINE,
    changedSince: process.env.CHANGED_SINCE,
    offline: process.env.OFFLINE,
  });
  process.stdout.write(JSON.stringify(resolved) + "\n");
}

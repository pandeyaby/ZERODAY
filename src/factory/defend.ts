/**
 * Defend-only harness — ephemeral checks that boot existing tests / fail-closed
 * posture. NEVER vulnerability reproduction or exploit confirmation.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DefendArtifact, DefendCheckResult } from "./types";

const EXPLOIT_REPRO_REFUSAL =
  "ZERODAY defend harness refuses vulnerability reproduction and exploit confirmation. " +
  "It only runs existing project tests / fail-closed posture checks.";

export function refuseExploitReproduction(request?: string): string {
  if (request && /exploit|poc|payload|repro(duce)?\s+vuln/i.test(request)) {
    return EXPLOIT_REPRO_REFUSAL;
  }
  return EXPLOIT_REPRO_REFUSAL;
}

function hasPath(repo: string, rel: string): boolean {
  return fs.existsSync(path.join(repo, rel));
}

function readPackageScripts(repo: string): Record<string, string> | null {
  const pkgPath = path.join(repo, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  } catch {
    return null;
  }
}

/**
 * Inventory of defend-only checks. Does not craft attack payloads.
 */
export function collectDefendChecks(repoRoot: string): DefendCheckResult[] {
  const repo = path.resolve(repoRoot);
  const checks: DefendCheckResult[] = [];

  const scripts = readPackageScripts(repo);
  if (scripts) {
    const hasTest = Boolean(scripts.test || scripts["test:ci"] || scripts.check);
    checks.push({
      kind: "package_test_script",
      ok: hasTest,
      summary: hasTest
        ? "package.json defines a test/check script"
        : "No test/check script in package.json",
      detail: hasTest
        ? `Available: ${["test", "test:ci", "check"].filter((k) => scripts[k]).join(", ")}`
        : undefined,
    });
  } else {
    checks.push({
      kind: "package_test_script",
      ok: false,
      summary: "No package.json (or unreadable) — skip npm test discovery",
    });
  }

  let pytestPresent = hasPath(repo, "pytest.ini");
  if (!pytestPresent && hasPath(repo, "pyproject.toml")) {
    try {
      pytestPresent = fs
        .readFileSync(path.join(repo, "pyproject.toml"), "utf8")
        .includes("pytest");
    } catch {
      pytestPresent = false;
    }
  }
  checks.push({
    kind: "pytest_present",
    ok: pytestPresent,
    summary: pytestPresent
      ? "pytest configuration detected"
      : "No pytest config detected (ok if not a Python repo)",
  });

  const ciOk =
    hasPath(repo, ".github/workflows") ||
    hasPath(repo, ".gitlab-ci.yml") ||
    hasPath(repo, "Jenkinsfile");
  checks.push({
    kind: "ci_workflow_present",
    ok: ciOk,
    summary: ciOk
      ? "CI workflow config present"
      : "No CI workflow detected (informational)",
  });

  checks.push({
    kind: "fail_closed_posture",
    ok: true,
    summary:
      "Defend-only posture: no vulnerability reproduction, no exploit confirmation, no PoC",
    detail: refuseExploitReproduction(),
  });

  return checks;
}

/**
 * Optionally run the project's existing test script (defend-only).
 * Never invents exploit harnesses.
 */
export function runExistingTests(
  repoRoot: string,
  opts?: { timeoutMs?: number },
): DefendCheckResult {
  const repo = path.resolve(repoRoot);
  const scripts = readPackageScripts(repo);
  const scriptName = scripts?.test
    ? "test"
    : scripts?.["test:ci"]
      ? "test:ci"
      : scripts?.check
        ? "check"
        : null;

  if (!scriptName) {
    return {
      kind: "existing_test_run",
      ok: false,
      summary: "No runnable package test script — fail-closed (did not invent a harness)",
    };
  }

  try {
    execFileSync("npm", ["run", scriptName], {
      cwd: repo,
      encoding: "utf8",
      timeout: opts?.timeoutMs ?? 120_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });
    return {
      kind: "existing_test_run",
      ok: true,
      summary: `Existing \`npm run ${scriptName}\` passed (defend-only)`,
    };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return {
      kind: "existing_test_run",
      ok: false,
      summary: `Existing \`npm run ${scriptName}\` failed or timed out (fail-closed)`,
      detail: err.message?.slice(0, 400),
    };
  }
}

export function buildDefendArtifact(
  repoRoot: string,
  opts?: { runTests?: boolean; timeoutMs?: number },
): DefendArtifact {
  const checks = collectDefendChecks(repoRoot);
  if (opts?.runTests) {
    checks.push(runExistingTests(repoRoot, { timeoutMs: opts.timeoutMs }));
  }
  const ok = checks.every((c) =>
    c.kind === "fail_closed_posture"
      ? c.ok
      : c.kind === "existing_test_run"
        ? c.ok
        : true, // informational discovery checks do not fail the pack alone
  );
  // Fail closed when runTests requested and tests fail
  const defendOk = opts?.runTests
    ? checks.filter((c) => c.kind === "existing_test_run").every((c) => c.ok)
    : checks.some((c) => c.kind === "fail_closed_posture" && c.ok);

  return {
    schemaVersion: "zeroday-factory-defend/v1",
    generatedAt: new Date().toISOString(),
    checks,
    ok: defendOk && ok,
    posture: {
      defendOnly: true,
      notVulnerabilityReproduction: true,
      notExploitConfirmation: true,
      failClosed: true,
    },
  };
}

export function writeDefendArtifact(
  repoRoot: string,
  outputPath: string,
  opts?: { runTests?: boolean; timeoutMs?: number },
): DefendArtifact {
  const artifact = buildDefendArtifact(repoRoot, opts);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}

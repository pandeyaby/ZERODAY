/**
 * ZERODAY operate — keyless Agent Operator Protocol.
 *
 * Default path: coding agent (Cursor / Claude Code / …) explores a read-only
 * snapshot and submits structured JSON. No Antares HF token. No cloud inference.
 * Optional live Antares remains on `zeroday locate --live`.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveAdvisory } from "../locate/resolve";
import { createSnapshot, destroySnapshot } from "../locate/snapshot";
import { defaultFixtureRepo } from "../locate/fixture";
import { toSarif } from "../locate/sarif";
import { toHumanReport } from "../locate/report";
import { toPullRequestComment } from "../locate/comment";
import { writeAllExports } from "../locate/export/index";
import {
  assertNoExploitInvariant,
  collectResultTexts,
} from "../locate/invariant";
import type { LocalizationResult, RankedFile, TraceStep } from "../locate/types";
import { EvidenceVault } from "../evidence/vault";
import { OPERATOR_SUBMISSION_SCHEMA } from "./schema";
import {
  ALLOWED_OPERATOR_TOOLS,
  FORBIDDEN_OPERATOR_ACTIONS,
  buildOperatorInstructions,
} from "./spec";
import { validateOperatorSubmission } from "./validate";
import { loadFixtureSubmission } from "./fixture";
import type {
  OperateArtifacts,
  OperateOptions,
  OperatorBrief,
  OperatorSubmission,
} from "./types";

export type {
  OperateArtifacts,
  OperateOptions,
  OperatorBrief,
  OperatorSubmission,
};
export { OPERATOR_SUBMISSION_SCHEMA } from "./schema";
export { validateOperatorSubmission } from "./validate";
export { loadFixtureSubmission } from "./fixture";
export {
  ALLOWED_OPERATOR_TOOLS,
  FORBIDDEN_OPERATOR_ACTIONS,
  buildOperatorInstructions,
} from "./spec";

function runIdFor(advisoryId: string): string {
  const safe = advisoryId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `operate-${safe}-${Date.now()}`;
}

function submissionToResult(
  submission: OperatorSubmission,
  opts: {
    targetRepo: string;
    snapshotPath?: string;
    advisoryTitle?: string;
  },
): LocalizationResult {
  const rankedFiles: RankedFile[] = submission.rankedFiles.map((f) => ({
    filePath: f.filePath,
    rank: f.rank,
    cweIds: f.cweIds,
    title: f.title,
    evidence: f.evidence.map((e) => ({
      filePath: e.filePath,
      startLine: e.startLine,
      endLine: e.endLine,
      excerpt: e.excerpt,
      note: `${e.note} [confidence=${f.confidence}]`,
    })),
  }));

  const explorationTrace: TraceStep[] =
    submission.explorationTrace ||
    (submission.toolLog || []).map((t, i) => ({
      step: i + 1,
      tool:
        t.tool === "list"
          ? "ls"
          : t.tool === "read"
            ? "cat"
            : t.tool === "grep"
              ? "grep"
              : "other",
      command: t.command,
      summary: t.summary || t.tool,
    }));

  return {
    mode: "agent",
    advisory: {
      kind: submission.advisory.kind,
      id: submission.advisory.id,
      cweId: submission.advisory.cweId,
      title: opts.advisoryTitle,
    },
    targetRepo: path.resolve(opts.targetRepo),
    snapshotPath: opts.snapshotPath,
    model: "agent-operator/keyless",
    generatedAt: new Date().toISOString(),
    rankedFiles,
    explorationTrace,
    warnings: [
      "Agent operator mode: keyless — coding agent submission, not Antares live inference.",
      "needs_human: true — localization ≠ exploitability; human review required.",
      ...(submission.notes ? [`Operator notes: ${submission.notes}`] : []),
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: rankedFiles.length,
      incompleteReason: null,
      terminalCallBudget: 15,
      terminalCallsUsed: explorationTrace.length,
    },
  };
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(Buffer.from(c)));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
    process.stdin.on("error", reject);
  });
}

export async function operate(options: OperateOptions): Promise<OperateArtifacts> {
  const resolved = await resolveAdvisory(options.advisory, {
    offline: options.fixture === true || options.offline === true,
    explicitCwe: options.explicitCwe,
  });

  const advisory = {
    kind: resolved.kind,
    id: resolved.id,
    cweId: resolved.cweId,
    title: resolved.title,
  };

  let repo = options.repo;
  if (!repo || repo === "." || repo === "fixture") {
    repo = defaultFixtureRepo();
  }
  repo = path.resolve(repo);
  if (!fs.existsSync(repo)) {
    throw new Error(`Repo not found: ${repo}`);
  }

  const runId = runIdFor(advisory.id);
  const outputDir = path.resolve(
    options.outputDir ?? path.join(process.cwd(), "zeroday-reports", runId),
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const vault = new EvidenceVault(outputDir, runId);
  let snapshotPath: string | undefined;

  try {
    const snap = createSnapshot(repo);
    snapshotPath = snap.snapshotPath;

    vault.putBlob(
      "input",
      "inputs/advisory.json",
      JSON.stringify(
        {
          advisory,
          repo,
          snapshotPath: snap.snapshotPath,
          fileCount: snap.fileCount,
          resolvedVia: resolved.source,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
      {
        title: "Advisory + snapshot inputs",
        summary: `${advisory.id} → ${advisory.cweId} over ${snap.fileCount} files`,
        tags: ["input"],
      },
    );

    const schemaPath = path.join(outputDir, "operator-submission.schema.json");
    fs.writeFileSync(
      schemaPath,
      JSON.stringify(OPERATOR_SUBMISSION_SCHEMA, null, 2),
    );
    vault.registerArtifact(schemaPath, "operator-submission.schema.json");

    const submissionHint = path.join(outputDir, "submission.json");
    const instructions = buildOperatorInstructions({
      advisory,
      targetRepo: repo,
      snapshotPath: snap.snapshotPath,
      schemaPath,
      submissionHint,
    });
    const instructionsPath = path.join(outputDir, "OPERATOR_SPEC.md");
    fs.writeFileSync(instructionsPath, instructions);
    vault.registerArtifact(instructionsPath, "OPERATOR_SPEC.md");

    const brief: OperatorBrief = {
      schemaVersion: "zeroday-operator-brief/v1",
      runId,
      generatedAt: new Date().toISOString(),
      advisory,
      targetRepo: repo,
      snapshotPath: snap.snapshotPath,
      allowedTools: [...ALLOWED_OPERATOR_TOOLS],
      forbiddenActions: [...FORBIDDEN_OPERATOR_ACTIONS],
      submissionSchemaPath: schemaPath,
      submissionPathHint: submissionHint,
      instructionsMarkdownPath: instructionsPath,
    };
    const briefPath = path.join(outputDir, "operator-brief.json");
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
    vault.registerArtifact(briefPath, "operator-brief.json");

    if (options.briefOnly) {
      const manifestPath = vault.flush();
      // Minimal empty result pack so verify can still run on brief-only dirs
      const emptySubmission: OperatorSubmission = {
        schemaVersion: "zeroday-operator-submission/v1",
        advisory: {
          kind: advisory.kind,
          id: advisory.id,
          cweId: advisory.cweId,
        },
        rankedFiles: [],
        needs_human: true,
        notes: "brief-only: awaiting agent submission",
      };
      fs.writeFileSync(submissionHint, JSON.stringify(emptySubmission, null, 2));
      return {
        result: submissionToResult(emptySubmission, {
          targetRepo: repo,
          snapshotPath,
          advisoryTitle: advisory.title,
        }),
        outputDir,
        runId,
        briefPath,
        schemaPath,
        instructionsPath,
        submissionPath: submissionHint,
        jsonPath: "",
        sarifPath: "",
        reportPath: "",
        commentPath: "",
        exportPaths: [],
        evidenceDir: vault.evidenceDir,
        manifestPath,
      };
    }

    // Load submission
    let raw: unknown;
    if (options.fixture) {
      raw = loadFixtureSubmission(advisory.cweId);
      // Align advisory ids with resolved advisory
      const fix = raw as OperatorSubmission;
      fix.advisory = {
        kind: advisory.kind,
        id: advisory.id,
        cweId: advisory.cweId,
      };
      raw = fix;
    } else if (options.from) {
      const abs = path.resolve(options.from);
      if (!fs.existsSync(abs)) {
        throw new Error(`Submission not found: ${abs}`);
      }
      raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    } else if (options.stdin || !process.stdin.isTTY) {
      const text = await readStdin();
      if (!text.trim()) {
        throw new Error(
          "No submission on stdin. Pass --fixture, --from submission.json, or pipe JSON.",
        );
      }
      raw = JSON.parse(text);
    } else {
      throw new Error(
        "Provide --fixture, --from submission.json, or pipe a submission on stdin. " +
          "Use --brief-only to emit the operator brief without a submission.",
      );
    }

    const validated = validateOperatorSubmission(raw);
    if (!validated.ok) {
      const detail = validated.issues
        .map((i) => `  - ${i.path}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid operator submission:\n${detail}`);
    }
    const submission = validated.submission;

    // Ensure advisory CWE matches resolve
    if (submission.advisory.cweId !== advisory.cweId) {
      throw new Error(
        `Submission cweId ${submission.advisory.cweId} does not match resolved ${advisory.cweId}`,
      );
    }

    const submissionPath = path.join(outputDir, "submission.json");
    fs.writeFileSync(submissionPath, JSON.stringify(submission, null, 2));
    vault.registerArtifact(submissionPath, "submission.json");
    const subEv = vault.putBlob(
      "submission",
      "submission.json",
      JSON.stringify(submission, null, 2),
      {
        title: "Agent operator submission",
        summary: `${submission.rankedFiles.length} ranked file(s); needs_human=true`,
        tags: ["submission", options.fixture ? "fixture" : "agent"],
      },
    );

    if (submission.toolLog?.length) {
      vault.putBlob(
        "tool_log",
        "tool-log.json",
        JSON.stringify(submission.toolLog, null, 2),
        {
          title: "Operator tool log",
          summary: `${submission.toolLog.length} tool step(s)`,
          tags: ["tool_log"],
        },
      );
    }

    const result = submissionToResult(submission, {
      targetRepo: repo,
      snapshotPath,
      advisoryTitle: advisory.title,
    });
    result.warnings.push(
      `Read-only snapshot: ${snap.fileCount} files (destroyed after run)`,
    );
    result.warnings.push(...snap.warnings);
    result.warnings.push(
      `Resolved ${resolved.id} → ${resolved.cweId} (${resolved.category}) via ${resolved.source}`,
    );

    // Claim entries citing submission evidence
    const claimIds: string[] = [];
    for (const f of submission.rankedFiles) {
      const claim = vault.putClaim(
        `Candidate: ${f.filePath}`,
        `${f.title} (rank ${f.rank}, confidence ${f.confidence})`,
        [subEv.id],
      );
      claimIds.push(claim.id);
    }
    result.warnings.push(
      claimIds.length
        ? `Evidence claim ids: ${claimIds.join(", ")}`
        : "No ranked-file claims (empty submission).",
    );

    assertNoExploitInvariant([
      ...collectResultTexts(result),
      toHumanReport(result, { evidenceClaimIds: claimIds }),
      toPullRequestComment(result),
    ]);

    const jsonPath = path.join(outputDir, "report.json");
    const sarifPath = path.join(outputDir, "report.sarif");
    const reportPath = path.join(outputDir, "report.md");
    const commentPath = path.join(outputDir, "comment.md");

    // Attach evidence ids onto result for consumers
    const resultWithEvidence = {
      ...result,
      evidence: {
        runId,
        claimIds,
        submissionEvidenceId: subEv.id,
        vaultRelative: "evidence/",
      },
    };

    fs.writeFileSync(jsonPath, JSON.stringify(resultWithEvidence, null, 2));
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2));
    fs.writeFileSync(
      reportPath,
      toHumanReport(result, { evidenceClaimIds: claimIds }),
    );
    fs.writeFileSync(commentPath, toPullRequestComment(result));

    const exports = writeAllExports(result, outputDir, {
      awsAccountId: options.awsAccountId,
      region: options.awsRegion,
    });

    for (const p of [
      jsonPath,
      sarifPath,
      reportPath,
      commentPath,
      ...exports.map((e) => e.path),
    ]) {
      vault.registerArtifact(p);
    }

    const manifestPath = vault.flush();

    return {
      result,
      outputDir,
      runId,
      briefPath,
      schemaPath,
      instructionsPath,
      submissionPath,
      jsonPath,
      sarifPath,
      reportPath,
      commentPath,
      exportPaths: exports.map((e) => e.path),
      evidenceDir: vault.evidenceDir,
      manifestPath,
    };
  } finally {
    if (snapshotPath) {
      destroySnapshot(snapshotPath);
    }
  }
}

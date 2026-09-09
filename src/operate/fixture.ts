/**
 * Fixture agent submission — offline/keyless CI path for `zeroday operate --fixture`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OperatorSubmission } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));

export function operateFixturesRoot(): string {
  return path.resolve(here, "../../fixtures/operate");
}

export function loadFixtureSubmission(cweId: string): OperatorSubmission {
  const file = path.join(
    operateFixturesRoot(),
    "submissions",
    `${cweId.toLowerCase()}.json`,
  );
  if (!fs.existsSync(file)) {
    // Empty defensive submission when no recording exists
    return {
      schemaVersion: "zeroday-operator-submission/v1",
      advisory: {
        kind: "cwe",
        id: cweId,
        cweId,
      },
      rankedFiles: [],
      needs_human: true,
      notes: `No fixture submission at fixtures/operate/submissions/${cweId.toLowerCase()}.json`,
      explorationTrace: [
        {
          step: 1,
          tool: "other",
          command: "fixture",
          summary: `Empty fixture for ${cweId}`,
        },
      ],
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as OperatorSubmission;
}

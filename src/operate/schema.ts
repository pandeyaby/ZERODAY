/**
 * JSON Schema for agent operator submissions (offline-vendored).
 */

export const OPERATOR_SUBMISSION_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zeroday.local/schemas/operator-submission-v1.json",
  title: "ZERODAY Operator Submission v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "advisory",
    "rankedFiles",
    "needs_human",
  ],
  properties: {
    schemaVersion: {
      const: "zeroday-operator-submission/v1",
    },
    advisory: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "id", "cweId"],
      properties: {
        kind: { enum: ["cwe", "cve", "ghsa"] },
        id: { type: "string", minLength: 3 },
        cweId: {
          type: "string",
          pattern: "^CWE-\\d+$",
        },
      },
    },
    rankedFiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "filePath",
          "rank",
          "cweIds",
          "title",
          "confidence",
          "evidence",
        ],
        properties: {
          filePath: { type: "string", minLength: 1 },
          rank: { type: "integer", minimum: 1 },
          cweIds: {
            type: "array",
            items: { type: "string", pattern: "^CWE-\\d+$" },
            minItems: 1,
          },
          title: { type: "string", minLength: 1 },
          confidence: { enum: ["low", "medium", "high"] },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["filePath", "excerpt", "note"],
              properties: {
                filePath: { type: "string", minLength: 1 },
                startLine: { type: "integer", minimum: 1 },
                endLine: { type: "integer", minimum: 1 },
                excerpt: { type: "string", minLength: 1 },
                note: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
    needs_human: { const: true },
    explorationTrace: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "tool", "command", "summary"],
        properties: {
          step: { type: "integer", minimum: 1 },
          tool: {
            enum: ["grep", "find", "cat", "ls", "other", "submit"],
          },
          command: { type: "string" },
          summary: { type: "string" },
        },
      },
    },
    toolLog: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tool", "command"],
        properties: {
          tool: { enum: ["list", "grep", "read", "other"] },
          command: { type: "string" },
          summary: { type: "string" },
          at: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

export type OperatorSubmissionSchema = typeof OPERATOR_SUBMISSION_SCHEMA;

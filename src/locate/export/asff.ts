/**
 * AWS Security Hub ASFF — local file projection only.
 * SchemaVersion ALWAYS 2018-10-08. Envelope: {"Findings":[...]}.
 *
 * Required: AwsAccountId (customer placeholder), CreatedAt, UpdatedAt,
 * Description, GeneratorId, Id, ProductArn (custom placeholder ARN),
 * Resources[], Title.
 *
 * Severity via FindingProviderFields (not top-level partner Severity).
 * Types: Software and Configuration Checks/Vulnerabilities/<CWE-id>
 * — do NOT invent a CVE.
 * Resources.Type Other + Details.Other for file path.
 * Optional Vulnerabilities[].Id = CWE-…. Omit StartLine if unknown.
 * No BatchImportFindings / no live AWS calls.
 *
 * Docs: https://docs.aws.amazon.com/securityhub/1.0/APIReference/API_AwsSecurityFinding.html
 */

import type { LocalizationResult } from "../types";
import { toInternalFindings, type InternalFinding } from "../findings";

export const ASFF_SCHEMA_VERSION = "2018-10-08";

export interface AsffExportOptions {
  awsAccountId?: string;
  region?: string;
}

export interface AsffFinding {
  SchemaVersion: typeof ASFF_SCHEMA_VERSION;
  Id: string;
  ProductArn: string;
  GeneratorId: string;
  AwsAccountId: string;
  Types: string[];
  CreatedAt: string;
  UpdatedAt: string;
  Title: string;
  Description: string;
  Resources: Array<{
    Type: "Other";
    Id: string;
    Details: {
      Other: Record<string, string>;
    };
  }>;
  FindingProviderFields: {
    Severity: { Label: "INFORMATIONAL"; Original: string };
    Types: string[];
  };
  RecordState: "ACTIVE";
  Workflow: { Status: "NEW" };
  ProductFields: Record<string, string>;
  Vulnerabilities?: Array<{
    Id: string;
    Vendor?: { Name: string };
  }>;
}

function accountId(opts?: AsffExportOptions): string {
  const raw =
    opts?.awsAccountId ??
    process.env.ZERODAY_AWS_ACCOUNT_ID ??
    "000000000000";
  return raw.replace(/\D/g, "").padStart(12, "0").slice(-12);
}

function findingToAsff(
  f: InternalFinding,
  opts: AsffExportOptions,
): AsffFinding {
  const account = accountId(opts);
  const region = opts.region ?? process.env.AWS_REGION ?? "us-east-1";
  // Custom product ARN shape for customer BatchImportFindings — placeholders only
  const productArn = `arn:aws:securityhub:${region}:${account}:product/${account}/default`;
  const ts = f.generatedAt;
  const evidenceNote = f.evidence.map((e) => e.note).join("; ").slice(0, 800);
  const description =
    `ZERODAY Antares localization candidate: ${f.filePath} for ${f.cweId} ` +
    `(${f.category}), rank ${f.rank}. ${evidenceNote} ` +
    `Detector-lane candidate only — human triage required. ` +
    `Not proof of exploitability. Antares-1B File F1=${f.modelFileF1}.`.slice(
      0,
      1024,
    );

  const other: Record<string, string> = {
    FilePath: f.filePath,
    CweId: f.cweId,
    Category: f.category,
    Rank: String(f.rank),
    AdvisoryId: f.advisoryId,
  };
  // Omit StartLine/EndLine when unknown — never invent
  if (f.startLine != null) other.StartLine = String(f.startLine);
  if (f.endLine != null) other.EndLine = String(f.endLine);

  const types = [
    `Software and Configuration Checks/Vulnerabilities/${f.cweId}`,
  ];

  return {
    SchemaVersion: ASFF_SCHEMA_VERSION,
    Id: f.id,
    ProductArn: productArn,
    GeneratorId: `zeroday/antares/${f.cweId}`,
    AwsAccountId: account,
    Types: types,
    CreatedAt: ts,
    UpdatedAt: ts,
    Title: `${f.cweId}: ${f.title}`.slice(0, 256),
    Description: description,
    Resources: [
      {
        Type: "Other",
        Id: `file://${f.filePath}`,
        Details: { Other: other },
      },
    ],
    FindingProviderFields: {
      Severity: { Label: "INFORMATIONAL", Original: "note" },
      Types: types,
    },
    RecordState: "ACTIVE",
    Workflow: { Status: "NEW" },
    ProductFields: {
      "zeroday/mode": f.mode,
      "zeroday/model": f.model,
      "zeroday/cwe": f.cweId,
      "zeroday/fileF1": String(f.modelFileF1),
      "zeroday/lane": "detector-candidate",
    },
    Vulnerabilities: [
      {
        Id: f.cweId,
        Vendor: { Name: "ZERODAY" },
      },
    ],
  };
}

export function toAsff(
  result: LocalizationResult,
  opts: AsffExportOptions = {},
): { Findings: AsffFinding[] } {
  return {
    Findings: toInternalFindings(result).map((f) => findingToAsff(f, opts)),
  };
}

export function isValidAsffShape(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as { Findings?: unknown };
  if (!Array.isArray(d.Findings)) return false;
  for (const f of d.Findings) {
    if (!f || typeof f !== "object") return false;
    const x = f as Record<string, unknown>;
    if (x.SchemaVersion !== ASFF_SCHEMA_VERSION) return false;
    for (const key of [
      "Id",
      "ProductArn",
      "GeneratorId",
      "AwsAccountId",
      "CreatedAt",
      "UpdatedAt",
      "Title",
      "Description",
      "Resources",
      "FindingProviderFields",
    ]) {
      if (x[key] == null) return false;
    }
    if (!Array.isArray(x.Resources) || x.Resources.length < 1) return false;
    const res0 = (x.Resources as Array<Record<string, unknown>>)[0];
    if (res0.Type !== "Other") return false;
    const fpf = x.FindingProviderFields as Record<string, unknown>;
    if (!fpf.Severity || typeof fpf.Severity !== "object") return false;
    // Must not invent CVE in Types
    const types = x.Types as string[];
    if (!Array.isArray(types) || !types.some((t) => /CWE-\d+/i.test(t))) {
      return false;
    }
  }
  return true;
}

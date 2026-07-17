/**
 * AWS Security adapters — Security Hub, GuardDuty, IAM, CloudTrail, Config, WAF (safe_local sim).
 */

import type { Mission, ToolDefinition } from "@/lib/types";
import { uid } from "@/lib/utils";

const runId = () => uid("run");

export const awsTools: ToolDefinition[] = [
  {
    id: "aws.security_hub_findings",
    name: "Security Hub Findings",
    description: "Aggregate Security Hub findings by severity and product (metadata).",
    vendor: "aws",
    category: "aws-detect",
    mode: "safe_local",
    roles: ["scanner", "analyst", "ghost", "coordinator"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
  {
    id: "aws.guardduty_detectors",
    name: "GuardDuty Detector Health",
    description: "Check GuardDuty enablement, data sources, and high-severity findings.",
    vendor: "aws",
    category: "aws-detect",
    mode: "safe_local",
    roles: ["recon", "ghost", "scanner"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
  {
    id: "aws.iam_access_analyzer",
    name: "IAM Access Analyzer",
    description: "Surface external access findings and overly permissive trust policies.",
    vendor: "aws",
    category: "aws-iam",
    mode: "safe_local",
    roles: ["scanner", "infiltrator", "analyst"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
  {
    id: "aws.cloudtrail_hygiene",
    name: "CloudTrail Hygiene",
    description: "Validate multi-region trails, log validation, and S3 encryption.",
    vendor: "aws",
    category: "aws-audit",
    mode: "safe_local",
    roles: ["scanner", "ghost", "analyst"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
  {
    id: "aws.config_compliance",
    name: "AWS Config Compliance",
    description: "Summarize noncompliant Config rules for scoped account/region.",
    vendor: "aws",
    category: "aws-scan",
    mode: "safe_local",
    roles: ["scanner", "analyst"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
  {
    id: "aws.waf_webacl_audit",
    name: "WAF WebACL Audit",
    description: "Check WAF ACLs for missing managed rules and COUNT-only critical rules.",
    vendor: "aws",
    category: "aws-scan",
    mode: "safe_local",
    roles: ["scanner", "exploiter", "analyst"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      webAclArn: { type: "string", description: "WebACL ARN", required: true },
    },
  },
  {
    id: "aws.s3_public_exposure",
    name: "S3 Public Exposure Check",
    description: "Identify buckets with public ACLs/policies in scope (names only).",
    vendor: "aws",
    category: "aws-scan",
    mode: "safe_local",
    roles: ["recon", "scanner", "exfiltrator"],
    parameters: {
      region: { type: "string", description: "AWS region", default: "us-east-1" },
      accountId: { type: "string", description: "Account id", required: true },
    },
  },
];

export async function runAwsTool(
  toolId: string,
  args: Record<string, unknown>,
  ctx: { simulate: boolean; mission: Mission }
): Promise<{ data: Record<string, unknown>; summary: string }> {
  const region = String(args.region || "us-east-1");
  const accountId = String(args.accountId || "000000000000");

  switch (toolId) {
    case "aws.security_hub_findings":
      return {
        summary: `Security Hub ${accountId}/${region}: 5 elevated findings (sim)`,
        data: {
          runId: runId(),
          accountId,
          region,
          counts: { CRITICAL: 1, HIGH: 2, MEDIUM: 8, LOW: 21 },
          top: [
            { id: "arn:aws:securityhub:.../finding/1", title: "S3.1 S3 Block Public Access disabled", severity: "HIGH" },
            { id: "arn:aws:securityhub:.../finding/2", title: "IAM.1 Root access key present", severity: "CRITICAL" },
            { id: "arn:aws:securityhub:.../finding/3", title: "EC2.19 Security group unrestricted SSH", severity: "HIGH" },
          ],
          simulate: ctx.simulate,
        },
      };
    case "aws.guardduty_detectors":
      return {
        summary: `GuardDuty ${accountId}/${region}`,
        data: {
          accountId,
          region,
          detector: {
            status: "ENABLED",
            s3Logs: true,
            kubernetesLogs: true,
            malwareProtection: false,
            findingPublishingFrequency: "FIFTEEN_MINUTES",
          },
          highFindings: [
            { type: "UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.InsideAWS", severity: 8.4 },
            { type: "Trojan:EC2/BlackholeTraffic", severity: 7.1 },
          ],
        },
      };
    case "aws.iam_access_analyzer":
      return {
        summary: `Access Analyzer ${accountId}: 3 external access findings`,
        data: {
          accountId,
          region,
          findings: [
            {
              resource: "arn:aws:s3:::lab-public-assets",
              severity: "high",
              detail: "Bucket policy allows Principal:* GetObject",
            },
            {
              resource: "arn:aws:iam::" + accountId + ":role/CrossAccountRead",
              severity: "medium",
              detail: "Trust policy missing external ID condition",
            },
            {
              resource: "arn:aws:kms:" + region + ":" + accountId + ":key/demo",
              severity: "medium",
              detail: "Key policy grants external account encrypt without condition",
            },
          ],
        },
      };
    case "aws.cloudtrail_hygiene":
      return {
        summary: `CloudTrail hygiene ${accountId}`,
        data: {
          accountId,
          region,
          trails: [
            {
              name: "org-management",
              isMultiRegion: true,
              logFileValidation: true,
              kmsEncrypted: true,
              status: "ok",
            },
            {
              name: "app-legacy",
              isMultiRegion: false,
              logFileValidation: false,
              kmsEncrypted: false,
              status: "weak",
              detail: "Single-region, no validation, SSE-S3 only",
            },
          ],
        },
      };
    case "aws.config_compliance":
      return {
        summary: `Config compliance ${accountId}/${region}: 4 noncompliant rules`,
        data: {
          accountId,
          region,
          noncompliant: [
            { rule: "encrypted-volumes", resourceType: "AWS::EC2::Volume", count: 3 },
            { rule: "cloudtrail-enabled", resourceType: "AWS::::Account", count: 1 },
            { rule: "iam-password-policy", resourceType: "AWS::::Account", count: 1 },
            { rule: "restricted-ssh", resourceType: "AWS::EC2::SecurityGroup", count: 6 },
          ],
        },
      };
    case "aws.waf_webacl_audit":
      return {
        summary: `WAF audit ${args.webAclArn}`,
        data: {
          webAclArn: args.webAclArn,
          region,
          issues: [
            {
              rule: "AWSManagedRulesCommonRuleSet",
              severity: "high",
              detail: "Managed rule group in COUNT mode for SQLi/XSS — not blocking",
            },
            {
              rule: "rate-limit-login",
              severity: "medium",
              detail: "Rate-based rule threshold 20000 too high for /login",
            },
          ],
        },
      };
    case "aws.s3_public_exposure":
      return {
        summary: `S3 public exposure ${accountId}: 2 buckets flagged`,
        data: {
          accountId,
          region,
          buckets: [
            { name: "lab-public-assets", public: true, blockPublicAccess: false, severity: "high" },
            { name: "staging-logs-export", public: true, blockPublicAccess: "partial", severity: "medium" },
          ],
          note: "Bucket names only — object contents not enumerated",
        },
      };
    default:
      throw new Error(`Unhandled aws tool ${toolId}`);
  }
}

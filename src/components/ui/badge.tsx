import { cn, severityColor } from "@/lib/cn";

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?:
    | "default"
    | "ok"
    | "warn"
    | "danger"
    | "cisco"
    | "splunk"
    | "paloalto"
    | "fortinet"
    | "crowdstrike"
    | "aws"
    | "muted";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-[var(--line-bright)] text-[var(--text)] bg-white/5",
    ok: "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
    warn: "border-[var(--warn)]/40 text-[var(--warn)] bg-[var(--warn)]/10",
    danger: "border-[var(--danger)]/40 text-[var(--danger)] bg-[var(--danger)]/10",
    cisco: "border-[var(--cisco)]/40 text-[var(--cisco)] bg-[var(--cisco)]/10",
    splunk: "border-[var(--splunk)]/40 text-[var(--splunk)] bg-[var(--splunk)]/10",
    paloalto: "border-[var(--paloalto)]/40 text-[var(--paloalto)] bg-[var(--paloalto)]/10",
    fortinet: "border-[var(--fortinet)]/40 text-[var(--fortinet)] bg-[var(--fortinet)]/10",
    crowdstrike: "border-[var(--crowdstrike)]/40 text-[var(--crowdstrike)] bg-[var(--crowdstrike)]/10",
    aws: "border-[var(--aws)]/40 text-[var(--aws)] bg-[var(--aws)]/10",
    muted: "border-[var(--line)] text-[var(--muted)] bg-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("font-mono text-xs uppercase tracking-wide", severityColor(severity))}>
      {severity}
    </span>
  );
}

/** Map loadout id → badge tone */
export function loadoutTone(
  id: string
): "cisco" | "splunk" | "paloalto" | "fortinet" | "crowdstrike" | "aws" | "muted" {
  switch (id) {
    case "cisco":
      return "cisco";
    case "splunk":
      return "splunk";
    case "paloalto":
      return "paloalto";
    case "fortinet":
      return "fortinet";
    case "crowdstrike":
      return "crowdstrike";
    case "aws":
      return "aws";
    default:
      return "muted";
  }
}

export function vendorImpactTone(
  label: string
): "cisco" | "splunk" | "paloalto" | "fortinet" | "crowdstrike" | "aws" | "muted" {
  if (/cisco/i.test(label)) return "cisco";
  if (/splunk/i.test(label)) return "splunk";
  if (/palo|pan-?os|prisma|globalprotect|xsoar/i.test(label)) return "paloalto";
  if (/forti/i.test(label)) return "fortinet";
  if (/crowd|falcon/i.test(label)) return "crowdstrike";
  if (/aws|amazon|s3|iam|cloudtrail|guardduty|security hub/i.test(label)) return "aws";
  return "muted";
}

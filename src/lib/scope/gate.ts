/**
 * Egress / scope containment — refuse off-scope hosts.
 */

import { SCOPE_DENIED } from "@/lib/doctrine/plinian";
import type { ScopeTarget } from "@/lib/types";

function normalizeHost(input: string): string {
  try {
    if (input.includes("://")) return new URL(input).hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  return input.toLowerCase().replace(/:\d+$/, "").trim();
}

function isPrivateOrLab(host: string): boolean {
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".lab") ||
    host.endsWith(".internal") ||
    host.endsWith(".corp")
  ) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return true;
  }
  // Link-local / cloud metadata — always deny unless explicitly scoped
  if (host === "169.254.169.254" || host === "metadata.google.internal") return false;
  return false;
}

function hostInCidr(host: string, cidr: string): boolean {
  // Lightweight check: only exact prefix match for demo safety (not full IP math).
  const [net] = cidr.split("/");
  if (!net) return false;
  const parts = net.split(".");
  const hostParts = host.split(".");
  if (parts.length !== 4 || hostParts.length !== 4) return host.includes(net);
  // /24 style: match first 3 octets when mask >= 24, else first 2 for /16
  const mask = Number(cidr.split("/")[1] ?? 24);
  const octets = mask >= 24 ? 3 : mask >= 16 ? 2 : 1;
  return parts.slice(0, octets).join(".") === hostParts.slice(0, octets).join(".");
}

export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a candidate host/URL is within mission targets.
 * Lab/private hosts are allowed only when the mission includes a lab/staging target
 * or an explicit matching hostname/CIDR.
 */
export function checkScope(candidate: string, targets: ScopeTarget[]): ScopeCheckResult {
  if (!targets.length) {
    return { allowed: false, reason: SCOPE_DENIED + " (empty scope)" };
  }

  const host = normalizeHost(candidate);
  if (!host) return { allowed: false, reason: SCOPE_DENIED + " (empty host)" };

  // Cloud metadata always denied unless explicitly listed
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    const explicit = targets.some((t) => normalizeHost(t.hostname || t.url || "") === host);
    if (!explicit) return { allowed: false, reason: SCOPE_DENIED + " (metadata endpoint)" };
  }

  for (const t of targets) {
    const th = normalizeHost(t.hostname || t.url || "");
    if (th && (host === th || host.endsWith(`.${th}`) || th.endsWith(`.${host}`))) {
      return { allowed: true };
    }
    if (t.cidr && hostInCidr(host, t.cidr)) return { allowed: true };
    if (t.url && candidate.toLowerCase().startsWith(t.url.toLowerCase())) return { allowed: true };
  }

  // Private hosts need at least one lab/staging/sandbox target in scope
  if (isPrivateOrLab(host)) {
    const hasLab = targets.some((t) =>
      ["lab", "staging", "sandbox"].includes(t.environment)
    );
    if (hasLab) {
      // Still require some overlap — allow if any target is private/lab-ish
      const labish = targets.some((t) => {
        const th = normalizeHost(t.hostname || t.url || "");
        return !th || isPrivateOrLab(th) || t.cidr?.startsWith("10.") || t.cidr?.startsWith("192.168.");
      });
      if (labish) return { allowed: true };
    }
  }

  return { allowed: false, reason: SCOPE_DENIED };
}

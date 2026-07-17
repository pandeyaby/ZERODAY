import { createHash, randomUUID } from "crypto";
import { cn, severityColor, sleep } from "@/lib/cn";

export { cn, severityColor, sleep };

export function uid(prefix?: string): string {
  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Stable SHA-256 of canonical JSON for evidence provenance. */
export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(sortKeys(payload));
  return createHash("sha256").update(canonical).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Redact common secret patterns from free text / objects. */
export function redactSecrets<T>(input: T): T {
  if (typeof input === "string") {
    return input
      .replace(
        /(api[_-]?key|token|password|secret|authorization)\s*[:=]\s*['"]?[^\s'"]+/gi,
        "$1=[REDACTED]"
      )
      .replace(
        /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{20,})\b/g,
        "[REDACTED_TOKEN]"
      )
      .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]") as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => redactSecrets(v)) as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/password|secret|api.?key|token|credential|private.?key/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out as T;
  }
  return input;
}

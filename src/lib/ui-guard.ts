/**
 * Request guard for the Desk web UI (applied by src/middleware.ts).
 *
 * The Desk runs scans and writes reports on the machine it runs on, so it only
 * answers:
 *  - on loopback hosts (localhost / 127.0.0.1 / ::1) — a foreign Host header is
 *    refused, which also defeats DNS rebinding;
 *  - on hosts listed in ZERODAY_UI_ALLOWED_HOSTS, and only when ZERODAY_UI_TOKEN
 *    is set;
 *  - with the token (cookie, `Authorization: Bearer`, or `?token=` once) on every
 *    request when ZERODAY_UI_TOKEN is set.
 * State-changing API calls must be same-origin JSON: cross-site form / text
 * posts (CSRF) are refused.
 */

export const UI_TOKEN_COOKIE = "zeroday_ui_token";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface GuardRequest {
  method: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  contentType: string | null;
  cookieToken: string | null;
  authorization: string | null;
  queryToken: string | null;
}

export interface GuardEnv {
  token?: string;
  allowedHosts?: string;
}

export type GuardResult =
  | { ok: true; setTokenCookie: boolean }
  | { ok: false; status: number; error: string };

/** Hostname without port; `[::1]:3333` → `::1`. */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(1, h.indexOf("]") > 0 ? h.indexOf("]") : undefined);
  const colon = h.lastIndexOf(":");
  return colon > 0 && h.indexOf(":") === colon ? h.slice(0, colon) : h;
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkUiRequest(req: GuardRequest, env: GuardEnv): GuardResult {
  const token = env.token?.trim() || "";
  const allowed = new Set(
    (env.allowedHosts ?? "")
      .split(",")
      .map((h) => hostnameOf(h))
      .filter(Boolean),
  );

  const hostname = req.host ? hostnameOf(req.host) : "";
  if (!LOOPBACK.has(hostname)) {
    if (!hostname || !allowed.has(hostname)) {
      return {
        ok: false,
        status: 403,
        error:
          `Desk answers on localhost only (Host "${req.host ?? ""}"). ` +
          "To serve it on another host set ZERODAY_UI_ALLOWED_HOSTS and ZERODAY_UI_TOKEN.",
      };
    }
    if (!token) {
      return {
        ok: false,
        status: 403,
        error: "ZERODAY_UI_ALLOWED_HOSTS requires ZERODAY_UI_TOKEN — the Desk is never served off-host without a token.",
      };
    }
  }

  let setTokenCookie = false;
  if (token) {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.authorization ?? "")?.[1]?.trim();
    if (req.queryToken && sameString(req.queryToken, token)) setTokenCookie = true;
    else if (!(req.cookieToken && sameString(req.cookieToken, token)) && !(bearer && sameString(bearer, token))) {
      return {
        ok: false,
        status: 401,
        error: "Desk token required — open the URL printed at startup (…?token=…) or send Authorization: Bearer.",
      };
    }
  }

  if (req.pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method.toUpperCase())) {
    const site = req.secFetchSite?.toLowerCase();
    if (site && site !== "same-origin" && site !== "none") {
      return { ok: false, status: 403, error: "Cross-site request refused" };
    }
    if (req.origin) {
      let originHost = "";
      try {
        originHost = new URL(req.origin).host.toLowerCase();
      } catch {
        /* "null" or malformed */
      }
      if (!req.host || originHost !== req.host.trim().toLowerCase()) {
        return { ok: false, status: 403, error: "Cross-origin request refused" };
      }
    }
    if (!/^application\/json\b/i.test(req.contentType ?? "")) {
      return { ok: false, status: 415, error: "Desk API accepts Content-Type: application/json only" };
    }
  }

  return { ok: true, setTokenCookie };
}

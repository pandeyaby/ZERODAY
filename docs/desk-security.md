# Desk web UI — security model and review

The Desk (`npm run dev` → <http://127.0.0.1:3333/play>) runs the same scans as the
CLI, reads repositories and writes reports **on the machine it runs on**. It is a
local tool, not a multi-user service. This page states what it protects against
and records the 1.0 review.

## Defaults

| Protection | How |
|------------|-----|
| Listens on loopback | `dev` / `start` bind `127.0.0.1`. |
| Answers only for loopback hosts | Middleware ([`src/middleware.ts`](../src/middleware.ts), [`src/lib/ui-guard.ts`](../src/lib/ui-guard.ts)) refuses any `Host` other than `localhost` / `127.0.0.1` / `::1` — this also defeats DNS rebinding. |
| No cross-site writes (CSRF) | `POST` to `/api/*` must be `Content-Type: application/json` (forces a CORS preflight the Desk never grants), and a cross-site `Origin` / `Sec-Fetch-Site` is refused. |
| Path sandbox | Every repo / output / report path must resolve (symlinks included) under the working directory or `ZERODAY_UI_ROOTS`. The sandbox root is server-side only: `cwd` and probe test seams are stripped from request bodies. |
| No framing | `X-Frame-Options: DENY`, `frame-ancestors 'none'`; `nosniff`; `Referrer-Policy: no-referrer`. |
| Secrets | Token *values* are never accepted from the browser (only an env-var name), never sent anywhere by the Desk, and responses / reports containing one are refused. |
| Spend | Live model calls need an explicit confirmation (`spendAcknowledged`). |

## Serving it to another machine

Only with a token:

```bash
ZERODAY_UI_TOKEN=$(openssl rand -hex 24) \
ZERODAY_UI_ALLOWED_HOSTS=desk.internal \
  npx next start -H 0.0.0.0 -p 3333
# open http://desk.internal:3333/play?token=<token>  (moved into an HttpOnly cookie)
# API clients: Authorization: Bearer <token>
```

With `ZERODAY_UI_TOKEN` set, every request (loopback included) needs it.
`ZERODAY_UI_ALLOWED_HOSTS` without a token is refused. Put TLS in front of it
(the cookie is `Secure` on https).

**Docker:** the image listens on `0.0.0.0` inside the container; with
`docker run -p 127.0.0.1:3000:3000 …` open <http://localhost:3000/play>. Any other
hostname needs the two variables above.

## Accepted risk

- **Outbound probes.** *Live brain* and *Verify it yourself → live URL* send
  `GET /v1/models` (and, after confirmation, completions) to a URL you type. The
  server makes that request, so anyone who can use the Desk can make the host
  reach that URL. That is why the Desk is loopback-only by default.
- **Anyone with the token has the Desk.** It can scan any folder under the
  allowed roots and write reports there.

## 1.0 review (September 2026)

Checked every route in `src/app/api/` against a running server.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `cwd` in the JSON body of `/api/desk`, `/api/live`, `/api/reports` became the path-sandbox root → scan any directory and write reports anywhere | High | Fixed — server-only fields dropped (`publicRequestBody`) |
| 2 | Cross-site `text/plain` POST accepted (CSRF) — e.g. a web page could change settings or start scans | High | Fixed — same-origin JSON only |
| 3 | Any `Host` accepted → DNS rebinding could read Desk responses; dev server listened on all interfaces | High | Fixed — loopback bind + Host allow-list |
| 4 | `/api/settings` stored arbitrary JSON fields | Low | Fixed — known fields, typed and bounded |
| 5 | No anti-framing headers | Low | Fixed |
| 6 | Server-side URL probe (SSRF by design) | Info | Accepted — loopback-only by default (see above) |

Regression tests: [`tests/desk/ui-guard.test.ts`](../tests/desk/ui-guard.test.ts).
Report a vulnerability: [`SECURITY.md`](../SECURITY.md).

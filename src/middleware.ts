import { NextResponse, type NextRequest } from "next/server";
import { checkUiRequest, UI_TOKEN_COOKIE } from "@/lib/ui-guard";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const result = checkUiRequest(
    {
      method: req.method,
      pathname: url.pathname,
      host: req.headers.get("host"),
      origin: req.headers.get("origin"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      contentType: req.headers.get("content-type"),
      cookieToken: req.cookies.get(UI_TOKEN_COOKIE)?.value ?? null,
      authorization: req.headers.get("authorization"),
      queryToken: url.searchParams.get("token"),
    },
    {
      token: process.env.ZERODAY_UI_TOKEN,
      allowedHosts: process.env.ZERODAY_UI_ALLOWED_HOSTS,
    },
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: "UI_GUARD" }, { status: result.status });
  }
  if (result.setTokenCookie) {
    // Move the token from the URL into an HttpOnly cookie so it is not left in history / Referer.
    // Relative Location: behind Docker / a LAN host, nextUrl carries the listen address.
    const params = new URLSearchParams(url.search);
    params.delete("token");
    const qs = params.toString();
    const res = new NextResponse(null, {
      status: 307,
      headers: { Location: `${url.pathname}${qs ? `?${qs}` : ""}` },
    });
    res.cookies.set(UI_TOKEN_COOKIE, url.searchParams.get("token")!, {
      httpOnly: true,
      sameSite: "strict",
      secure: url.protocol === "https:",
      path: "/",
    });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

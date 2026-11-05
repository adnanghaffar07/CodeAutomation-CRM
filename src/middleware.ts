// Edge gate. Cheap checks only; the membership (role, suspension) is checked against the database
// by currentUser() in the page or route, because the Edge runtime has no database driver.
//
//   1. Mutating requests from a foreign Origin are refused (CSRF backstop on top of SameSite cookies).
//   2. The Supabase session is refreshed here so server components always see a fresh cookie.
//   3. No session: pages go to /login?from=..., /api/* gets 401 JSON.
//   4. Public: /login, /auth/* (one-time link confirmation), /api/webhooks/* (they check their own secrets).
// Every passthrough carries x-pathname so the shell layout can guard a section by URL.
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login", "/auth"];
const PUBLIC_API = ["/api/webhooks"];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function under(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** True when the request plainly comes from another site. */
export function isForeignOrigin(req: Pick<NextRequest, "headers" | "method">): boolean {
  if (!MUTATING.has(req.method.toUpperCase())) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    try { return new URL(origin).host !== host; } catch { return true; }
  }
  if (origin === "null") return true;
  // No Origin header (older browsers, some same-origin navigations): fall back to Fetch Metadata.
  return req.headers.get("sec-fetch-site") === "cross-site";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (isForeignOrigin(req) && !under(pathname, PUBLIC_API)) {
    return NextResponse.json({ error: "Cross-site request refused", code: "forbidden_origin" }, { status: 403 });
  }

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  let res = NextResponse.next({ request: { headers } });

  if (under(pathname, PUBLIC_API)) return res;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: CookieToSet[]) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  if (!data.user && !under(pathname, PUBLIC_PAGES)) {
    if (isApi) return NextResponse.json({ error: "Not signed in", code: "unauthenticated" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?from=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|codeautomation-logo.svg).*)"],
};

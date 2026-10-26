import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/welcome", "/auth/callback", "/api/cron", "/api/mcp", "/manifest.webmanifest", "/sw.js", "/demo", "/icon"];

/** Passes the path to the root layout, which hides the app chrome on the landing page. */
function next(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  if (process.env.DEMO_MODE === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL) return next(req);
  let res = next(req);
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = next(req);
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims verifies the JWT locally (no Auth round trip) and refreshes the session cookie when needed.
  const { data } = await db.auth.getClaims();
  const path = req.nextUrl.pathname;
  // Signed out, "/" is the landing page; every other private page sends you there.
  if (!data?.claims?.sub && path !== "/" && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

import { type NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "crate_access";
const LOGIN_PATH = "/login";

/** Paths that are always public — never gated. */
const PUBLIC_PREFIXES = [
  LOGIN_PATH,
  "/api/auth",
  "/_next",
  "/favicon",
  "/manifest",
  "/opengraph",
  "/stocks",
  "/crate-logo",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return NextResponse.next();
  }

  // Check access cookie
  const hasAccess = request.cookies.get(COOKIE_NAME)?.value === "1";
  if (hasAccess) {
    return NextResponse.next();
  }

  // Redirect to login, preserving the intended destination
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files with extensions
     * (images, fonts, etc.) which are handled by the public prefix list above.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)).*)",
  ],
};

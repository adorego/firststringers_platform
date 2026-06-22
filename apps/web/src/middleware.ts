import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Always public — no auth needed
const PUBLIC_PATHS = ["/", "/welcome", "/login", "/register", "/api/auth", "/api/health"];

// Routes only athletes should access
const ATHLETE_PATHS = ["/chat", "/dossier", "/profile", "/conversations", "/pipeline", "/updates"];
// Routes only recruiters should access
const RECRUITER_PATHS = ["/billy", "/matches", "/search", "/connections", "/introductions"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let truly public paths through without any auth check
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // Not authenticated → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/welcome/returning", request.url));
  }

  const role = (token.role as string)?.toLowerCase();

  // Recruiter on an athlete-only route → /billy
  if (role === "recruiter" && ATHLETE_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/billy", request.url));
  }

  // Athlete on a recruiter-only route → /chat
  if (role === "athlete" && RECRUITER_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

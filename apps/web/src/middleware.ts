import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/register", "/welcome", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // Not authenticated → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  const role = token.role as string;

  // Athlete trying to access recruiter routes
  if (pathname.startsWith("/search") || pathname.startsWith("/matches")) {
    if (role === "athlete") {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
  }

  // Recruiter trying to access athlete routes
  if (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/dossier") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/conversations") ||
    pathname.startsWith("/dossier")
  ) {
    if (role === "recruiter") {
      return NextResponse.redirect(new URL("/matches", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

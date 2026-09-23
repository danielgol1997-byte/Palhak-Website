import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Role } from "@prisma/client";
import { hasAtLeastRole, VIEW_ONLY_DENIED_MESSAGE } from "@/lib/rbac";

const PUBLIC_PATHS = new Set<string>(["/auth", "/auth/verify", "/auth/error"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

function isAdminOnlyPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/soldiers") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/archive")
  );
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function viewOnlyDenied() {
  return NextResponse.json({ message: VIEW_ONLY_DENIED_MESSAGE }, { status: 403 });
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next();

  // API routes handle auth/authorization per-handler (return JSON 401/403 instead of redirects).
  // View-only accounts may read them, but cannot call mutating endpoints.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    if (!isSafeMethod(req.method)) {
      const apiToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      const apiRole = (apiToken?.role as Role | undefined) ?? Role.USER;
      if (apiRole === Role.VIEW_ONLY) return viewOnlyDenied();
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (token.active === false) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(url);
  }

  // Redirect to onboarding if user hasn't completed it
  const onboardedAt = token.onboardedAt as string | null | undefined;
  const needsOnboarding = !onboardedAt || onboardedAt === "null";
  
  if (needsOnboarding && pathname !== "/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }
  
  // If already onboarded, don't allow access to onboarding page
  if (onboardedAt && onboardedAt !== "null" && pathname === "/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/me";
    return NextResponse.redirect(url);
  }

  const role = (token.role as Role | undefined) ?? Role.USER;
  if (role === Role.VIEW_ONLY && !isSafeMethod(req.method)) {
    return viewOnlyDenied();
  }
  if (isAdminOnlyPath(pathname) && !hasAtLeastRole(role, Role.ADMIN)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    '/((?!_next/static|_next/image).*)',
  ],
};






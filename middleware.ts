import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // 5 attempts per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

export default withAuth(
  function middleware(req) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const isLoginRoute = req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/auth/signin';

    // Rate limit login attempts
    if (isLoginRoute && req.method === 'POST') {
      if (isRateLimited(ip)) {
        return NextResponse.json(
          { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
          { status: 429 }
        );
      }
    }

    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/verify-pin");
    const isApiRoute = req.nextUrl.pathname.startsWith("/api");

    // Allow access to auth pages if not authenticated
    if (isAuthPage && !isAuth) {
      return NextResponse.next();
    }

    // Redirect to login if not authenticated and trying to access protected routes
    if (!isAuth && !isAuthPage && !isApiRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // For API routes, let them handle auth internally
    if (isApiRoute) {
      return NextResponse.next();
    }

    // Role-based access for dashboard routes
    if (req.nextUrl.pathname.startsWith("/dashboard")) {
      const userRole = token?.rol as string;
      // Allow all authenticated users to dashboard for now
      // Add specific role checks as needed
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pedidos/:path*",
    "/categorias/:path*",
    "/movimientos/:path*",
    "/reportes/:path*",
    "/usuarios/:path*",
    "/api/:path*",
    "/login",
    "/verify-pin",
  ],
};
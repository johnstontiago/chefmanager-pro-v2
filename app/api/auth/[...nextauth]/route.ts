import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

// Envuelve el POST de NextAuth con rate limiting para proteger el endpoint de login real
export async function POST(request: Request, context: any) {
  const url = new URL(request.url);
  if (url.pathname.includes("/callback/credentials")) {
    const ip = getClientIP(request);
    const { allowed, resetAt } = checkRateLimit(`nextauth:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espere unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
        }
      );
    }
  }
  return handler(request, context);
}

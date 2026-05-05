import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // Solo superuser/admin puede acceder a la sección de administración
    if (req.nextUrl.pathname.startsWith("/admin")) {
      const userRole = token?.rol as string;
      if (!["superuser", "admin"].includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/pedidos/:path*",
    "/categorias/:path*",
    "/movimientos/:path*",
    "/reportes/:path*",
    "/usuarios/:path*",
    "/recepcion/:path*",
    "/inventario/:path*",
    "/consumo/:path*",
  ],
};

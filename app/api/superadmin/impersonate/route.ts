import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.rol !== "superuser") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await request.json();
  const id = parseInt(body.tenantId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  cookies().set("superadmin_sudo", String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ ok: true, tenant });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.rol !== "superuser") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  cookies().delete("superadmin_sudo");

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

function setCookie(value: object) {
  cookies().set("superadmin_sudo", JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

function getExistingContext() {
  const raw = cookies().get("superadmin_sudo")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// POST: entrar como un tenant (opcionalmente con una unidad ya seleccionada)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.rol !== "superuser") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const body = await request.json();
  const tenantId = parseInt(body.tenantId, 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, nombre: true },
  });
  if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const unidadId = body.unidadId ? parseInt(body.unidadId, 10) : null;
  const unidadNombre = body.unidadNombre ?? null;

  if (unidadId) {
    const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, tenantId } });
    if (!unidad) return NextResponse.json({ error: "Unidad no pertenece a este negocio" }, { status: 400 });
  }

  setCookie({ tenantId, unidadId, unidadNombre });
  return NextResponse.json({ ok: true, tenant });
}

// PATCH: actualizar la unidad activa dentro del tenant impersonado
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.rol !== "superuser") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const ctx = getExistingContext();
  if (!ctx?.tenantId) {
    return NextResponse.json({ error: "No hay sesión sudo activa" }, { status: 400 });
  }

  const body = await request.json();
  const unidadId = body.unidadId ? parseInt(body.unidadId, 10) : null;
  const unidadNombre = body.unidadNombre ?? null;

  // Verificar que la unidad pertenece al tenant impersonado
  if (unidadId) {
    const unidad = await prisma.unidad.findFirst({
      where: { id: unidadId, tenantId: ctx.tenantId },
    });
    if (!unidad) return NextResponse.json({ error: "Unidad no pertenece a este negocio" }, { status: 400 });
  }

  setCookie({ tenantId: ctx.tenantId, unidadId, unidadNombre });
  return NextResponse.json({ ok: true });
}

// DELETE: salir del modo impersonación
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.rol !== "superuser") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  cookies().delete("superadmin_sudo");
  return NextResponse.json({ ok: true });
}

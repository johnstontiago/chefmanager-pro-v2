import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { UsuarioCreateSchema } from "@/lib/schemas";

import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const tenantId = getActiveTenantId(user);
    const usuarios = await prisma.usuario.findMany({
      where: { tenantId },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        unidadId: true,
        pinCode: true,
        activo: true,
        createdAt: true,
        unidad: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ usuarios });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await request.json();
    const parsed = UsuarioCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { email, nombre, rol, unidadId, password, pinCode } = parsed.data;

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "El email ya existe" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        password: hashedPassword,
        rol: rol || "viewer",
        unidadId: unidadId || null,
        pinCode: pinCode || null,
        activo: true,
        tenantId: getActiveTenantId(user),
      },
    });

    return NextResponse.json({ usuario: { ...usuario, password: undefined } });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

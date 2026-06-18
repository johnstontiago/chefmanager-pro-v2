import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { UsuarioCreateSchema } from "@/lib/schemas";

import { getActiveTenantId } from "@/lib/get-active-tenant";
import { puedeAccederGestionUsuarios, puedeAsignarRol } from "@/lib/user-permissions";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (!puedeAccederGestionUsuarios(user.rol)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const tenantId = getActiveTenantId(user);
    const usuarios = await prisma.usuario.findMany({
      // El admin no ve la cuenta del superusuario (dueño de la plataforma).
      where: { tenantId, ...(user.rol === "admin" ? { rol: { not: "superuser" } } : {}) },
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

    // No exponer el PIN (ni su hash) al cliente; solo si existe.
    const usuariosSafe = usuarios.map(({ pinCode, ...u }) => ({ ...u, hasPin: !!pinCode }));
    return NextResponse.json({ usuarios: usuariosSafe });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (!puedeAccederGestionUsuarios(user.rol)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await request.json();
    const parsed = UsuarioCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { email, nombre, rol, unidadId, password, pinCode } = parsed.data;

    // Un admin solo puede crear usuarios de rol inferior (no admin ni superuser).
    if (!puedeAsignarRol(user.rol, rol || "viewer")) {
      return NextResponse.json({ error: "No puedes crear usuarios con ese rol" }, { status: 403 });
    }

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
        pinCode: pinCode ? await hashPin(pinCode) : null,
        activo: true,
        tenantId: getActiveTenantId(user),
      },
    });

    return NextResponse.json({ usuario: { ...usuario, password: undefined } });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

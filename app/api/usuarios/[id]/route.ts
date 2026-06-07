import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { UsuarioUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const parsed = UsuarioUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { email, nombre, rol, unidadId, password, pinCode, activo } = parsed.data;

    const tenantId = user.tenantId as number;
    const existing = await prisma.usuario.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const data: any = {};
    if (email !== undefined) data.email = email;
    if (nombre !== undefined) data.nombre = nombre;
    if (rol !== undefined) data.rol = rol;
    if (unidadId !== undefined) data.unidadId = unidadId ?? null;
    if (password) data.password = await bcrypt.hash(password, 10);
    if (pinCode !== undefined) data.pinCode = pinCode;
    if (activo !== undefined) data.activo = activo;

    const usuario = await prisma.usuario.update({ where: { id: parseInt(id) }, data });

    return NextResponse.json({ usuario: { ...usuario, password: undefined } });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    await prisma.usuario.update({ where: { id: parseInt(id) }, data: { activo: false } });

    return NextResponse.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

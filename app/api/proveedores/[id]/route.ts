import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// Proveedores son globales - compartidos entre todas las unidades
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden editar proveedores
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const { nombre, contacto, telefono, email, activo } = await request.json();

    const tenantId = user.tenantId as number;
    const existing = await prisma.proveedor.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const proveedor = await prisma.proveedor.update({
      where: { id: parseInt(id) },
      data: { nombre, contacto, telefono, email, activo: activo !== undefined ? activo : existing.activo },
    });

    return NextResponse.json({ proveedor });
  } catch (error) {
    console.error("Error updating proveedor:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden eliminar proveedores
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const tenantId = user.tenantId as number;
    const existing = await prisma.proveedor.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Soft delete
    await prisma.proveedor.update({ where: { id: parseInt(id) }, data: { activo: false } });

    return NextResponse.json({ message: "Proveedor eliminado" });
  } catch (error) {
    console.error("Error deleting proveedor:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

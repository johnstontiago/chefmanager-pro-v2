import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// Categorías son globales - compartidas entre todas las unidades
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden editar categorías
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const { nombre, activo } = await request.json();

    const tenantId = user.tenantId as number;
    const existing = await prisma.categoria.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const categoria = await prisma.categoria.update({
      where: { id: parseInt(id) },
      data: { nombre, activo: activo !== undefined ? activo : existing.activo },
    });

    return NextResponse.json({ categoria });
  } catch (error) {
    console.error("Error updating categoria:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden eliminar categorías
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const tenantId = user.tenantId as number;

    const existing = await prisma.categoria.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Verificar si tiene productos asociados
    const productosCount = await prisma.producto.count({ where: { categoriaId: parseInt(id) } });
    if (productosCount > 0) {
      // Soft delete
      await prisma.categoria.update({ where: { id: parseInt(id) }, data: { activo: false } });
      return NextResponse.json({ message: "Categoría desactivada (tiene productos)" });
    }

    await prisma.categoria.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ message: "Categoría eliminada" });
  } catch (error) {
    console.error("Error deleting categoria:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

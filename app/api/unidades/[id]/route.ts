import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const tenantId = (session.user as any).tenantId as number;
    const unidad = await prisma.unidad.findFirst({
      where: { id, tenantId },
    });

    if (!unidad) {
      return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
    }

    return NextResponse.json(unidad);
  } catch (error) {
    console.error("Error fetching unidad:", error);
    return NextResponse.json(
      { error: "Error al obtener unidad" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.rol !== "superuser") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await request.json();
    const { nombre, direccion, responsable, telefono, activo } = body ?? {};

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    const unidad = await prisma.unidad.update({
      where: { id },
      data: {
        nombre,
        direccion: direccion || null,
        responsable: responsable || null,
        telefono: telefono || null,
        activo: activo !== undefined ? activo : true,
      },
    });

    return NextResponse.json(unidad);
  } catch (error) {
    console.error("Error updating unidad:", error);
    return NextResponse.json(
      { error: "Error al actualizar unidad" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.rol !== "superuser") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);

    // Check if unidad has related data (usuarios, pedidos, inventario, movimientos)
    const tenantId = user.tenantId as number;
    const unidad = await prisma.unidad.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            usuarios: true,
            pedidos: true,
            inventario: true,
            movimientos: true,
          },
        },
      },
    });

    if (!unidad) {
      return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
    }

    const totalRelated =
      unidad._count.usuarios +
      unidad._count.pedidos +
      unidad._count.inventario +
      unidad._count.movimientos;

    if (totalRelated > 0) {
      // Soft delete - just mark as inactive
      await prisma.unidad.update({
        where: { id },
        data: { activo: false },
      });
      return NextResponse.json({ message: "Unidad desactivada (tiene datos relacionados)" });
    } else {
      // Hard delete if no related data
      await prisma.unidad.delete({
        where: { id },
      });
      return NextResponse.json({ message: "Unidad eliminada" });
    }
  } catch (error) {
    console.error("Error deleting unidad:", error);
    return NextResponse.json(
      { error: "Error al eliminar unidad" },
      { status: 500 }
    );
  }
}

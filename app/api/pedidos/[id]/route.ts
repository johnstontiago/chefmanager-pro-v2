import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { PedidoPatchSchema } from "@/lib/schemas";

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

    const user = session.user as any;
    const { id } = await params;
    const pedidoId = parseInt(id);

    const whereClause: any = { id: pedidoId };
    if (user.rol !== "superuser" && user.unidadId) {
      whereClause.unidadId = user.unidadId;
    }

    const pedido = await prisma.pedido.findFirst({
      where: whereClause,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, nombre: true } },
        items: {
          include: {
            producto: {
              include: {
                categoria: { select: { id: true, nombre: true } },
                proveedor: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const pedidoFormateado = {
      ...pedido,
      total: toNumber(pedido.total),
      items: pedido.items.map((i: any) => ({
        ...i,
        cantidad: toNumber(i.cantidad),
        precioUnitario: toNumber(i.precioUnitario),
        producto: {
          ...i.producto,
          precioUnitario: toNumber(i.producto.precioUnitario),
          stockMinimo: toNumber(i.producto.stockMinimo),
        },
      })),
    };

    return NextResponse.json({ pedido: pedidoFormateado });
  } catch (error) {
    console.error("Error fetching pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;
    const pedidoId = parseInt(id);
    const body = await request.json();
    const parsed = PedidoPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { estado, notas } = parsed.data;

    const whereClause: any = { id: pedidoId };
    if (user.rol !== "superuser" && user.unidadId) {
      whereClause.unidadId = user.unidadId;
    }

    const existing = await prisma.pedido.findFirst({ where: whereClause });

    if (!existing) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const pedido = await prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado, ...(notas !== undefined && { notas }) },
    });

    return NextResponse.json({ pedido, message: "Estado actualizado" });
  } catch (error) {
    console.error("Error updating pedido:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
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
    const { id } = await params;
    const pedidoId = parseInt(id);

    const whereClause: any = { id: pedidoId };
    if (user.rol !== "superuser" && user.unidadId) {
      whereClause.unidadId = user.unidadId;
    }

    const existing = await prisma.pedido.findFirst({ where: whereClause });

    if (!existing) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    await prisma.pedido.delete({ where: { id: pedidoId } });

    return NextResponse.json({ message: "Pedido eliminado" });
  } catch (error) {
    console.error("Error deleting pedido:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

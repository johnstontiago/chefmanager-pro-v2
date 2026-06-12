import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, itemId } = await params;
    const body = await request.json();
    const { cantidadRecibida, estadoLinea, lote, fechaCaducidad, nuevoPrecio } = body;

    const tenantId = getActiveTenantId(session.user as any);
    // Verifica IDOR: el pedido debe pertenecer al tenant del usuario
    const pedido = await prisma.pedido.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

    const existing = await prisma.pedidoItem.findFirst({
      where: { id: parseInt(itemId), pedidoId: parseInt(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    // Precio real de llegada (opcional): vacío = sin cambios; con valor,
    // se asume para el lote recibido y para el producto a futuro
    const precioActualizado =
      nuevoPrecio !== undefined && nuevoPrecio !== null && nuevoPrecio !== ""
        ? parseFloat(String(nuevoPrecio))
        : null;
    const aplicarPrecio =
      precioActualizado !== null && !isNaN(precioActualizado) && precioActualizado > 0;

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.pedidoItem.update({
        where: { id: parseInt(itemId) },
        data: {
          cantidadRecibida: cantidadRecibida ?? existing.cantidadRecibida,
          estadoLinea: estadoLinea ?? existing.estadoLinea,
          lote: lote !== undefined ? lote : existing.lote,
          fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : existing.fechaCaducidad,
          fechaRecepcion: new Date(),
          ...(aplicarPrecio ? { precioUnitario: precioActualizado } : {}),
        },
      });

      if (aplicarPrecio) {
        await tx.producto.updateMany({
          where: { id: existing.productoId, tenantId },
          data: { precioUnitario: precioActualizado },
        });

        // Mantiene coherente el total del pedido con los precios reales
        const items = await tx.pedidoItem.findMany({
          where: { pedidoId: parseInt(id) },
          select: { cantidad: true, precioUnitario: true },
        });
        const total = items.reduce(
          (acc, i) => acc + Number(i.cantidad) * Number(i.precioUnitario),
          0
        );
        await tx.pedido.update({ where: { id: parseInt(id) }, data: { total } });
      }

      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating pedido item:", error);
    return NextResponse.json({ error: "Error al actualizar ítem" }, { status: 500 });
  }
}

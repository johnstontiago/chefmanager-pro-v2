import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

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
    const { cantidadRecibida, estadoLinea, lote, fechaCaducidad } = body;

    const existing = await prisma.pedidoItem.findFirst({
      where: { id: parseInt(itemId), pedidoId: parseInt(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    const item = await prisma.pedidoItem.update({
      where: { id: parseInt(itemId) },
      data: {
        cantidadRecibida: cantidadRecibida ?? existing.cantidadRecibida,
        estadoLinea: estadoLinea ?? existing.estadoLinea,
        lote: lote !== undefined ? lote : existing.lote,
        fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : existing.fechaCaducidad,
        fechaRecepcion: new Date(),
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating pedido item:", error);
    return NextResponse.json({ error: "Error al actualizar ítem" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

// Registra consumo o merma descontando de un LoteInventario concreto.
// Crea un ConsumoLote (trazabilidad de stock) y un Movimiento (historial).
interface Body {
  loteId: number;
  cantidad: number;
  motivo: "CONSUMO" | "MERMA";
  notas?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const user = session.user as any;
    const tenantId = getActiveTenantId(user);
    const unidadId = getActiveUnidadId(user);
    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad activa" }, { status: 400 });
    }

    const { loteId, cantidad, motivo, notas } = (await req.json()) as Body;

    if (!loteId || !cantidad || cantidad <= 0) {
      return NextResponse.json({ error: "Faltan loteId o cantidad válida" }, { status: 400 });
    }
    if (motivo === "MERMA" && !notas?.trim()) {
      return NextResponse.json({ error: "Las mermas requieren una nota" }, { status: 400 });
    }

    // Tenant scoping
    const lote = await prisma.loteInventario.findFirst({
      where: { id: loteId, tenantId },
      include: { producto: { select: { id: true, nombre: true } } },
    });
    if (!lote) {
      return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    }
    if (cantidad > lote.cantidadActual) {
      return NextResponse.json(
        { error: "Cantidad mayor al stock disponible del lote" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const nuevaCantidad = lote.cantidadActual - cantidad;
      await tx.loteInventario.update({
        where: { id: lote.id },
        data: { cantidadActual: nuevaCantidad, agotado: nuevaCantidad <= 0 },
      });

      await tx.consumoLote.create({
        data: {
          tenantId,
          loteId: lote.id,
          cantidad,
          motivo,
          referenciaId: notas ? `nota:${notas.slice(0, 80)}` : null,
        },
      });

      // Movimiento para el historial (tipo en minúscula como el resto de la app)
      await tx.movimiento.create({
        data: {
          productoId: lote.productoId,
          tenantId,
          unidadId,
          tipo: motivo === "MERMA" ? "merma" : "consumo",
          cantidad: new Decimal(cantidad),
          usuarioId: Number(user.id),
          lote: lote.numeroLote,
          notas: notas || null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/consumo/registrar]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

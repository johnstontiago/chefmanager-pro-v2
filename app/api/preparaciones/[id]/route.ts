import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

// Detalle de una preparación (LoteElaboracion): ítems de inventario consumidos
// (con su lote/código únicos) y consumos posteriores.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tenantId = getActiveTenantId(session.user as any);

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const lote = await prisma.loteElaboracion.findFirst({
    where: { id, tenantId },
    include: {
      elaboracion: { select: { nombre: true, unidadBase: true, procedimiento: true } },
      insumos: {
        orderBy: { createdAt: "asc" },
        include: {
          loteInventario: {
            select: {
              id: true, numeroLote: true, codigoUnico: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      },
      consumos: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!lote) return NextResponse.json({ error: "Preparación no encontrada" }, { status: 404 });

  return NextResponse.json({
    id: lote.id,
    elaboracionNombre: lote.elaboracion.nombre,
    unidadBase: lote.elaboracion.unidadBase,
    procedimiento: lote.elaboracion.procedimiento,
    numeroLote: lote.numeroLote,
    numeroEnvases: lote.numeroEnvases,
    codigoUnico: lote.codigoUnico,
    cantidadInicial: lote.cantidadInicial,
    cantidadActual: lote.cantidadActual,
    fechaProduccion: lote.fechaProduccion.toISOString(),
    fechaCaducidad: lote.fechaCaducidad ? lote.fechaCaducidad.toISOString() : null,
    notas: lote.notas,
    insumos: lote.insumos.map((i) => ({
      id: i.id,
      // Snapshot guardado al producir; si falta, cae al lote actual
      productoNombre: i.productoNombre ?? i.loteInventario.producto.nombre,
      numeroLote: i.numeroLote ?? i.loteInventario.numeroLote,
      codigoUnico: i.codigoUnico ?? i.loteInventario.codigoUnico,
      loteInventarioId: i.loteInventarioId,
      cantidadUsada: i.cantidadUsada,
    })),
    consumos: lote.consumos.map((c) => ({
      id: c.id,
      cantidad: c.cantidad,
      motivo: c.motivo,
      referenciaId: c.referenciaId,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas, canDeleteFichas } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decoratePreparacion } from "@/lib/fichas/costing";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const [preparacion, maps] = await Promise.all([
      prisma.preparacion.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          ingredientes: { include: { insumo: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);
    if (!preparacion) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(decoratePreparacion(preparacion, maps));
  } catch (error) {
    console.error("Error fetching preparacion:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canEditFichas(ctx.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const existente = await prisma.preparacion.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const { nombre, porciones, ingredientes, procedimiento } = await req.json();

    const porcionesNum = parseFloat(porciones);
    if (!nombre || !porciones || isNaN(porcionesNum) || porcionesNum <= 0) {
      return NextResponse.json(
        { error: "Nombre y porciones (número mayor a 0) son requeridos" },
        { status: 400 }
      );
    }

    const maps = await getLiveCostMaps(ctx.tenantId);
    let costoTotal = 0;
    for (const ing of ingredientes || []) {
      const insumoId = parseInt(String(ing.insumoId), 10);
      // El mapa contiene exactamente los insumos del tenant: rechaza ajenos
      if (!maps.insumoValue.has(insumoId)) {
        return NextResponse.json({ error: "Insumo inválido" }, { status: 400 });
      }
      const valor = maps.insumoValue.get(insumoId) ?? 0;
      costoTotal += valor * (parseFloat(String(ing.cantidad)) || 0);
    }
    const costoPorPorcion = costoTotal / porcionesNum;

    const preparacion = await prisma.$transaction(async (tx) => {
      await tx.preparacionIngrediente.deleteMany({
        where: { preparacionId: id },
      });

      const updated = await tx.preparacion.update({
        where: { id },
        data: {
          nombre,
          porciones: porcionesNum,
          costoTotal,
          costoPorPorcion,
          procedimiento: procedimiento ?? null,
          ingredientes: {
            create: (ingredientes || []).map(
              (ing: { insumoId: number | string; cantidad: number | string }) => ({
                insumoId: parseInt(String(ing.insumoId), 10),
                cantidad: parseFloat(String(ing.cantidad)) || 0,
              })
            ),
          },
        },
        include: {
          ingredientes: { include: { insumo: true } },
        },
      });

      // Mantiene sincronizado el insumo generado por la preparación
      await tx.insumo.updateMany({
        where: { preparacionId: id, tenantId: ctx.tenantId },
        data: {
          nombre: updated.nombre,
          valorPorUnidad: updated.costoPorPorcion,
        },
      });

      return updated;
    });

    return NextResponse.json(preparacion);
  } catch (error) {
    console.error("Error updating preparacion:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canDeleteFichas(ctx.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const existente = await prisma.preparacion.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // El insumo generado puede estar en uso en fichas: verificar antes
    const insumoGenerado = await prisma.insumo.findFirst({
      where: { preparacionId: id, tenantId: ctx.tenantId },
      include: { _count: { select: { fichaIngredientes: true } } },
    });
    if (insumoGenerado && insumoGenerado._count.fichaIngredientes > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: la preparación se usa como ingrediente en ${insumoGenerado._count.fichaIngredientes} ficha(s)`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.insumo.deleteMany({ where: { preparacionId: id, tenantId: ctx.tenantId } });
      await tx.preparacion.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting preparacion:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas, canDeleteFichas } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decorateFicha } from "@/lib/fichas/costing";

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
    const [ficha, maps] = await Promise.all([
      prisma.fichaTecnica.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          categoria: true,
          ingredientes: { include: { insumo: true } },
          creadoPor: { select: { nombre: true } },
          actualizadoPor: { select: { nombre: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);

    if (!ficha) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json(decorateFicha(ficha, maps));
  } catch (error) {
    console.error("Error fetching ficha:", error);
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
    const existente = await prisma.fichaTecnica.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const {
      nombre,
      categoriaId,
      descripcion,
      porciones,
      tiempoMin,
      urlImagen,
      alergenos,
      procedimiento,
      ingredientes,
    } = await req.json();

    const maps = await getLiveCostMaps(ctx.tenantId);
    const porcionesNum = parseFloat(porciones) || 1;

    const lineas = (ingredientes || []).map(
      (ing: { insumoId: number | string; cantidad: number | string }) => {
        const insumoId = parseInt(String(ing.insumoId), 10);
        const cantidad = parseFloat(String(ing.cantidad)) || 0;
        const valor = maps.insumoValue.get(insumoId) ?? 0;
        return { insumoId, cantidad, costoCalculado: valor * cantidad };
      }
    );
    const costoTotal = lineas.reduce(
      (acc: number, l: { costoCalculado: number }) => acc + l.costoCalculado,
      0
    );

    const ficha = await prisma.$transaction(async (tx) => {
      await tx.fichaIngrediente.deleteMany({ where: { fichaId: id } });

      return tx.fichaTecnica.update({
        where: { id },
        data: {
          nombre,
          categoriaId: categoriaId ? parseInt(String(categoriaId), 10) : null,
          descripcion,
          porciones: porcionesNum,
          tiempoMin: parseInt(tiempoMin) || 0,
          urlImagen,
          alergenos: alergenos || [],
          procedimiento,
          costoTotal,
          costoPorPorcion: costoTotal / porcionesNum,
          actualizadoPorId: ctx.userId,
          ingredientes: { create: lineas },
        },
        include: {
          categoria: true,
          ingredientes: { include: { insumo: true } },
          creadoPor: { select: { nombre: true } },
          actualizadoPor: { select: { nombre: true } },
        },
      });
    });

    return NextResponse.json(ficha);
  } catch (error) {
    console.error("Error updating ficha:", error);
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
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const ficha = await prisma.fichaTecnica.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { creadoPorId: true },
    });
    if (!ficha) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    // admin/superuser eliminan cualquiera; cocina solo las que creó
    const esPropia = ficha.creadoPorId !== null && ficha.creadoPorId === ctx.userId;
    if (!canDeleteFichas(ctx.rol) && !(canEditFichas(ctx.rol) && esPropia)) {
      return NextResponse.json(
        { error: "Solo puedes eliminar fichas que tú mismo creaste" },
        { status: 403 }
      );
    }

    await prisma.fichaTecnica.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting ficha:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

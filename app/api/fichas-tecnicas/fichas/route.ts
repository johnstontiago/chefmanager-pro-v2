import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decorateFicha } from "@/lib/fichas/costing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const categoriaIdRaw = searchParams.get("categoriaId") || "";
  const categoriaId = categoriaIdRaw ? parseInt(categoriaIdRaw, 10) : null;

  try {
    const [fichas, maps] = await Promise.all([
      prisma.fichaTecnica.findMany({
        where: {
          tenantId: ctx.tenantId,
          AND: [
            search ? { nombre: { contains: search, mode: "insensitive" } } : {},
            categoriaId !== null && !isNaN(categoriaId) ? { categoriaId } : {},
          ],
        },
        orderBy: { updatedAt: "desc" },
        include: {
          categoria: true,
          ingredientes: { include: { insumo: true } },
          creadoPor: { select: { nombre: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);

    return NextResponse.json(fichas.map((f) => decorateFicha(f, maps)));
  } catch (error) {
    console.error("Error fetching fichas:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canEditFichas(ctx.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
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

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

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

    const ficha = await prisma.fichaTecnica.create({
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
        creadoPorId: ctx.userId,
        actualizadoPorId: ctx.userId,
        tenantId: ctx.tenantId,
        ingredientes: { create: lineas },
      },
      include: {
        categoria: true,
        ingredientes: { include: { insumo: true } },
        creadoPor: { select: { nombre: true } },
      },
    });

    return NextResponse.json(ficha, { status: 201 });
  } catch (error) {
    console.error("Error creating ficha:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

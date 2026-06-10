import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decoratePreparacion } from "@/lib/fichas/costing";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [preparaciones, maps] = await Promise.all([
      prisma.preparacion.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { nombre: "asc" },
        include: {
          ingredientes: { include: { insumo: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);

    return NextResponse.json(preparaciones.map((p) => decoratePreparacion(p, maps)));
  } catch (error) {
    console.error("Error fetching preparaciones:", error);
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
      const creada = await tx.preparacion.create({
        data: {
          nombre,
          porciones: porcionesNum,
          costoTotal,
          costoPorPorcion,
          procedimiento: procedimiento || null,
          tenantId: ctx.tenantId,
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

      // Mecánica clave: toda preparación genera un insumo usable en recetas
      await tx.insumo.create({
        data: {
          nombre: creada.nombre,
          unidad: "porcion",
          valorPorUnidad: creada.costoPorPorcion,
          esPreparacion: true,
          preparacionId: creada.id,
          tenantId: ctx.tenantId,
        },
      });

      return creada;
    });

    return NextResponse.json(preparacion, { status: 201 });
  } catch (error) {
    console.error("Error creating preparacion:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

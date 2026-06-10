import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decorateInsumo, syncProductosAsInsumos } from "@/lib/fichas/costing";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Materializa productos del inventario como insumos disponibles
    await syncProductosAsInsumos(ctx.tenantId);

    const [insumos, maps] = await Promise.all([
      prisma.insumo.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { nombre: "asc" },
        include: {
          preparacion: { select: { id: true, nombre: true } },
          producto: { select: { id: true, nombre: true, activo: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);

    return NextResponse.json(insumos.map((i) => decorateInsumo(i, maps)));
  } catch (error) {
    console.error("Error fetching insumos:", error);
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
    const { nombre, unidad, valorPorUnidad } = await req.json();

    if (!nombre || !unidad || valorPorUnidad === undefined || valorPorUnidad === null) {
      return NextResponse.json(
        { error: "Nombre, unidad y valor son requeridos" },
        { status: 400 }
      );
    }

    const valor = parseFloat(valorPorUnidad);
    if (isNaN(valor) || valor < 0) {
      return NextResponse.json(
        { error: "El valor por unidad debe ser un número positivo" },
        { status: 400 }
      );
    }

    const insumo = await prisma.insumo.create({
      data: {
        nombre,
        unidad,
        valorPorUnidad: valor,
        tenantId: ctx.tenantId,
      },
    });

    return NextResponse.json(insumo, { status: 201 });
  } catch (error) {
    console.error("Error creating insumo:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

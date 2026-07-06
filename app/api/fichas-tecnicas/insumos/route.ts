import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas } from "@/lib/fichas/permissions";
import { getCatalogoInsumos } from "@/lib/fichas/insumos";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getCatalogoInsumos(ctx.tenantId));
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

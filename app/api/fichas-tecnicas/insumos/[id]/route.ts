import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas, canDeleteFichas } from "@/lib/fichas/permissions";

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
    const insumo = await prisma.insumo.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!insumo) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(insumo);
  } catch (error) {
    console.error("Error fetching insumo:", error);
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
    const existente = await prisma.insumo.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (existente.productoId !== null) {
      return NextResponse.json(
        { error: "Este insumo proviene del inventario. Edita el producto en el módulo de inventario." },
        { status: 400 }
      );
    }
    if (existente.esPreparacion) {
      return NextResponse.json(
        { error: "Este insumo proviene de una preparación. Edita la preparación." },
        { status: 400 }
      );
    }

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

    const insumo = await prisma.insumo.update({
      where: { id },
      data: { nombre, unidad, valorPorUnidad: valor },
    });

    return NextResponse.json(insumo);
  } catch (error) {
    console.error("Error updating insumo:", error);
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
    const existente = await prisma.insumo.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        _count: { select: { fichaIngredientes: true, preparacionIngredientes: true } },
      },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (existente.esPreparacion) {
      return NextResponse.json(
        { error: "Elimina la preparación para quitar este insumo" },
        { status: 400 }
      );
    }
    const usos =
      existente._count.fichaIngredientes + existente._count.preparacionIngredientes;
    if (usos > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: el insumo se usa en ${usos} receta(s)` },
        { status: 400 }
      );
    }

    await prisma.insumo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting insumo:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas, canDeleteFichas } from "@/lib/fichas/permissions";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
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
    const existente = await prisma.fichaCategoria.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const { nombre } = await req.json();
    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const categoria = await prisma.fichaCategoria.update({
      where: { id },
      data: { nombre },
    });

    return NextResponse.json(categoria);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 400 }
      );
    }
    console.error("Error updating categoria de fichas:", error);
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
    const existente = await prisma.fichaCategoria.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Las fichas asociadas quedan sin categoría (categoriaId → null)
    await prisma.$transaction(async (tx) => {
      await tx.fichaTecnica.updateMany({
        where: { categoriaId: id, tenantId: ctx.tenantId },
        data: { categoriaId: null },
      });
      await tx.fichaCategoria.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting categoria de fichas:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext, canEditFichas } from "@/lib/fichas/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const categorias = await prisma.fichaCategoria.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { nombre: "asc" },
      include: { _count: { select: { fichas: true } } },
    });
    return NextResponse.json(categorias);
  } catch (error) {
    console.error("Error fetching categorias de fichas:", error);
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
    const { nombre } = await req.json();

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    const categoria = await prisma.fichaCategoria.create({
      data: { nombre, tenantId: ctx.tenantId },
    });

    return NextResponse.json(categoria, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 400 }
      );
    }
    console.error("Error creating categoria de fichas:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

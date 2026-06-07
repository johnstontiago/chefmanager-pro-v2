import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { CategoriaCreateSchema } from "@/lib/schemas";

import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tenantId = getActiveTenantId(session.user as any);
    const categorias = await prisma.categoria.findMany({
      where: { activo: true, tenantId },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ categorias });
  } catch (error) {
    console.error("Error fetching categorias:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = CategoriaCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { nombre } = parsed.data;

    const existing = await prisma.categoria.findFirst({ where: { nombre, tenantId: getActiveTenantId(user) } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 });
    }

    const categoria = await prisma.categoria.create({
      data: { nombre, activo: true, tenantId: getActiveTenantId(user) },
    });

    return NextResponse.json({ categoria, message: "Categoría creada" });
  } catch (error) {
    console.error("Error creating categoria:", error);
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}

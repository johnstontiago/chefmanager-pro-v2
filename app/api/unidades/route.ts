import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { UnidadCreateSchema } from "@/lib/schemas";

import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const tenantId = getActiveTenantId(user);
    let unidades: any[] = [];

    if (user.rol === "superuser" || user.rol === "admin") {
      unidades = await prisma.unidad.findMany({
        where: { activo: true, tenantId },
        orderBy: { nombre: "asc" },
      });
    } else {
      if (user.unidadId) {
        unidades = await prisma.unidad.findMany({
          where: { id: user.unidadId, tenantId, activo: true },
        });
      } else {
        unidades = [];
      }
    }

    return NextResponse.json({ unidades });
  } catch (error) {
    console.error("Error fetching unidades:", error);
    return NextResponse.json(
      { error: "Error al obtener unidades" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.rol !== "superuser") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = UnidadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { nombre, direccion, responsable, telefono } = parsed.data;

    const unidad = await prisma.unidad.create({
      data: {
        nombre,
        direccion: direccion || null,
        responsable: responsable || null,
        telefono: telefono || null,
        activo: true,
        tenantId: getActiveTenantId(user),
      },
    });

    return NextResponse.json(unidad);
  } catch (error) {
    console.error("Error creating unidad:", error);
    return NextResponse.json(
      { error: "Error al crear unidad" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UnidadSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  direccion: z.string().max(500).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const tenantId = parseInt(params.id);
    if (isNaN(tenantId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

    const body = await request.json();
    const parsed = UnidadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const unidad = await prisma.unidad.create({
      data: {
        nombre: parsed.data.nombre,
        direccion: parsed.data.direccion || null,
        telefono: parsed.data.telefono || null,
        activo: true,
        tenantId,
      },
    });

    return NextResponse.json({ unidad }, { status: 201 });
  } catch (error) {
    console.error("[superadmin] POST unidad:", error);
    return NextResponse.json({ error: "Error al crear la unidad" }, { status: 500 });
  }
}

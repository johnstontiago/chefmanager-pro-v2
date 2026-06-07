import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; unitId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const tenantId = parseInt(params.id);
    const unitId = parseInt(params.unitId);
    if (isNaN(tenantId) || isNaN(unitId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const unidad = await prisma.unidad.findFirst({ where: { id: unitId, tenantId } });
    if (!unidad) return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });

    // Desasignar usuarios de esta unidad antes de borrar
    await prisma.usuario.updateMany({ where: { unidadId: unitId }, data: { unidadId: null } });

    await prisma.unidad.delete({ where: { id: unitId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[superadmin] DELETE unidad:", error);
    return NextResponse.json({ error: "Error al eliminar la unidad" }, { status: 500 });
  }
}

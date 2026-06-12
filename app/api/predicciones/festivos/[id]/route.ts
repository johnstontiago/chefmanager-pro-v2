import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["superuser", "admin"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    const tenantId = getActiveTenantId(user);
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existente = await prisma.festivo.findFirst({ where: { id, tenantId } });
    if (!existente) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.festivo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting festivo:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

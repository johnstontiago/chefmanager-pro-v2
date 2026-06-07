import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const tenantId = parseInt(params.id);
    const userId = parseInt(params.userId);
    if (isNaN(tenantId) || isNaN(userId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const usuario = await prisma.usuario.findFirst({ where: { id: userId, tenantId } });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // No permitir borrar al propio superuser que está operando
    if (userId === parseInt(user.id)) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
    }

    await prisma.usuario.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[superadmin] DELETE usuario:", error);
    return NextResponse.json({ error: "Error al eliminar el usuario" }, { status: 500 });
  }
}

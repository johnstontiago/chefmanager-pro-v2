import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getActiveTenantId } from "@/lib/get-active-tenant";
import { puedeAccederGestionUsuarios, puedeGestionarUsuario } from "@/lib/user-permissions";

export const dynamic = "force-dynamic";

// Anonimización RGPD (derecho de supresión, Art. 17). Elimina de forma
// irreversible los datos personales del usuario (email, nombre, PIN y la
// contraseña) conservando el registro y sus relaciones (pedidos, movimientos,
// recepciones) para no romper el historial operativo ni la integridad.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (!puedeAccederGestionUsuarios(user.rol)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);
    if (Number.isNaN(userId)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

    const tenantId = getActiveTenantId(user);
    const existing = await prisma.usuario.findFirst({ where: { id: userId, tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Un admin solo puede anonimizar usuarios de rol inferior (no admins/superusers).
    if (!puedeGestionarUsuario(user.rol, existing.rol)) {
      return NextResponse.json({ error: "No puedes gestionar a este usuario" }, { status: 403 });
    }

    // Contraseña aleatoria inutilizable (no se conserva en ningún sitio).
    const anonPassword = await bcrypt.hash(randomUUID(), 10);

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        email: `anon-${userId}@borrado.local`,
        nombre: "Usuario anonimizado",
        password: anonPassword,
        pinCode: null,
        activo: false,
      },
    });

    return NextResponse.json({ message: "Usuario anonimizado" });
  } catch (error) {
    console.error("Error anonimizando usuario:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

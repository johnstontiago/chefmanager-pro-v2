import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";
import { getSugerenciasPedido } from "@/lib/predicciones/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    if (!["superuser", "admin", "recepcion"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const tenantId = getActiveTenantId(user);
    const unidadId = getActiveUnidadId(user);
    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad asignada" }, { status: 400 });
    }

    const resultado = await getSugerenciasPedido(tenantId, unidadId);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error generando sugerencias:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

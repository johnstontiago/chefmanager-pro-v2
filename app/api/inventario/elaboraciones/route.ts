import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

// Preparaciones (elaboraciones producidas) en stock, agregando sus lotes activos.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const tenantId = getActiveTenantId(session.user as any);

    const elaboraciones = await prisma.elaboracion.findMany({
      where: { tenantId, activa: true },
      orderBy: { nombre: "asc" },
      include: {
        lotes: {
          where: { agotado: false, cantidadActual: { gt: 0 } },
          orderBy: { fechaCaducidad: "asc" },
          select: {
            id: true, cantidadActual: true, numeroLote: true,
            numeroEnvases: true, fechaCaducidad: true, fechaProduccion: true,
          },
        },
      },
    });

    const data = elaboraciones.map((e) => {
      const stockActual = e.lotes.reduce((s, l) => s + l.cantidadActual, 0);
      const stockMinimo = e.stockMinimo ?? 0;
      const isLowStock = stockMinimo > 0 && stockActual <= stockMinimo;
      return {
        id: e.id,
        nombre: e.nombre,
        unidadBase: e.unidadBase,
        stockActual,
        stockMinimo: e.stockMinimo,
        isLowStock,
        proximaCaducidad: e.lotes.find((l) => l.fechaCaducidad)?.fechaCaducidad ?? null,
        lotes: e.lotes,
      };
    });

    return NextResponse.json({ elaboraciones: data });
  } catch (error) {
    console.error("[GET /api/inventario/elaboraciones]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

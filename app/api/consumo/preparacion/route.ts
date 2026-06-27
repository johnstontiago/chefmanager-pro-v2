import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

// Consumo o merma de una preparación: descuenta de un LoteElaboracion concreto
// y registra un ConsumoLoteElaboracion (trazabilidad).
interface Body {
  loteElaboracionId: number;
  cantidad: number;
  motivo: "CONSUMO" | "MERMA";
  notas?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const tenantId = getActiveTenantId(session.user as any);

    const { loteElaboracionId, cantidad, motivo, notas } = (await req.json()) as Body;

    if (!loteElaboracionId || !cantidad || cantidad <= 0) {
      return NextResponse.json({ error: "Faltan loteElaboracionId o cantidad válida" }, { status: 400 });
    }
    if (motivo === "MERMA" && !notas?.trim()) {
      return NextResponse.json({ error: "Las mermas requieren una nota" }, { status: 400 });
    }

    const lote = await prisma.loteElaboracion.findFirst({
      where: { id: loteElaboracionId, tenantId },
    });
    if (!lote) return NextResponse.json({ error: "Lote de preparación no encontrado" }, { status: 404 });
    if (cantidad > lote.cantidadActual) {
      return NextResponse.json({ error: "Cantidad mayor al stock disponible" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const nueva = lote.cantidadActual - cantidad;
      await tx.loteElaboracion.update({
        where: { id: lote.id },
        data: { cantidadActual: nueva, agotado: nueva <= 0 },
      });
      await tx.consumoLoteElaboracion.create({
        data: {
          tenantId,
          loteElaboracionId: lote.id,
          cantidad,
          motivo,
          referenciaId: notas ? `nota:${notas.slice(0, 80)}` : null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/consumo/preparacion]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

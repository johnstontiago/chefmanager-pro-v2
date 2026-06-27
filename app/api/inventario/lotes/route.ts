import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { getActiveTenantId } from "@/lib/get-active-tenant";
import { convertir } from "@/lib/stock/convertir";

export const dynamic = "force-dynamic";

// Stock real del inventario basado en LoteInventario (el sistema único).
// Devuelve cada lote activo en forma compatible con la página de inventario,
// más el valor total calculado con conversión de unidades correcta.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const tenantId = getActiveTenantId(session.user as any);

    const lotes = await prisma.loteInventario.findMany({
      where: { tenantId, agotado: false, cantidadActual: { gt: 0 } },
      orderBy: [{ fechaCaducidad: "asc" }, { fechaEntrada: "asc" }],
      include: {
        producto: {
          include: {
            categoria: { select: { id: true, nombre: true } },
            proveedor: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    let valorTotal = 0;

    const inventario = lotes.map((l) => {
      const p = l.producto;
      const unidadBase = p.unidadBase ?? p.contenidoUnidad ?? p.unidadMedida;
      // valor del lote: convertir la cantidad (en unidad base) a la unidad de
      // compra del producto y multiplicar por su precio unitario.
      const cantidadEnUnidadCompra = convertir(l.cantidadActual, unidadBase, p.unidadMedida);
      valorTotal += cantidadEnUnidadCompra * toNumber(p.precioUnitario);

      return {
        id: l.id,
        productoId: l.productoId,
        cantidad: l.cantidadActual,
        lote: l.numeroLote,
        pesoRealKg: l.pesoRealKg,
        ubicacion: l.ubicacion,
        codigoUnico: l.codigoUnico,
        fechaCaducidad: l.fechaCaducidad,
        producto: {
          ...p,
          precioUnitario: toNumber(p.precioUnitario),
          stockMinimo: toNumber(p.stockMinimo),
        },
      };
    });

    return NextResponse.json({ inventario, valorTotal });
  } catch (error) {
    console.error("[GET /api/inventario/lotes]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

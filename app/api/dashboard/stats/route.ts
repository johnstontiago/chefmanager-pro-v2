import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { contenidoDeProducto } from "@/lib/fichas/costing";

import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const unidadId = getActiveUnidadId(user);
    const tenantId = getActiveTenantId(user);

    if (!unidadId) {
      return NextResponse.json({ error: "Usuario sin unidad asignada" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const productos = await prisma.producto.findMany({
      where: { activo: true, tenantId },
    });
    const productoById = new Map(productos.map((p) => [p.id, p]));

    // Stock real desde LoteInventario (registro único, nivel tenant)
    const lotes = await prisma.loteInventario.findMany({
      where: { tenantId, agotado: false, cantidadActual: { gt: 0 } },
    });

    const stockPorProducto = new Map<number, number>();
    let valorInventario = 0;
    for (const lote of lotes) {
      const current = stockPorProducto.get(lote.productoId) || 0;
      stockPorProducto.set(lote.productoId, current + lote.cantidadActual);

      const prod = productoById.get(lote.productoId);
      if (prod) {
        // precioUnitario es el precio de 1 unidad de compra (ej. una bolsa de
        // 25 kg); factor indica cuántas unidades base (g/ml) trae esa unidad
        // de compra. cantidadActual ya está en unidad base, así que el precio
        // por unidad base es precioUnitario / factor (mismo patrón que
        // baseValue() en lib/fichas/costing.ts).
        const { factor } = contenidoDeProducto(prod);
        const precioPorUnidadBase = toNumber(prod.precioUnitario) / factor;
        valorInventario += lote.cantidadActual * precioPorUnidadBase;
      }
    }

    let stockBajo = 0;
    for (const prod of productos) {
      const totalStock = stockPorProducto.get(prod.id) || 0;
      if (totalStock < toNumber(prod.stockMinimo)) {
        stockBajo++;
      }
    }

    const proximosACaducar = await prisma.loteInventario.count({
      where: {
        tenantId,
        agotado: false,
        fechaCaducidad: {
          gte: today,
          lte: in7Days,
        },
      },
    });

    const pedidosPendientes = await prisma.pedido.count({
      where: {
        unidadId,
        tenantId,
        estado: { in: ["borrador", "enviado"] },
      },
    });

    const ultimosMovimientos = await prisma.movimiento.findMany({
      where: { unidadId, tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        producto: true,
        usuario: { select: { nombre: true } },
      },
    });

    const movimientosFormateados = ultimosMovimientos.map((m: any) => ({
      id: m.id,
      productoNombre: m.producto.nombre,
      tipo: m.tipo,
      cantidad: toNumber(m.cantidad),
      unidadMedida: m.producto.unidadMedida,
      usuario: m.usuario?.nombre || "Sistema",
      fecha: m.createdAt.toISOString(),
      lote: m.lote,
      notas: m.notas,
    }));

    const pedidosParaRecibir = await prisma.pedido.count({
      where: {
        unidadId,
        tenantId,
        estado: "enviado",
      },
    });

    return NextResponse.json({
      stockBajo,
      proximosACaducar,
      pedidosPendientes,
      pedidosParaRecibir,
      valorInventario,
      totalProductos: productos.length,
      ultimosMovimientos: movimientosFormateados,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

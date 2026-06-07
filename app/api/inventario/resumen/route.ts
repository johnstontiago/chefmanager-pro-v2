import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const tenantId = getActiveTenantId(user);
    const { searchParams } = new URL(request.url);
    const unidadId = searchParams.get("unidadId") || getActiveUnidadId(user);

    if (!unidadId) {
      return NextResponse.json({ error: "unidadId requerido" }, { status: 400 });
    }

    const parsedUnidadId = parseInt(String(unidadId));

    const productos = await prisma.producto.findMany({
      where: { activo: true, tenantId },
      include: {
        categoria: true,
        proveedor: true,
      },
    });

    const inventario = await prisma.inventario.findMany({
      where: {
        unidadId: parsedUnidadId,
        tenantId,
        estado: "disponible",
      },
    });

    // Agrupar inventario por producto
    const inventarioPorProducto = new Map<number, typeof inventario>();
    for (const inv of inventario) {
      const list = inventarioPorProducto.get(inv.productoId) || [];
      list.push(inv);
      inventarioPorProducto.set(inv.productoId, list);
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);

    let totalProductos = productos.length;
    let stockBajo = 0;
    let proximosCaducar = 0;
    let valorTotal = 0;

    const resumenProductos = productos.map((p: any) => {
      const productInventario = inventarioPorProducto.get(p.id) || [];
      const cantidadTotal = productInventario.reduce(
        (sum: number, inv: any) => sum + toNumber(inv.cantidad),
        0
      );
      const stockMinimo = toNumber(p.stockMinimo);
      const precioUnitario = toNumber(p.precioUnitario);

      if (cantidadTotal < stockMinimo) {
        stockBajo++;
      }

      const lotesCaducar = productInventario.filter((inv: any) => {
        if (!inv.fechaCaducidad) return false;
        const fecha = new Date(inv.fechaCaducidad);
        return fecha <= en7Dias && fecha >= hoy;
      });

      if (lotesCaducar.length > 0) {
        proximosCaducar++;
      }

      valorTotal += cantidadTotal * precioUnitario;

      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria?.nombre || "Sin categoría",
        proveedor: p.proveedor?.nombre || "Sin proveedor",
        unidadMedida: p.unidadMedida,
        cantidadTotal,
        stockMinimo,
        precioUnitario,
        valorStock: cantidadTotal * precioUnitario,
        estadoStock: cantidadTotal < stockMinimo ? "bajo" : "normal",
        proximoCaducar: lotesCaducar.length > 0,
        lotes: productInventario.map((inv: any) => ({
          id: inv.id,
          cantidad: toNumber(inv.cantidad),
          lote: inv.lote,
          fechaCaducidad: inv.fechaCaducidad,
          ubicacion: inv.ubicacion,
          codigoUnico: inv.codigoUnico,
        })),
      };
    });

    // Get pending orders count
    const pedidosPendientes = await prisma.pedido.count({
      where: {
        unidadId: parsedUnidadId,
        tenantId,
        estado: "enviado",
      },
    });

    return NextResponse.json({
      estadisticas: {
        totalProductos,
        stockBajo,
        proximosCaducar,
        valorTotal,
        pedidosPendientes,
      },
      productos: resumenProductos,
    });
  } catch (error) {
    console.error("Error fetching resumen inventario:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de inventario" },
      { status: 500 }
    );
  }
}

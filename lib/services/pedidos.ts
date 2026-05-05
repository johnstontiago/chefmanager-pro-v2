import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { Decimal } from "@prisma/client/runtime/library";

export async function getPedidosPorUnidad(unidadId: number) {
  const pedidos = await prisma.pedido.findMany({
    where: { unidadId },
    orderBy: { createdAt: "desc" },
    include: {
      proveedor: { select: { id: true, nombre: true } },
      items: {
        include: {
          producto: {
            include: {
              categoria: { select: { id: true, nombre: true } },
              proveedor: { select: { id: true, nombre: true } },
            },
          },
        },
      },
    },
  });

  return pedidos.map((p) => ({
    ...p,
    total: toNumber(p.total),
    items: p.items.map((i) => ({
      ...i,
      cantidad: toNumber(i.cantidad),
      cantidadRecibida: toNumber(i.cantidadRecibida),
      precioUnitario: toNumber(i.precioUnitario),
      producto: {
        ...i.producto,
        precioUnitario: toNumber(i.producto.precioUnitario),
        stockMinimo: toNumber(i.producto.stockMinimo),
      },
    })),
  }));
}

export async function crearPedidoComplementario(
  pedidoPadreId: number,
  itemsFaltantes: Array<{ productoId: number; cantidad: number; precioUnitario: number }>,
  unidadId: number,
  usuarioId: number,
  proveedorId?: number | null
) {
  const total = itemsFaltantes.reduce(
    (acc, i) => acc + i.cantidad * i.precioUnitario,
    0
  );

  return prisma.pedido.create({
    data: {
      unidadId,
      usuarioId,
      proveedorId: proveedorId ?? null,
      parentPedidoId: pedidoPadreId,
      estado: "pendiente",
      total: new Decimal(total),
      notas: `Pedido complementario del pedido #${pedidoPadreId}`,
      items: {
        create: itemsFaltantes.map((i) => ({
          productoId: i.productoId,
          cantidad: new Decimal(i.cantidad),
          precioUnitario: new Decimal(i.precioUnitario),
        })),
      },
    },
  });
}

export async function calcularStockProducto(productoId: number, unidadId: number) {
  const inventario = await prisma.inventario.aggregate({
    where: { productoId, unidadId, estado: "disponible" },
    _sum: { cantidad: true },
  });
  return toNumber(inventario._sum.cantidad ?? 0);
}

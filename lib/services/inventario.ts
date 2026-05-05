import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";

export async function getProductosBajoMinimo(unidadId: number) {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: {
      categoria: { select: { id: true, nombre: true } },
      inventario: {
        where: { unidadId, estado: "disponible" },
        select: { cantidad: true },
      },
    },
  });

  return productos
    .map((p) => {
      const stockActual = p.inventario.reduce(
        (acc, i) => acc + toNumber(i.cantidad),
        0
      );
      return {
        ...p,
        precioUnitario: toNumber(p.precioUnitario),
        stockMinimo: toNumber(p.stockMinimo),
        stockActual,
        bajoMinimo: stockActual < toNumber(p.stockMinimo),
      };
    })
    .filter((p) => p.bajoMinimo);
}

export async function getResumenInventario(unidadId: number) {
  const [totalItems, itemsBajoMinimo, proximosCaducar] = await Promise.all([
    prisma.inventario.count({ where: { unidadId, estado: "disponible" } }),
    getProductosBajoMinimo(unidadId).then((p) => p.length),
    prisma.inventario.count({
      where: {
        unidadId,
        estado: "disponible",
        fechaCaducidad: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
    }),
  ]);

  return { totalItems, itemsBajoMinimo, proximosCaducar };
}

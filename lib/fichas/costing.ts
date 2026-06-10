import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";

// Costeo en vivo del módulo de fichas técnicas.
//
// El valor por unidad de un insumo se deriva según su origen:
//   - productoId    → Producto.precioUnitario (precio actual del inventario)
//   - preparacionId → costo por porción de la preparación, recalculado en vivo
//   - manual        → valorPorUnidad almacenado en el propio insumo
//
// Las preparaciones solo contienen insumos base (producto o manual), nunca
// otras preparaciones, por lo que el cálculo no es recursivo.

interface InsumoBase {
  id: number;
  valorPorUnidad: number;
  esPreparacion: boolean;
  preparacionId: number | null;
  productoId: number | null;
  producto: { precioUnitario: unknown } | null;
}

export interface LiveCostMaps {
  insumoValue: Map<number, number>;
  prepCosts: Map<number, { costoTotal: number; costoPorPorcion: number }>;
}

function baseValue(insumo: InsumoBase): number {
  if (insumo.producto) return toNumber(insumo.producto.precioUnitario as any);
  return insumo.valorPorUnidad;
}

/**
 * Construye los mapas de valores en vivo para todos los insumos y
 * preparaciones de un tenant. Dos consultas planas, sin recursión.
 */
export async function getLiveCostMaps(tenantId: number): Promise<LiveCostMaps> {
  const [insumos, preparaciones] = await Promise.all([
    prisma.insumo.findMany({
      where: { tenantId },
      select: {
        id: true,
        valorPorUnidad: true,
        esPreparacion: true,
        preparacionId: true,
        productoId: true,
        producto: { select: { precioUnitario: true } },
      },
    }),
    prisma.preparacion.findMany({
      where: { tenantId },
      select: {
        id: true,
        porciones: true,
        ingredientes: { select: { insumoId: true, cantidad: true } },
      },
    }),
  ]);

  const insumoValue = new Map<number, number>();
  for (const insumo of insumos) {
    if (!insumo.esPreparacion) {
      insumoValue.set(insumo.id, baseValue(insumo));
    }
  }

  const prepCosts = new Map<number, { costoTotal: number; costoPorPorcion: number }>();
  for (const prep of preparaciones) {
    const costoTotal = prep.ingredientes.reduce(
      (acc, ing) => acc + (insumoValue.get(ing.insumoId) ?? 0) * ing.cantidad,
      0
    );
    const costoPorPorcion = costoTotal / (prep.porciones || 1);
    prepCosts.set(prep.id, { costoTotal, costoPorPorcion });
  }

  // Insumos generados por preparaciones: su valor es el costo/porción en vivo
  for (const insumo of insumos) {
    if (insumo.esPreparacion && insumo.preparacionId != null) {
      const prep = prepCosts.get(insumo.preparacionId);
      insumoValue.set(insumo.id, prep ? prep.costoPorPorcion : insumo.valorPorUnidad);
    }
  }

  return { insumoValue, prepCosts };
}

/** Reemplaza el valorPorUnidad almacenado por el valor en vivo. */
export function decorateInsumo<T extends { id: number; valorPorUnidad: number }>(
  insumo: T,
  maps: LiveCostMaps
): T {
  return { ...insumo, valorPorUnidad: maps.insumoValue.get(insumo.id) ?? insumo.valorPorUnidad };
}

/** Recalcula costos de una preparación y de sus líneas con valores en vivo. */
export function decoratePreparacion<
  T extends {
    id: number;
    ingredientes: Array<{ insumo: { id: number; valorPorUnidad: number } }>;
  } & { costoTotal: number; costoPorPorcion: number }
>(prep: T, maps: LiveCostMaps): T {
  const live = maps.prepCosts.get(prep.id);
  return {
    ...prep,
    costoTotal: live ? live.costoTotal : prep.costoTotal,
    costoPorPorcion: live ? live.costoPorPorcion : prep.costoPorPorcion,
    ingredientes: prep.ingredientes.map((ing) => ({
      ...ing,
      insumo: decorateInsumo(ing.insumo, maps),
    })),
  };
}

/** Recalcula costos de una ficha técnica y de sus líneas con valores en vivo. */
export function decorateFicha<
  T extends {
    porciones: number;
    costoTotal: number;
    costoPorPorcion: number;
    ingredientes: Array<{
      cantidad: number;
      costoCalculado: number;
      insumo: { id: number; valorPorUnidad: number };
    }>;
  }
>(ficha: T, maps: LiveCostMaps): T {
  const ingredientes = ficha.ingredientes.map((ing) => {
    const valor = maps.insumoValue.get(ing.insumo.id) ?? ing.insumo.valorPorUnidad;
    return {
      ...ing,
      costoCalculado: valor * ing.cantidad,
      insumo: { ...ing.insumo, valorPorUnidad: valor },
    };
  });
  const costoTotal = ingredientes.reduce((acc, ing) => acc + ing.costoCalculado, 0);
  return {
    ...ficha,
    ingredientes,
    costoTotal,
    costoPorPorcion: costoTotal / (ficha.porciones || 1),
  };
}

/**
 * Sincroniza el catálogo de productos del tenant como insumos.
 * Crea insumos para productos activos que aún no lo tienen y refresca
 * nombre/unidad si cambiaron en el inventario. Operación aditiva.
 */
export async function syncProductosAsInsumos(tenantId: number): Promise<void> {
  const [productos, existentes] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId, activo: true },
      select: { id: true, nombre: true, unidadMedida: true },
    }),
    prisma.insumo.findMany({
      where: { tenantId, productoId: { not: null } },
      select: { id: true, productoId: true, nombre: true, unidad: true },
    }),
  ]);

  const porProducto = new Map(existentes.map((i) => [i.productoId as number, i]));

  const nuevos = productos
    .filter((p) => !porProducto.has(p.id))
    .map((p) => ({
      nombre: p.nombre,
      unidad: p.unidadMedida,
      productoId: p.id,
      tenantId,
    }));

  if (nuevos.length > 0) {
    await prisma.insumo.createMany({ data: nuevos, skipDuplicates: true });
  }

  const desactualizados = productos.filter((p) => {
    const insumo = porProducto.get(p.id);
    return insumo && (insumo.nombre !== p.nombre || insumo.unidad !== p.unidadMedida);
  });

  for (const p of desactualizados) {
    const insumo = porProducto.get(p.id)!;
    await prisma.insumo.update({
      where: { id: insumo.id },
      data: { nombre: p.nombre, unidad: p.unidadMedida },
    });
  }
}

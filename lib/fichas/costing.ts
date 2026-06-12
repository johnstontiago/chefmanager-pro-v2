import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";

// Costeo en vivo del módulo de fichas técnicas.
//
// El valor por unidad de un insumo se deriva según su origen:
//   - productoId    → Producto.precioUnitario (precio actual del inventario)
//   - preparacionId → costo por porción de la preparación, recalculado en vivo
//   - manual        → valorPorUnidad almacenado en el propio insumo
//
// Las preparaciones pueden contener otras preparaciones como ingrediente
// (ej: masa de pizza hecha con biga). El cálculo es recursivo con
// memoización; los ciclos se rechazan al escribir (wouldCreateCycle) y,
// como defensa adicional, se cortan en lectura valorándolos en 0.

interface ProductoCosteable {
  unidadMedida: string;
  contenidoNeto: unknown | null;
  contenidoUnidad: string | null;
}

interface InsumoBase {
  id: number;
  valorPorUnidad: number;
  esPreparacion: boolean;
  preparacionId: number | null;
  productoId: number | null;
  producto: (ProductoCosteable & { precioUnitario: unknown }) | null;
}

export interface LiveCostMaps {
  insumoValue: Map<number, number>;
  prepCosts: Map<number, { costoTotal: number; costoPorPorcion: number }>;
}

/**
 * En cocina se trabaja en g y ml aunque se compre en kg, l o envases.
 * Convierte la unidad de compra del producto a unidad de receta:
 *   kg → g (÷1000)            l → ml (÷1000)
 *   "Bolsa 25Kg" → g (÷25000) "Botella 33Cl" → ml (÷330)
 *   "Caja 12Un" → un (÷12)
 * Cualquier envase con contenido declarado ("<algo> <número><kg|g|l|cl|ml|un>")
 * se convierte; el resto (un, caja...) queda igual.
 */
export function unidadDeReceta(unidadMedida: string): { unidad: string; factor: number } {
  const u = unidadMedida.trim().toLowerCase().replace(/\s+/g, " ");

  // Envases con contenido: "bolsa 25kg", "botella 33cl", "caja 12un"...
  const envase = u.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml|un|ud|uds|unidades)$/);
  if (envase) {
    const cantidad = parseFloat(envase[1].replace(",", "."));
    if (cantidad > 0) {
      switch (envase[2]) {
        case "kg":
          return { unidad: "g", factor: cantidad * 1000 };
        case "g":
          return { unidad: "g", factor: cantidad };
        case "l":
          return { unidad: "ml", factor: cantidad * 1000 };
        case "cl":
          return { unidad: "ml", factor: cantidad * 10 };
        case "ml":
          return { unidad: "ml", factor: cantidad };
        default:
          // un / ud / uds / unidades: envases por conteo
          return { unidad: "un", factor: cantidad };
      }
    }
  }

  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(u)) {
    return { unidad: "g", factor: 1000 };
  }
  if (["l", "lt", "litro", "litros"].includes(u)) {
    return { unidad: "ml", factor: 1000 };
  }
  return { unidad: unidadMedida, factor: 1 };
}

/**
 * Unidad mínima y contenido de un producto para costear en recetas.
 * Prioridad: contenido neto declarado en el producto (ej: lata de 3600 g,
 * paquete de 50 g, caja de 12 un); si no existe, se infiere del nombre
 * de la unidad de medida ("bolsa 25kg" → 25000 g).
 */
export function contenidoDeProducto(producto: ProductoCosteable): {
  unidad: string;
  factor: number;
} {
  const neto = toNumber(producto.contenidoNeto as any);
  if (neto > 0 && producto.contenidoUnidad) {
    return { unidad: producto.contenidoUnidad, factor: neto };
  }
  return unidadDeReceta(producto.unidadMedida);
}

function baseValue(insumo: InsumoBase): number {
  if (insumo.producto) {
    const { factor } = contenidoDeProducto(insumo.producto);
    return toNumber(insumo.producto.precioUnitario as any) / factor;
  }
  return insumo.valorPorUnidad;
}

/**
 * Construye los mapas de valores en vivo para todos los insumos y
 * preparaciones de un tenant. Dos consultas planas; la resolución de
 * preparaciones anidadas es recursiva con memoización y corte de ciclos.
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
        producto: {
          select: {
            precioUnitario: true,
            unidadMedida: true,
            contenidoNeto: true,
            contenidoUnidad: true,
          },
        },
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

  const insumoById = new Map(insumos.map((i) => [i.id, i]));
  const prepById = new Map(preparaciones.map((p) => [p.id, p]));

  const insumoValue = new Map<number, number>();
  const prepCosts = new Map<number, { costoTotal: number; costoPorPorcion: number }>();

  function resolveInsumo(insumoId: number, visiting: Set<number>): number {
    const memo = insumoValue.get(insumoId);
    if (memo !== undefined) return memo;
    const insumo = insumoById.get(insumoId);
    if (!insumo) return 0;

    let valor: number;
    if (insumo.esPreparacion && insumo.preparacionId != null) {
      valor = resolvePrep(insumo.preparacionId, visiting).costoPorPorcion;
    } else {
      valor = baseValue(insumo);
    }
    insumoValue.set(insumoId, valor);
    return valor;
  }

  function resolvePrep(
    prepId: number,
    visiting: Set<number>
  ): { costoTotal: number; costoPorPorcion: number } {
    const memo = prepCosts.get(prepId);
    if (memo !== undefined) return memo;
    const prep = prepById.get(prepId);
    // Ciclo o preparación inexistente: corta valorando en 0
    if (!prep || visiting.has(prepId)) {
      return { costoTotal: 0, costoPorPorcion: 0 };
    }

    visiting.add(prepId);
    const costoTotal = prep.ingredientes.reduce(
      (acc, ing) => acc + resolveInsumo(ing.insumoId, visiting) * ing.cantidad,
      0
    );
    visiting.delete(prepId);

    const result = { costoTotal, costoPorPorcion: costoTotal / (prep.porciones || 1) };
    prepCosts.set(prepId, result);
    return result;
  }

  for (const prep of preparaciones) resolvePrep(prep.id, new Set());
  for (const insumo of insumos) resolveInsumo(insumo.id, new Set());

  return { insumoValue, prepCosts };
}

/**
 * Verifica si guardar `insumoIds` como ingredientes de la preparación
 * `prepId` crearía un ciclo (una preparación que, directa o
 * transitivamente, se contiene a sí misma).
 */
export async function wouldCreateCycle(
  tenantId: number,
  prepId: number,
  insumoIds: number[]
): Promise<boolean> {
  const [insumos, preparaciones] = await Promise.all([
    prisma.insumo.findMany({
      where: { tenantId, esPreparacion: true },
      select: { id: true, preparacionId: true },
    }),
    prisma.preparacion.findMany({
      where: { tenantId },
      select: { id: true, ingredientes: { select: { insumoId: true } } },
    }),
  ]);

  const prepDeInsumo = new Map<number, number>();
  for (const insumo of insumos) {
    if (insumo.preparacionId != null) prepDeInsumo.set(insumo.id, insumo.preparacionId);
  }

  // Grafo: preparación → preparaciones que usa como ingrediente
  const deps = new Map<number, number[]>();
  for (const prep of preparaciones) {
    deps.set(
      prep.id,
      prep.ingredientes
        .map((ing) => prepDeInsumo.get(ing.insumoId))
        .filter((id): id is number => id !== undefined)
    );
  }

  // ¿Alguna preparación seleccionada alcanza a prepId siguiendo sus deps?
  const inicio = insumoIds
    .map((id) => prepDeInsumo.get(id))
    .filter((id): id is number => id !== undefined);

  const stack = [...inicio];
  const visitados = new Set<number>();
  while (stack.length > 0) {
    const actual = stack.pop()!;
    if (actual === prepId) return true;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    stack.push(...(deps.get(actual) || []));
  }
  return false;
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
      select: {
        id: true,
        nombre: true,
        unidadMedida: true,
        contenidoNeto: true,
        contenidoUnidad: true,
      },
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
      unidad: contenidoDeProducto(p).unidad,
      productoId: p.id,
      tenantId,
    }));

  if (nuevos.length > 0) {
    await prisma.insumo.createMany({ data: nuevos, skipDuplicates: true });
  }

  const desactualizados = productos.filter((p) => {
    const insumo = porProducto.get(p.id);
    if (!insumo) return false;
    const { unidad } = contenidoDeProducto(p);
    return insumo.nombre !== p.nombre || insumo.unidad !== unidad;
  });

  for (const p of desactualizados) {
    const insumo = porProducto.get(p.id)!;
    await prisma.insumo.update({
      where: { id: insumo.id },
      data: { nombre: p.nombre, unidad: contenidoDeProducto(p).unidad },
    });
  }
}

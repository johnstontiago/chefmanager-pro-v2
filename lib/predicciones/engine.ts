import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";

// Motor de sugerencias de pedido semanal.
//
// Para cada producto combina dos señales históricas (últimas 12 semanas):
//   1. Consumo real (movimientos tipo consumo + merma) — señal preferida
//   2. Ritmo de compra (líneas de pedidos no cancelados) — fallback cuando
//      el equipo aún no registra consumos de ese producto
//
// Pronóstico: media ponderada exponencial (las semanas recientes pesan más).
// Sugerencia = pronóstico × factorFestivo + colchón de seguridad − stock,
// redondeada hacia arriba a unidades de compra enteras.

const SEMANAS_HISTORICO = 12;
const MIN_SEMANAS_CONSUMO = 2; // semanas con consumo registrado para preferir esa señal
const ALPHA = 0.5; // peso EWMA hacia lo reciente
const COLCHON = 0.2; // 20% del pronóstico como stock de seguridad
const MS_SEMANA = 7 * 24 * 60 * 60 * 1000;

export interface SugerenciaLinea {
  productoId: number;
  nombre: string;
  unidadMedida: string;
  precioUnitario: number;
  consumoSemanalPrevisto: number;
  stockDisponible: number;
  colchonSeguridad: number;
  cantidadSugerida: number;
  fuente: "consumo" | "compras";
  semanasConDatos: number;
}

export interface FestivoProximo {
  fecha: string;
  nombre: string;
  factor: number;
}

export interface ResultadoSugerencias {
  lineas: SugerenciaLinea[];
  festivos: FestivoProximo[];
  factorFestivo: number;
  desde: string;
  hasta: string;
}

/** Media ponderada exponencial sobre cubos semanales (índice 0 = semana actual). */
function ewma(porSemana: Map<number, number>, semanas: number): number {
  let suma = 0;
  let pesoTotal = 0;
  for (let s = 0; s < semanas; s++) {
    const peso = Math.pow(1 - ALPHA, s);
    suma += (porSemana.get(s) ?? 0) * peso;
    pesoTotal += peso;
  }
  return pesoTotal > 0 ? suma / pesoTotal : 0;
}

function indiceSemana(fecha: Date, ahora: number): number {
  return Math.floor((ahora - fecha.getTime()) / MS_SEMANA);
}

export async function getSugerenciasPedido(
  tenantId: number,
  unidadId: number
): Promise<ResultadoSugerencias> {
  const ahora = Date.now();
  const desde = new Date(ahora - SEMANAS_HISTORICO * MS_SEMANA);
  const finSemanaProxima = new Date(ahora + MS_SEMANA);

  const [productos, movimientos, pedidoItems, inventario, festivos] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId, activo: true },
      select: { id: true, nombre: true, unidadMedida: true, precioUnitario: true, stockMinimo: true },
    }),
    prisma.movimiento.findMany({
      where: {
        tenantId,
        unidadId,
        tipo: { in: ["consumo", "merma"] },
        fecha: { gte: desde },
      },
      select: { productoId: true, cantidad: true, fecha: true },
    }),
    prisma.pedidoItem.findMany({
      where: {
        pedido: {
          tenantId,
          unidadId,
          estado: { notIn: ["cancelado", "borrador"] },
          fechaPedido: { gte: desde },
        },
      },
      select: { productoId: true, cantidad: true, pedido: { select: { fechaPedido: true } } },
    }),
    prisma.inventario.findMany({
      where: { tenantId, unidadId, estado: "disponible" },
      select: { productoId: true, cantidad: true },
    }),
    prisma.festivo.findMany({
      where: { tenantId, fecha: { gte: new Date(ahora), lte: finSemanaProxima } },
      orderBy: { fecha: "asc" },
    }),
  ]);

  // Cubos semanales por producto
  const consumoPorProducto = new Map<number, Map<number, number>>();
  for (const mov of movimientos) {
    const s = indiceSemana(mov.fecha, ahora);
    const cubos = consumoPorProducto.get(mov.productoId) ?? new Map();
    cubos.set(s, (cubos.get(s) ?? 0) + toNumber(mov.cantidad));
    consumoPorProducto.set(mov.productoId, cubos);
  }

  const comprasPorProducto = new Map<number, Map<number, number>>();
  for (const item of pedidoItems) {
    const s = indiceSemana(item.pedido.fechaPedido, ahora);
    const cubos = comprasPorProducto.get(item.productoId) ?? new Map();
    cubos.set(s, (cubos.get(s) ?? 0) + toNumber(item.cantidad));
    comprasPorProducto.set(item.productoId, cubos);
  }

  const stockPorProducto = new Map<number, number>();
  for (const inv of inventario) {
    stockPorProducto.set(
      inv.productoId,
      (stockPorProducto.get(inv.productoId) ?? 0) + toNumber(inv.cantidad)
    );
  }

  // Factor festivo: el mayor de los festivos de la próxima semana
  const factorFestivo = festivos.reduce((max, f) => Math.max(max, f.factor), 1);

  const lineas: SugerenciaLinea[] = [];
  for (const producto of productos) {
    const consumo = consumoPorProducto.get(producto.id);
    const compras = comprasPorProducto.get(producto.id);
    const semanasConsumo = consumo?.size ?? 0;
    const semanasCompras = compras?.size ?? 0;

    let fuente: "consumo" | "compras";
    let cubos: Map<number, number> | undefined;
    if (semanasConsumo >= MIN_SEMANAS_CONSUMO) {
      fuente = "consumo";
      cubos = consumo;
    } else if (semanasCompras > 0) {
      fuente = "compras";
      cubos = compras;
    } else {
      continue; // sin historial: nada que sugerir
    }

    const previsto = ewma(cubos!, SEMANAS_HISTORICO);
    if (previsto <= 0) continue;

    const stock = stockPorProducto.get(producto.id) ?? 0;
    const stockMinimo = toNumber(producto.stockMinimo);
    const colchon = Math.max(previsto * COLCHON, stockMinimo);
    const necesidad = previsto * factorFestivo + colchon - stock;
    const cantidadSugerida = Math.ceil(Math.max(0, necesidad));
    if (cantidadSugerida <= 0) continue;

    lineas.push({
      productoId: producto.id,
      nombre: producto.nombre,
      unidadMedida: producto.unidadMedida,
      precioUnitario: toNumber(producto.precioUnitario),
      consumoSemanalPrevisto: Math.round(previsto * 100) / 100,
      stockDisponible: stock,
      colchonSeguridad: Math.round(colchon * 100) / 100,
      cantidadSugerida,
      fuente,
      semanasConDatos: fuente === "consumo" ? semanasConsumo : semanasCompras,
    });
  }

  lineas.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    lineas,
    festivos: festivos.map((f) => ({
      fecha: f.fecha.toISOString().slice(0, 10),
      nombre: f.nombre,
      factor: f.factor,
    })),
    factorFestivo,
    desde: desde.toISOString().slice(0, 10),
    hasta: finSemanaProxima.toISOString().slice(0, 10),
  };
}

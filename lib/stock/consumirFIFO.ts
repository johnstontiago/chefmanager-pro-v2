import prisma from '@/lib/db'
import type { PrismaClient } from '@prisma/client'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface ConsumoInput {
  tenantId: number
  productoId: number
  cantidadNecesaria: number
  motivo: string
  referenciaId?: string
}

export interface LoteAfectado {
  loteId: number
  cantidadDescontada: number
}

export interface ResultadoConsumo {
  ok: boolean
  consumido: number
  stockInsuficiente: boolean
  lotesAfectados: LoteAfectado[]
  error?: string
}

async function ejecutarConsumo(
  input: ConsumoInput,
  client: TxClient
): Promise<ResultadoConsumo> {
  const { tenantId, productoId, cantidadNecesaria, motivo, referenciaId } = input

  const lotes = await client.loteInventario.findMany({
    where: { tenantId, productoId, agotado: false, cantidadActual: { gt: 0 } },
    orderBy: { fechaEntrada: 'asc' },
  })

  let pendiente = cantidadNecesaria
  const lotesAfectados: LoteAfectado[] = []

  for (const lote of lotes) {
    if (pendiente <= 0) break

    const aDescontar = Math.min(lote.cantidadActual, pendiente)
    const nuevaCantidad = lote.cantidadActual - aDescontar

    await client.loteInventario.update({
      where: { id: lote.id },
      data: { cantidadActual: nuevaCantidad, agotado: nuevaCantidad <= 0 },
    })

    await client.consumoLote.create({
      data: { tenantId, loteId: lote.id, cantidad: aDescontar, motivo, referenciaId },
    })

    lotesAfectados.push({ loteId: lote.id, cantidadDescontada: aDescontar })
    pendiente -= aDescontar
  }

  const consumido = cantidadNecesaria - pendiente
  const stockInsuficiente = pendiente > 0

  return {
    ok: !stockInsuficiente,
    consumido,
    stockInsuficiente,
    lotesAfectados,
    error: stockInsuficiente
      ? `Stock insuficiente: faltan ${pendiente.toFixed(3)} unidades del producto ${productoId}`
      : undefined,
  }
}

export async function consumirFIFO(
  input: ConsumoInput,
  tx?: TxClient
): Promise<ResultadoConsumo> {
  if (tx) return ejecutarConsumo(input, tx)
  return prisma.$transaction((client) => ejecutarConsumo(input, client))
}

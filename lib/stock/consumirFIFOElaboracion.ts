import prisma from '@/lib/db'

interface ConsumoElaboracionInput {
  tenantId: number
  elaboracionId: number
  cantidadNecesaria: number
  motivo: string
  referenciaId?: string
}

export interface ResultadoConsumoElaboracion {
  ok: boolean
  consumido: number
  stockInsuficiente: boolean
  lotesAfectados: { loteId: number; cantidadDescontada: number }[]
  error?: string
}

export async function consumirFIFOElaboracion(
  input: ConsumoElaboracionInput
): Promise<ResultadoConsumoElaboracion> {
  const { tenantId, elaboracionId, cantidadNecesaria, motivo, referenciaId } = input

  return prisma.$transaction(async (tx) => {
    const lotes = await tx.loteElaboracion.findMany({
      where: { tenantId, elaboracionId, agotado: false, cantidadActual: { gt: 0 } },
      orderBy: { fechaProduccion: 'asc' },
    })

    let pendiente = cantidadNecesaria
    const lotesAfectados: { loteId: number; cantidadDescontada: number }[] = []

    for (const lote of lotes) {
      if (pendiente <= 0) break

      const aDescontar = Math.min(lote.cantidadActual, pendiente)
      const nuevaCantidad = lote.cantidadActual - aDescontar

      await tx.loteElaboracion.update({
        where: { id: lote.id },
        data: { cantidadActual: nuevaCantidad, agotado: nuevaCantidad <= 0 },
      })

      await tx.consumoLoteElaboracion.create({
        data: {
          tenantId,
          loteElaboracionId: lote.id,
          cantidad: aDescontar,
          motivo,
          referenciaId,
        },
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
        ? `Stock insuficiente de elaboración ${elaboracionId}: faltan ${pendiente.toFixed(3)} unidades`
        : undefined,
    }
  })
}

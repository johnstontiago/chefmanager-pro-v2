import prisma from '@/lib/db'
import { consumirFIFO } from '@/lib/stock/consumirFIFO'
import { convertir } from '@/lib/stock/convertir'

interface ProduccionInput {
  tenantId: number
  elaboracionId: number
  cantidadProducida: number
  fechaCaducidad?: Date
  notas?: string
}

interface ResultadoProduccion {
  ok: boolean
  loteElaboracionId?: number
  stockInsuficiente: boolean
  ingredientesFallidos: string[]
  error?: string
}

export async function producirElaboracion(
  input: ProduccionInput
): Promise<ResultadoProduccion> {
  const { tenantId, elaboracionId, cantidadProducida, fechaCaducidad, notas } = input

  const elaboracion = await prisma.elaboracion.findFirst({
    where: { id: elaboracionId, tenantId },
    include: {
      ingredientes: {
        include: { producto: true },
      },
    },
  })

  if (!elaboracion) {
    return {
      ok: false,
      stockInsuficiente: false,
      ingredientesFallidos: [],
      error: 'Elaboración no encontrada',
    }
  }

  return prisma.$transaction(async (tx) => {
    const ingredientesFallidos: string[] = []
    const insumosParaRegistrar: { loteInventarioId: number; cantidadUsada: number }[] = []

    for (const ingrediente of elaboracion.ingredientes) {
      const unidadDestino = ingrediente.producto.unidadBase ?? ingrediente.producto.contenidoUnidad ?? ingrediente.producto.unidadMedida
      const cantidadNecesaria = convertir(
        ingrediente.cantidad * cantidadProducida,
        ingrediente.unidad,
        unidadDestino
      )

      const resultado = await consumirFIFO(
        {
          tenantId,
          productoId: ingrediente.productoId,
          cantidadNecesaria,
          motivo: 'PRODUCCION',
          referenciaId: `elaboracion:${elaboracionId}`,
        },
        tx
      )

      if (!resultado.ok) {
        ingredientesFallidos.push(ingrediente.producto.nombre)
      }

      for (const loteAfectado of resultado.lotesAfectados) {
        insumosParaRegistrar.push({
          loteInventarioId: loteAfectado.loteId,
          cantidadUsada: loteAfectado.cantidadDescontada,
        })
      }
    }

    const loteElaboracion = await tx.loteElaboracion.create({
      data: {
        tenantId,
        elaboracionId,
        cantidadInicial: cantidadProducida,
        cantidadActual: cantidadProducida,
        fechaCaducidad,
        notas,
        insumos: {
          create: insumosParaRegistrar.map((i) => ({
            tenantId,
            loteInventarioId: i.loteInventarioId,
            cantidadUsada: i.cantidadUsada,
          })),
        },
      },
    })

    return {
      ok: ingredientesFallidos.length === 0,
      loteElaboracionId: loteElaboracion.id,
      stockInsuficiente: ingredientesFallidos.length > 0,
      ingredientesFallidos,
    }
  })
}

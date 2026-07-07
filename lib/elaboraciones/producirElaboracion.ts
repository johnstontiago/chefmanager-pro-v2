'use server'

import prisma from '@/lib/db'
import { consumirFIFO } from '@/lib/stock/consumirFIFO'
import { consumirFIFOElaboracion } from '@/lib/stock/consumirFIFOElaboracion'
import { convertir } from '@/lib/stock/convertir'
import { convertirHaciaElaboracion } from '@/lib/fichas/costing'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'

interface ProduccionInput {
  elaboracionId: number
  cantidadProducida: number
  fechaCaducidad?: Date
  notas?: string
  numeroLote?: string
  numeroEnvases?: number
  codigoUnico?: string
}

interface ResultadoProduccion {
  ok: boolean
  loteElaboracionId?: number
  numeroLote?: string
  codigoUnico?: string
  stockInsuficiente: boolean
  ingredientesFallidos: string[]
  error?: string
}

export async function producirElaboracion(
  input: ProduccionInput
): Promise<ResultadoProduccion> {
  const { elaboracionId, cantidadProducida, fechaCaducidad, notas, numeroLote, numeroEnvases, codigoUnico } = input

  // tenantId SIEMPRE desde la sesión, nunca del cliente
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, stockInsuficiente: false, ingredientesFallidos: [], error: 'No autenticado' }
  }
  const tenantId = getActiveTenantId(session.user as any)

  const elaboracion = await prisma.elaboracion.findFirst({
    where: { id: elaboracionId, tenantId },
    include: {
      ingredientes: {
        include: {
          producto: true,
          insumo: { include: { producto: true, elaboracion: true } },
        },
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
    const insumosParaRegistrar: {
      loteInventarioId: number
      cantidadUsada: number
      numeroLote: string | null
      codigoUnico: string | null
      productoNombre: string
    }[] = []

    for (const ingrediente of elaboracion.ingredientes) {
      // Filas nuevas resuelven el ingrediente vía insumo (producto, elaboración
      // anidada, preparación o insumo manual como el agua); las filas antiguas
      // sin insumoId aún apuntan directo a un producto.
      const producto = ingrediente.insumo?.producto ?? ingrediente.producto
      const elabAnidada = ingrediente.insumo?.elaboracion ?? null

      if (producto) {
        const unidadDestino = producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida
        const cantidadNecesaria = convertir(ingrediente.cantidad * cantidadProducida, ingrediente.unidad, unidadDestino)

        const resultado = await consumirFIFO(
          {
            tenantId,
            productoId: producto.id,
            cantidadNecesaria,
            motivo: 'PRODUCCION',
            referenciaId: `elaboracion:${elaboracionId}`,
          },
          tx
        )

        if (!resultado.ok) {
          ingredientesFallidos.push(producto.nombre)
        }

        for (const loteAfectado of resultado.lotesAfectados) {
          insumosParaRegistrar.push({
            loteInventarioId: loteAfectado.loteId,
            cantidadUsada: loteAfectado.cantidadDescontada,
            numeroLote: loteAfectado.numeroLote,
            codigoUnico: loteAfectado.codigoUnico,
            productoNombre: producto.nombre,
          })
        }
      } else if (elabAnidada) {
        const cantidadNecesaria = convertirHaciaElaboracion(ingrediente.cantidad * cantidadProducida, ingrediente.unidad, elabAnidada)

        const resultado = await consumirFIFOElaboracion(
          {
            tenantId,
            elaboracionId: elabAnidada.id,
            cantidadNecesaria,
            motivo: 'PRODUCCION',
            referenciaId: `elaboracion:${elaboracionId}`,
          },
          tx
        )

        if (!resultado.ok) {
          ingredientesFallidos.push(elabAnidada.nombre)
        }
      }
      // Insumo manual o respaldado por una preparación: sin lote físico que
      // descontar, solo aporta coste (ya reflejado en el precio de la elaboración).
    }

    // Código único para la etiqueta (si no llega uno, se genera)
    const codigo = codigoUnico || `PREP-${Date.now().toString(36).toUpperCase()}`

    const loteElaboracion = await tx.loteElaboracion.create({
      data: {
        tenantId,
        elaboracionId,
        cantidadInicial: cantidadProducida,
        cantidadActual: cantidadProducida,
        fechaCaducidad,
        notas,
        numeroLote: numeroLote || null,
        numeroEnvases: numeroEnvases || null,
        codigoUnico: codigo,
        insumos: {
          create: insumosParaRegistrar.map((i) => ({
            tenantId,
            loteInventarioId: i.loteInventarioId,
            cantidadUsada: i.cantidadUsada,
            numeroLote: i.numeroLote,
            codigoUnico: i.codigoUnico,
            productoNombre: i.productoNombre,
          })),
        },
      },
    })

    return {
      ok: ingredientesFallidos.length === 0,
      loteElaboracionId: loteElaboracion.id,
      numeroLote: numeroLote || undefined,
      codigoUnico: codigo,
      stockInsuficiente: ingredientesFallidos.length > 0,
      ingredientesFallidos,
    }
  })
}

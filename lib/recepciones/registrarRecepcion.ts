'use server'

import prisma from '@/lib/db'
import { convertir } from '@/lib/stock/convertir'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'

interface PiezaVariable {
  pesoKg: number
}

interface RecepcionInput {
  productoId: number
  fechaCaducidad?: Date
  numeroLote?: string
  // Productos FIJO:
  cantidadUnidades?: number
  varianteProveedorId?: number
  nuevaVariante?: { nombre: string; factorConversion: number }
  // Productos VARIABLE:
  piezas?: PiezaVariable[]
}

export interface ResultadoRecepcion {
  ok: boolean
  lotesCreados: number[]
  error?: string
}

export async function registrarRecepcion(
  input: RecepcionInput
): Promise<ResultadoRecepcion> {
  const {
    productoId,
    fechaCaducidad,
    numeroLote,
    cantidadUnidades,
    varianteProveedorId,
    nuevaVariante,
    piezas,
  } = input

  // tenantId SIEMPRE desde la sesión, nunca del cliente
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, lotesCreados: [], error: 'No autenticado' }
  const tenantId = getActiveTenantId(session.user as any)

  const producto = await prisma.producto.findFirst({
    where: { id: productoId, tenantId },
  })

  if (!producto) {
    return { ok: false, lotesCreados: [], error: 'Producto no encontrado' }
  }

  return prisma.$transaction(async (tx) => {
    const lotesCreados: number[] = []

    if (producto.tipoPeso === 'VARIABLE') {
      if (!piezas || piezas.length === 0) {
        throw new Error('Se requiere al menos una pieza para productos de peso variable')
      }
      for (const pieza of piezas) {
        if (pieza.pesoKg <= 0) continue
        const pesoEnGramos = pieza.pesoKg * 1000
        const lote = await tx.loteInventario.create({
          data: {
            tenantId,
            productoId,
            cantidadInicial: pesoEnGramos,
            cantidadActual: pesoEnGramos,
            pesoRealKg: pieza.pesoKg,
            fechaCaducidad,
            numeroLote,
          },
        })
        lotesCreados.push(lote.id)
      }
    } else {
      // FIJO
      if (!cantidadUnidades || cantidadUnidades <= 0) {
        throw new Error('Se requiere cantidad > 0 para productos de peso fijo')
      }

      let factorConversion = 1

      if (nuevaVariante) {
        const existente = await tx.varianteProveedor.findFirst({
          where: { productoId, tenantId, nombre: nuevaVariante.nombre },
        })
        if (existente) {
          factorConversion = existente.factorConversion
        } else {
          const variante = await tx.varianteProveedor.create({
            data: {
              tenantId,
              productoId,
              nombre: nuevaVariante.nombre,
              factorConversion: nuevaVariante.factorConversion,
            },
          })
          factorConversion = variante.factorConversion
        }
      } else if (varianteProveedorId) {
        const variante = await tx.varianteProveedor.findFirst({
          where: { id: varianteProveedorId, tenantId },
        })
        if (!variante) throw new Error('Variante de proveedor no encontrada')
        factorConversion = variante.factorConversion
      }

      const unidadDestino =
        producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida
      const cantidadBase = convertir(
        cantidadUnidades * factorConversion,
        producto.unidadMedida,
        unidadDestino
      )

      const lote = await tx.loteInventario.create({
        data: {
          tenantId,
          productoId,
          cantidadInicial: cantidadBase,
          cantidadActual: cantidadBase,
          fechaCaducidad,
          numeroLote,
        },
      })
      lotesCreados.push(lote.id)
    }

    return { ok: true, lotesCreados }
  })
}

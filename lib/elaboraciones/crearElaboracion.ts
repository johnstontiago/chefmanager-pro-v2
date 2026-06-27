'use server'

import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'

interface IngredienteInput {
  productoId: number
  cantidad: number
  unidad: string
}

interface CrearElaboracionInput {
  nombre: string
  descripcion?: string
  procedimiento?: string
  unidadBase: string
  stockMinimo?: number
  ingredientes: IngredienteInput[]
}

export interface ResultadoCrearElaboracion {
  ok: boolean
  elaboracionId?: number
  error?: string
}

export async function crearElaboracion(
  input: CrearElaboracionInput
): Promise<ResultadoCrearElaboracion> {
  const { nombre, descripcion, procedimiento, unidadBase, stockMinimo, ingredientes } = input

  // tenantId SIEMPRE desde la sesión, nunca del cliente
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'No autenticado' }
  const tenantId = getActiveTenantId(session.user as any)

  if (!nombre.trim()) return { ok: false, error: 'El nombre es obligatorio' }
  if (!unidadBase) return { ok: false, error: 'La unidad base es obligatoria' }
  if (ingredientes.length === 0) return { ok: false, error: 'Añade al menos un ingrediente' }

  // Validar que todos los productos pertenecen al tenant
  const productoIds = Array.from(new Set(ingredientes.map((i) => i.productoId)))
  const productosValidos = await prisma.producto.findMany({
    where: { tenantId, id: { in: productoIds } },
    select: { id: true },
  })
  if (productosValidos.length !== productoIds.length) {
    return { ok: false, error: 'Algún ingrediente no pertenece a tu negocio' }
  }

  const existente = await prisma.elaboracion.findFirst({
    where: { tenantId, nombre: nombre.trim() },
  })
  if (existente) return { ok: false, error: `Ya existe una elaboración con el nombre "${nombre}"` }

  const elaboracion = await prisma.elaboracion.create({
    data: {
      tenantId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      procedimiento: procedimiento?.trim() || null,
      unidadBase,
      stockMinimo: stockMinimo ?? null,
      ingredientes: {
        create: ingredientes.map((ing) => ({
          tenantId,
          productoId: ing.productoId,
          cantidad: ing.cantidad,
          unidad: ing.unidad,
        })),
      },
    },
  })

  return { ok: true, elaboracionId: elaboracion.id }
}

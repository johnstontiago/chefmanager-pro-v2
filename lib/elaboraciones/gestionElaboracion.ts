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

interface EditarElaboracionInput {
  id: number
  nombre: string
  descripcion?: string
  procedimiento?: string
  unidadBase: string
  stockMinimo?: number
  ingredientes: IngredienteInput[]
}

export interface ResultadoGestion {
  ok: boolean
  error?: string
}

export async function editarElaboracion(
  input: EditarElaboracionInput
): Promise<ResultadoGestion> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'No autenticado' }
  const tenantId = getActiveTenantId(session.user as any)

  const { id, nombre, descripcion, procedimiento, unidadBase, stockMinimo, ingredientes } = input

  const elaboracion = await prisma.elaboracion.findFirst({ where: { id, tenantId } })
  if (!elaboracion) return { ok: false, error: 'Elaboración no encontrada' }
  if (!nombre.trim()) return { ok: false, error: 'El nombre es obligatorio' }
  if (ingredientes.length === 0) return { ok: false, error: 'Añade al menos un ingrediente' }

  const productoIds = Array.from(new Set(ingredientes.map((i) => i.productoId)))
  const validos = await prisma.producto.findMany({
    where: { tenantId, id: { in: productoIds } },
    select: { id: true },
  })
  if (validos.length !== productoIds.length) {
    return { ok: false, error: 'Algún ingrediente no pertenece a tu negocio' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.ingredienteElaboracion.deleteMany({ where: { elaboracionId: id, tenantId } })
    await tx.elaboracion.update({
      where: { id },
      data: {
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
  })

  return { ok: true }
}

export async function eliminarElaboracion(id: number): Promise<ResultadoGestion> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, error: 'No autenticado' }
  const tenantId = getActiveTenantId(session.user as any)

  const elaboracion = await prisma.elaboracion.findFirst({ where: { id, tenantId } })
  if (!elaboracion) return { ok: false, error: 'Elaboración no encontrada' }

  // Si tiene lotes producidos, se desactiva (no se borra para conservar trazabilidad)
  const tieneLotes = await prisma.loteElaboracion.count({ where: { elaboracionId: id, tenantId } })
  if (tieneLotes > 0) {
    await prisma.elaboracion.update({ where: { id }, data: { activa: false } })
    return { ok: true }
  }

  await prisma.$transaction(async (tx) => {
    await tx.ingredienteElaboracion.deleteMany({ where: { elaboracionId: id, tenantId } })
    await tx.elaboracion.delete({ where: { id } })
  })
  return { ok: true }
}

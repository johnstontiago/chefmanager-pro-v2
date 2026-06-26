'use server'

import prisma from '@/lib/db'

interface IngredienteInput {
  productoId: number
  cantidad: number
  unidad: string
}

interface CrearElaboracionInput {
  tenantId: number
  nombre: string
  descripcion?: string
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
  const { tenantId, nombre, descripcion, unidadBase, stockMinimo, ingredientes } = input

  if (!nombre.trim()) return { ok: false, error: 'El nombre es obligatorio' }
  if (!unidadBase) return { ok: false, error: 'La unidad base es obligatoria' }
  if (ingredientes.length === 0) return { ok: false, error: 'Añade al menos un ingrediente' }

  const existente = await prisma.elaboracion.findFirst({
    where: { tenantId, nombre: nombre.trim() },
  })
  if (existente) return { ok: false, error: `Ya existe una elaboración con el nombre "${nombre}"` }

  const elaboracion = await prisma.elaboracion.create({
    data: {
      tenantId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
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

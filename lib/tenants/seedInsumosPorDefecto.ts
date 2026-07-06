import prisma from '@/lib/db'

/**
 * Crea los insumos manuales que todo negocio necesita por defecto para usar
 * en elaboraciones/preparaciones aunque no vengan de un producto de inventario
 * (ej. el agua). Idempotente: si el tenant ya tiene un insumo con ese nombre
 * no crea un duplicado.
 */
export async function seedInsumosPorDefecto(tenantId: number): Promise<void> {
  const existente = await prisma.insumo.findFirst({
    where: {
      tenantId,
      nombre: { equals: 'Agua', mode: 'insensitive' },
      productoId: null,
      elaboracionId: null,
      preparacionId: null,
    },
    select: { id: true },
  })

  if (existente) return

  await prisma.insumo.create({
    data: {
      tenantId,
      nombre: 'Agua',
      unidad: 'l',
      valorPorUnidad: 0,
    },
  })
}

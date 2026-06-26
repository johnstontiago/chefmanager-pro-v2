import prisma from '@/lib/db'

export interface AlertaStock {
  tipo: 'producto' | 'elaboracion'
  id: number
  nombre: string
  stockActual: number
  stockMinimo: number
  unidad: string
  proximaCaducidad?: Date
}

export async function obtenerAlertas(tenantId: number): Promise<AlertaStock[]> {
  const alertas: AlertaStock[] = []

  const [productos, elaboraciones] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId, activo: true },
      include: {
        lotes: {
          where: { tenantId, agotado: false },
          orderBy: { fechaCaducidad: 'asc' },
        },
      },
    }),
    prisma.elaboracion.findMany({
      where: { tenantId, activa: true, stockMinimo: { not: null } },
      include: {
        lotes: {
          where: { tenantId, agotado: false },
          orderBy: { fechaCaducidad: 'asc' },
        },
      },
    }),
  ])

  for (const producto of productos) {
    const stockMinimoNum = producto.stockMinimo ? Number(producto.stockMinimo) : 0
    if (stockMinimoNum <= 0) continue

    const stockActual = producto.lotes.reduce((s, l) => s + l.cantidadActual, 0)
    if (stockActual <= stockMinimoNum) {
      alertas.push({
        tipo: 'producto',
        id: producto.id,
        nombre: producto.nombre,
        stockActual,
        stockMinimo: stockMinimoNum,
        unidad: producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida,
        proximaCaducidad: producto.lotes[0]?.fechaCaducidad ?? undefined,
      })
    }
  }

  for (const elaboracion of elaboraciones) {
    const stockActual = elaboracion.lotes.reduce((s, l) => s + l.cantidadActual, 0)
    if (stockActual <= (elaboracion.stockMinimo ?? 0)) {
      alertas.push({
        tipo: 'elaboracion',
        id: elaboracion.id,
        nombre: elaboracion.nombre,
        stockActual,
        stockMinimo: elaboracion.stockMinimo!,
        unidad: elaboracion.unidadBase,
        proximaCaducidad: elaboracion.lotes[0]?.fechaCaducidad ?? undefined,
      })
    }
  }

  return alertas
}

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Catálogo de fichas técnicas para el TPV.
// Autenticado con la misma API key. Devuelve id + nombre de cada plato
// para que el TPV pueda mapear sus productos con ChefManager.
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'API key requerida' }, { status: 401 })
  }

  const integracion = await prisma.integracionTPV.findUnique({ where: { apiKey } })
  if (!integracion || !integracion.activa) {
    return NextResponse.json({ error: 'API key inválida o inactiva' }, { status: 401 })
  }

  const fichas = await prisma.fichaTecnica.findMany({
    where: { tenantId: integracion.tenantId },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, porciones: true },
  })

  return NextResponse.json({ fichas })
}

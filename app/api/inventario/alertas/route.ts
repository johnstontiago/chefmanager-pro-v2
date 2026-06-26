import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { obtenerAlertas } from '@/lib/stock/alertasStock'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tenantId = getActiveTenantId(session.user)

  try {
    const alertas = await obtenerAlertas(tenantId)
    return NextResponse.json({ alertas })
  } catch (error) {
    console.error('[GET /api/inventario/alertas]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

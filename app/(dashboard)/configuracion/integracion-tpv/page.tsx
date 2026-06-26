import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import IntegracionTPVClient from './_components/integracion-tpv-client'

export const dynamic = 'force-dynamic'

export default async function IntegracionTPVPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)

  const integracion = await prisma.integracionTPV.findUnique({
    where: { tenantId },
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          fichaId: true,
          cantidadPlatos: true,
          statusCode: true,
          ok: true,
          ipOrigen: true,
          duracionMs: true,
          createdAt: true,
          payload: true,
          respuesta: true,
        },
      },
    },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <IntegracionTPVClient integracion={integracion} tenantId={tenantId} />
    </div>
  )
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import ElaboracionesContent from './_components/elaboraciones-content'

export const dynamic = 'force-dynamic'

export default async function ElaboracionesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)

  const [elaboraciones, productos] = await Promise.all([
    prisma.elaboracion.findMany({
      where: { tenantId, activa: true },
      orderBy: { nombre: 'asc' },
      include: {
        ingredientes: {
          include: {
            producto: { select: { id: true, nombre: true, unidadMedida: true, unidadBase: true, contenidoUnidad: true } },
          },
        },
        lotes: {
          where: { agotado: false },
          orderBy: { fechaProduccion: 'desc' },
          select: { id: true, cantidadActual: true, fechaCaducidad: true },
        },
      },
    }),
    prisma.producto.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        unidadMedida: true,
        unidadBase: true,
        contenidoUnidad: true,
      },
    }),
  ])

  const elaboracionesConStock = elaboraciones.map((e) => ({
    ...e,
    stockActual: e.lotes.reduce((s, l) => s + l.cantidadActual, 0),
    proximaCaducidad:
      e.lotes
        .filter((l) => l.fechaCaducidad)
        .sort((a, b) => (a.fechaCaducidad! < b.fechaCaducidad! ? -1 : 1))[0]
        ?.fechaCaducidad ?? null,
  }))

  return (
    <div className="p-6">
      <ElaboracionesContent
        elaboraciones={elaboracionesConStock}
        productos={productos}
        tenantId={tenantId}
      />
    </div>
  )
}

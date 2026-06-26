import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import RecepcionForm from './_components/recepcion-form'

export const dynamic = 'force-dynamic'

export default async function NuevaRecepcionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)

  const productos = await prisma.producto.findMany({
    where: { tenantId, activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      tipoPeso: true,
      unidadMedida: true,
      unidadBase: true,
      contenidoUnidad: true,
      variantesProveedor: {
        where: { activa: true },
        select: { id: true, nombre: true, factorConversion: true },
      },
    },
  })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Registrar recepción de mercancía</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Añade lotes al inventario tras recibir un pedido
        </p>
      </div>
      <RecepcionForm productos={productos} tenantId={tenantId} />
    </div>
  )
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import SimuladorClient from './_components/simulador-client'

export const dynamic = 'force-dynamic'

export default async function SimuladorTPVPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)

  const [integracion, fichas] = await Promise.all([
    prisma.integracionTPV.findUnique({ where: { tenantId } }),
    prisma.fichaTecnica.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        porciones: true,
        ingredientesPlatoStock: {
          select: {
            id: true,
            cantidad: true,
            unidad: true,
            producto: { select: { id: true, nombre: true, unidadBase: true, contenidoUnidad: true, unidadMedida: true } },
            elaboracion: { select: { id: true, nombre: true, unidadBase: true } },
          },
        },
      },
    }),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/configuracion/integracion-tpv">
          <Button variant="ghost" size="sm">← TPV</Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Simulador de comandas</h1>
          <p className="text-sm text-muted-foreground">
            Prueba el endpoint de ventas sin necesidad de un TPV real
          </p>
        </div>
      </div>

      {!integracion ? (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-800">
          No hay integración TPV configurada. Crea una antes de usar el simulador.
        </div>
      ) : !integracion.activa ? (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-800">
          La integración TPV está inactiva. Actívala desde el panel de configuración.
        </div>
      ) : (
        <SimuladorClient
          apiKey={integracion.apiKey}
          fichas={fichas}
        />
      )}
    </div>
  )
}

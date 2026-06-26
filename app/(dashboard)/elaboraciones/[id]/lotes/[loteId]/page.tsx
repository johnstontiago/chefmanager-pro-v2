import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string; loteId: string }
}

export default async function LoteElaboracionPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)
  const loteId = parseInt(params.loteId, 10)

  if (isNaN(loteId)) notFound()

  const lote = await prisma.loteElaboracion.findFirst({
    where: { id: loteId, tenantId },
    include: {
      elaboracion: { select: { id: true, nombre: true, unidadBase: true } },
      insumos: {
        include: {
          loteInventario: {
            include: {
              producto: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      consumos: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })

  if (!lote) notFound()

  const consumido = lote.cantidadInicial - lote.cantidadActual

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href={`/elaboraciones`}>
          <Button variant="ghost" size="sm">
            ← Elaboraciones
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">{lote.elaboracion.nombre} — Lote #{lote.id}</h1>
      </div>

      {/* Cabecera del lote */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="Producido"
          value={`${lote.fechaProduccion.toLocaleDateString('es-ES')}`}
        />
        <Stat
          label="Cantidad inicial"
          value={`${lote.cantidadInicial} ${lote.elaboracion.unidadBase}`}
        />
        <Stat
          label="Stock actual"
          value={`${lote.cantidadActual} ${lote.elaboracion.unidadBase}`}
        />
        <Stat
          label="Consumido"
          value={`${consumido.toFixed(3)} ${lote.elaboracion.unidadBase}`}
        />
        {lote.fechaCaducidad && (
          <Stat
            label="Caducidad"
            value={lote.fechaCaducidad.toLocaleDateString('es-ES')}
          />
        )}
        {lote.agotado && (
          <div className="col-span-2 flex items-center">
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
              Lote agotado
            </span>
          </div>
        )}
        {lote.notas && (
          <div className="col-span-4">
            <p className="text-sm text-muted-foreground">
              <strong>Notas:</strong> {lote.notas}
            </p>
          </div>
        )}
      </div>

      {/* Insumos utilizados */}
      <section>
        <h2 className="text-base font-semibold mb-3">Insumos utilizados</h2>
        {lote.insumos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de trazabilidad.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="pb-2 font-medium">Producto</th>
                <th className="pb-2 font-medium">Lote inventario</th>
                <th className="pb-2 font-medium text-right">Cantidad usada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lote.insumos.map((ins) => (
                <tr key={ins.id}>
                  <td className="py-2">{ins.loteInventario.producto.nombre}</td>
                  <td className="py-2">
                    <Link
                      href={`/inventario/lotes/${ins.loteInventarioId}`}
                      className="text-primary hover:underline"
                    >
                      Lote #{ins.loteInventarioId}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{ins.cantidadUsada.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Consumos del lote */}
      <section>
        <h2 className="text-base font-semibold mb-3">Consumos registrados</h2>
        {lote.consumos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin consumos registrados aún.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Motivo</th>
                <th className="pb-2 font-medium">Referencia</th>
                <th className="pb-2 font-medium text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lote.consumos.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">{c.createdAt.toLocaleDateString('es-ES')}</td>
                  <td className="py-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        c.motivo === 'VENTA'
                          ? 'bg-blue-100 text-blue-700'
                          : c.motivo === 'MERMA'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c.motivo}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{c.referenciaId ?? '—'}</td>
                  <td className="py-2 text-right">{c.cantidad.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}

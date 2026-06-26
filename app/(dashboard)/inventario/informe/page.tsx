import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getActiveTenantId } from '@/lib/get-active-tenant'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db'
import { obtenerAlertas } from '@/lib/stock/alertasStock'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

function estadoProducto(actual: number, minimo: number | null) {
  if (actual <= 0) return { label: 'Agotado', className: 'bg-red-100 text-red-700' }
  if (minimo && actual <= minimo) return { label: '⚠ Bajo', className: 'bg-amber-100 text-amber-700' }
  return { label: 'OK', className: 'bg-green-100 text-green-700' }
}

export default async function InformeInventarioPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tenantId = getActiveTenantId(session.user as any)

  const [productos, elaboraciones, alertas] = await Promise.all([
    prisma.producto.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        unidadMedida: true,
        unidadBase: true,
        contenidoUnidad: true,
        stockMinimo: true,
        lotes: {
          where: { tenantId, agotado: false },
          orderBy: { fechaCaducidad: 'asc' },
          select: { cantidadActual: true, fechaCaducidad: true },
        },
      },
    }),
    prisma.elaboracion.findMany({
      where: { tenantId, activa: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        unidadBase: true,
        stockMinimo: true,
        lotes: {
          where: { tenantId, agotado: false },
          orderBy: { fechaCaducidad: 'asc' },
          select: { cantidadActual: true, fechaCaducidad: true },
        },
      },
    }),
    obtenerAlertas(tenantId),
  ])

  const productosConStock = productos.map((p) => ({
    ...p,
    stockActual: p.lotes.reduce((s, l) => s + l.cantidadActual, 0),
    proximaCaducidad: p.lotes.find((l) => l.fechaCaducidad)?.fechaCaducidad ?? null,
    unidadDisplay: p.unidadBase ?? p.contenidoUnidad ?? p.unidadMedida,
  }))

  const elaboracionesConStock = elaboraciones.map((e) => ({
    ...e,
    stockActual: e.lotes.reduce((s, l) => s + l.cantidadActual, 0),
    proximaCaducidad: e.lotes.find((l) => l.fechaCaducidad)?.fechaCaducidad ?? null,
  }))

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Informe de inventario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estado actual de materias primas y elaboraciones
        </p>
      </div>

      {/* Panel de alertas */}
      {alertas.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">
            ⚠ {alertas.length} alerta{alertas.length > 1 ? 's' : ''} activa{alertas.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-1">
            {alertas.map((a) => (
              <p key={`${a.tipo}-${a.id}`} className="text-sm text-amber-700">
                {a.tipo === 'elaboracion' ? '🍳' : '📦'} <strong>{a.nombre}</strong> —{' '}
                {a.stockActual.toFixed(1)} / {a.stockMinimo} {a.unidad}
                {a.proximaCaducidad && (
                  <span className="text-amber-600">
                    {' '}· Caduca {new Date(a.proximaCaducidad).toLocaleDateString('es-ES')}
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Materias primas */}
      <section>
        <h2 className="text-base font-semibold mb-3">Materias primas</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium text-right">Stock actual</th>
                <th className="px-4 py-3 font-medium text-right">Stock mínimo</th>
                <th className="px-4 py-3 font-medium">Próxima caducidad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productosConStock.map((p) => {
                const estado = estadoProducto(p.stockActual, Number(p.stockMinimo))
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3 text-right">
                      {p.stockActual.toFixed(1)} {p.unidadDisplay}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {p.stockMinimo ? `${Number(p.stockMinimo)} ${p.unidadDisplay}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.proximaCaducidad
                        ? new Date(p.proximaCaducidad).toLocaleDateString('es-ES')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${estado.className}`}
                      >
                        {estado.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {productosConStock.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No hay productos activos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Elaboraciones */}
      <section>
        <h2 className="text-base font-semibold mb-3">Elaboraciones</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Elaboración</th>
                <th className="px-4 py-3 font-medium text-right">Stock actual</th>
                <th className="px-4 py-3 font-medium text-right">Stock mínimo</th>
                <th className="px-4 py-3 font-medium">Próxima caducidad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {elaboracionesConStock.map((e) => {
                const estado = estadoProducto(e.stockActual, e.stockMinimo)
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium">{e.nombre}</td>
                    <td className="px-4 py-3 text-right">
                      {e.stockActual.toFixed(1)} {e.unidadBase}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {e.stockMinimo ? `${e.stockMinimo} ${e.unidadBase}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.proximaCaducidad
                        ? new Date(e.proximaCaducidad).toLocaleDateString('es-ES')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${estado.className}`}
                      >
                        {estado.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {elaboracionesConStock.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No hay elaboraciones configuradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

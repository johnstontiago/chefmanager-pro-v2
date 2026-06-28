'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Log = {
  id: number
  fichaId: number | null
  cantidadPlatos: number | null
  statusCode: number
  ok: boolean
  ipOrigen: string | null
  duracionMs: number | null
  createdAt: Date
  payload: unknown
  respuesta: unknown
}

type Integracion = {
  id: number
  apiKey: string
  activa: boolean
  nombre: string | null
  logs: Log[]
} | null

interface Props {
  integracion: Integracion
  tenantId: number
}

export default function IntegracionTPVClient({ integracion, tenantId }: Props) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [logDetalle, setLogDetalle] = useState<Log | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const apiKey = integracion?.apiKey ?? ''
  const activa = integracion?.activa ?? false

  const copiarApiKey = () => {
    navigator.clipboard.writeText(apiKey)
  }

  const probarConexion = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/ventas/consumo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ fichaId: 0, cantidad: 0 }),
        })
        if (res.status === 400) {
          setTestResult('✓ Conexión OK — API key válida y activa')
        } else if (res.status === 401) {
          setTestResult('✗ API key inválida o inactiva')
        } else {
          setTestResult(`Respuesta: ${res.status}`)
        }
      } catch {
        setTestResult('Error de red al conectar')
      }
    })
  }

  if (!integracion) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Integración TPV</h1>
        <p className="text-muted-foreground text-sm">
          No hay integración TPV configurada para este negocio. Contacta con soporte para
          activarla.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integración TPV</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecta tu TPV para descuento automático de stock
          </p>
        </div>
        <Badge className={activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {activa ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      {/* API Key */}
      <section className="border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold">API Key</h2>
        <div className="flex items-center gap-2">
          <Input
            type={apiKeyVisible ? 'text' : 'password'}
            value={apiKey}
            readOnly
            className="font-mono text-xs min-w-0 flex-1"
          />
          <Button variant="outline" size="sm" className="flex-shrink-0 px-2" onClick={() => setApiKeyVisible((v) => !v)}>
            {apiKeyVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
          <Button variant="outline" size="sm" className="flex-shrink-0 px-2" onClick={copiarApiKey}>
            Copiar
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={probarConexion} disabled={isPending}>
            {isPending ? 'Probando...' : 'Probar conexión'}
          </Button>
          {testResult && (
            <span className="text-sm text-muted-foreground">{testResult}</span>
          )}
        </div>
      </section>

      {/* Documentación embebida */}
      <section className="border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold">Cómo integrarlo</h2>
        <div className="bg-muted rounded-md p-4 font-mono text-xs space-y-1 text-foreground break-all">
          <p className="text-muted-foreground"># Descontar stock al vender un plato</p>
          <p>POST https://app.chefmanager.com/api/ventas/consumo</p>
          <p>Headers: x-api-key: TU_API_KEY</p>
          <p>Body: {'{ "fichaId": 123, "cantidad": 1 }'}</p>
          <p className="mt-2 text-muted-foreground"># Respuestas</p>
          <p>200 — OK, stock descontado</p>
          <p>207 — Parcial: stock insuficiente en algún ingrediente</p>
          <p>401 — API key inválida o inactiva</p>
          <p>404 — Ficha técnica no encontrada</p>
          <p>422 — Ficha sin ingredientes que afecten al stock</p>
        </div>
      </section>

      {/* Últimas llamadas */}
      <section>
        <h2 className="text-base font-semibold mb-3">Últimas 50 llamadas</h2>
        {integracion.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin llamadas registradas aún.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Ficha</th>
                  <th className="px-4 py-3 font-medium">Cant.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Duración</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {integracion.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString('es-ES')}
                    </td>
                    <td className="px-4 py-2">{log.fichaId ?? '—'}</td>
                    <td className="px-4 py-2">{log.cantidadPlatos ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          log.ok
                            ? 'bg-green-100 text-green-700'
                            : log.statusCode === 207
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {log.duracionMs ? `${log.duracionMs}ms` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => setLogDetalle(log)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drawer detalle de log */}
      <Dialog open={!!logDetalle} onOpenChange={(v) => !v && setLogDetalle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de llamada #{logDetalle?.id}</DialogTitle>
          </DialogHeader>
          {logDetalle && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Payload recibido</p>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-40">
                  {JSON.stringify(logDetalle.payload, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Respuesta enviada</p>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-40">
                  {JSON.stringify(logDetalle.respuesta, null, 2)}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                IP origen: {logDetalle.ipOrigen ?? 'desconocida'} · Duración:{' '}
                {logDetalle.duracionMs ? `${logDetalle.duracionMs}ms` : '—'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Tipos ────────────────────────────────────────────────────────────────────

type IngredienteStock = {
  id: number
  cantidad: number
  unidad: string
  producto: { id: number; nombre: string; unidadBase: string | null; contenidoUnidad: string | null; unidadMedida: string } | null
  elaboracion: { id: number; nombre: string; unidadBase: string } | null
}

type Ficha = {
  id: number
  nombre: string
  porciones: number
  ingredientesPlatoStock: IngredienteStock[]
}

interface Props {
  apiKey: string
  fichas: Ficha[]
}

// ── Historial de comandas ─────────────────────────────────────────────────────

type EntradaHistorial = {
  id: number
  fichaId: number
  fichaNombre: string
  cantidad: number
  timestamp: string
  statusCode: number
  ok: boolean
  respuesta: unknown
  duracionMs: number
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SimuladorClient({ apiKey, fichas }: Props) {
  const [fichaId, setFichaId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [enviando, setEnviando] = useState(false)
  const [historial, setHistorial] = useState<EntradaHistorial[]>([])
  const [detalleAbierto, setDetalleAbierto] = useState<number | null>(null)
  const [ultimaRespuesta, setUltimaRespuesta] = useState<unknown>(null)

  const fichaSel = fichas.find((f) => f.id === fichaId) ?? null
  const tieneEscandallo = (fichaSel?.ingredientesPlatoStock.length ?? 0) > 0
  const fichasSinEscandallo = fichas.filter((f) => f.ingredientesPlatoStock.length === 0)
  const fichasConEscandallo = fichas.filter((f) => f.ingredientesPlatoStock.length > 0)

  const enviarComanda = async () => {
    if (!fichaId || !fichaSel) return
    const cant = parseFloat(cantidad)
    if (isNaN(cant) || cant <= 0) return

    setEnviando(true)
    const inicio = Date.now()

    try {
      const res = await fetch('/api/ventas/consumo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ fichaId, cantidad: cant }),
      })

      const duracionMs = Date.now() - inicio
      const data = await res.json()

      setUltimaRespuesta(data)
      setHistorial((prev) => [
        {
          id: Date.now(),
          fichaId,
          fichaNombre: fichaSel.nombre,
          cantidad: cant,
          timestamp: new Date().toLocaleTimeString('es-ES'),
          statusCode: res.status,
          ok: res.ok && data.ok,
          respuesta: data,
          duracionMs,
        },
        ...prev,
      ])
    } catch (err) {
      const duracionMs = Date.now() - inicio
      const data = { error: err instanceof Error ? err.message : 'Error de red' }
      setUltimaRespuesta(data)
      setHistorial((prev) => [
        {
          id: Date.now(),
          fichaId,
          fichaNombre: fichaSel.nombre,
          cantidad: cant,
          timestamp: new Date().toLocaleTimeString('es-ES'),
          statusCode: 0,
          ok: false,
          respuesta: data,
          duracionMs,
        },
        ...prev,
      ])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Aviso fichas sin escandallo */}
      {fichasSinEscandallo.length > 0 && (
        <div className="bg-muted/50 border rounded-lg p-4 text-sm space-y-1">
          <p className="font-medium text-muted-foreground">
            {fichasSinEscandallo.length} ficha{fichasSinEscandallo.length > 1 ? 's' : ''} sin
            escandallo de stock configurado — no se pueden simular:
          </p>
          <p className="text-muted-foreground text-xs">
            {fichasSinEscandallo.map((f) => f.nombre).join(', ')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Configura <strong>IngredientePlatoStock</strong> para esas fichas antes de usar el simulador.
          </p>
        </div>
      )}

      {/* Panel de envío */}
      <div className="border rounded-lg p-5 space-y-5">
        <h2 className="text-sm font-semibold">Nueva comanda</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Ficha técnica (plato)</Label>
            <Select
              value={fichaId?.toString() ?? ''}
              onValueChange={(v) => setFichaId(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un plato" />
              </SelectTrigger>
              <SelectContent>
                {fichasConEscandallo.length > 0 && (
                  <>
                    {fichasConEscandallo.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </>
                )}
                {fichasConEscandallo.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No hay fichas con escandallo configurado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cantidad de raciones</Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={enviarComanda}
              disabled={!fichaId || !tieneEscandallo || enviando}
              className="w-full"
            >
              {enviando ? 'Enviando...' : '→ Enviar comanda'}
            </Button>
          </div>
        </div>

        {/* Resumen de ingredientes que se van a consumir */}
        {fichaSel && tieneEscandallo && (
          <div className="bg-muted/50 rounded-md p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Stock que se descontará ({parseFloat(cantidad) || 1} ración
              {parseFloat(cantidad) !== 1 ? 'es' : ''}):
            </p>
            {fichaSel.ingredientesPlatoStock.map((ing) => {
              const cant = (ing.cantidad * (parseFloat(cantidad) || 1)).toFixed(3)
              const nombre = ing.producto?.nombre ?? ing.elaboracion?.nombre ?? '?'
              const tipo = ing.elaboracion ? '🍳' : '📦'
              const unidadBase =
                ing.producto?.unidadBase ??
                ing.producto?.contenidoUnidad ??
                ing.producto?.unidadMedida ??
                ing.elaboracion?.unidadBase ??
                ing.unidad
              return (
                <p key={ing.id} className="text-xs text-muted-foreground">
                  {tipo} {nombre}:{' '}
                  <strong>
                    {cant} {unidadBase}
                  </strong>
                </p>
              )
            })}
          </div>
        )}

        {/* Petición HTTP que se enviará */}
        {fichaSel && (
          <div className="bg-zinc-950 rounded-md p-3">
            <p className="text-xs text-zinc-400 mb-1">Petición HTTP</p>
            <pre className="text-xs text-zinc-200 overflow-auto">
{`POST /api/ventas/consumo
x-api-key: ${apiKey.slice(0, 8)}••••••••

{
  "fichaId": ${fichaId},
  "cantidad": ${parseFloat(cantidad) || 1}
}`}
            </pre>
          </div>
        )}
      </div>

      {/* Última respuesta */}
      {ultimaRespuesta !== null && (
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold">Última respuesta</h2>
          <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-64">
            {JSON.stringify(ultimaRespuesta, null, 2)}
          </pre>
        </div>
      )}

      {/* Historial de esta sesión */}
      {historial.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Historial de sesión</h2>
          <div className="border rounded-lg divide-y">
            {historial.map((entrada) => (
              <div key={entrada.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        entrada.ok
                          ? 'bg-green-100 text-green-700'
                          : entrada.statusCode === 207
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {entrada.statusCode || 'ERR'}
                    </span>
                    <span className="text-sm font-medium truncate">{entrada.fichaNombre}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      ×{entrada.cantidad}
                    </span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {entrada.duracionMs}ms
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{entrada.timestamp}</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() =>
                        setDetalleAbierto(
                          detalleAbierto === entrada.id ? null : entrada.id
                        )
                      }
                    >
                      {detalleAbierto === entrada.id ? 'Cerrar' : 'Ver detalle'}
                    </button>
                  </div>
                </div>

                {detalleAbierto === entrada.id && (
                  <div className="mt-3">
                    <ResumenComanda respuesta={entrada.respuesta} />
                    <pre className="mt-2 bg-muted rounded-md p-3 text-xs overflow-auto max-h-48">
                      {JSON.stringify(entrada.respuesta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setHistorial([])}
          >
            Limpiar historial
          </button>
        </div>
      )}
    </div>
  )
}

// ── Resumen legible de la respuesta ─────────────────────────────────────────

function ResumenComanda({ respuesta }: { respuesta: unknown }) {
  const r = respuesta as any
  if (!r?.resultados) return null

  return (
    <div className="space-y-1">
      {r.resultados.map((res: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={res.ok ? 'text-green-600' : 'text-red-600'}>
            {res.ok ? '✓' : '✗'}
          </span>
          <span className="text-muted-foreground">
            {res.tipo === 'elaboracion' ? '🍳' : '📦'} {res.nombre}
          </span>
          <span>—</span>
          {res.ok ? (
            <span className="text-green-700">
              descontado {res.consumido?.toFixed?.(3) ?? res.consumido}
            </span>
          ) : (
            <span className="text-red-700">stock insuficiente</span>
          )}
        </div>
      ))}
    </div>
  )
}

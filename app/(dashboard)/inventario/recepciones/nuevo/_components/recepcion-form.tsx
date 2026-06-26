'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { registrarRecepcion } from '@/lib/recepciones/registrarRecepcion'

type Variante = { id: number; nombre: string; factorConversion: number }

type Producto = {
  id: number
  nombre: string
  tipoPeso: 'FIJO' | 'VARIABLE'
  unidadMedida: string
  unidadBase: string | null
  contenidoUnidad: string | null
  variantesProveedor: Variante[]
}

interface Props {
  productos: Producto[]
  tenantId: number
}

interface Pieza {
  id: number
  pesoKg: string
}

function calcularTotalFijo(
  producto: Producto,
  cantidadUnidades: string,
  usarVariante: boolean,
  crearNuevaVariante: boolean,
  varianteId: number | null,
  nuevaVarianteFactor: string
): number | null {
  const cant = parseFloat(cantidadUnidades)
  if (isNaN(cant) || cant <= 0) return null

  if (!usarVariante) return cant

  if (!crearNuevaVariante && varianteId) {
    const v = producto.variantesProveedor.find((v) => v.id === varianteId)
    return v ? cant * v.factorConversion : null
  }

  if (crearNuevaVariante) {
    const f = parseFloat(nuevaVarianteFactor)
    return isNaN(f) || f <= 0 ? null : cant * f
  }

  return null
}

export default function RecepcionForm({ productos, tenantId }: Props) {
  const [productoId, setProductoId] = useState<number | null>(null)
  const [cantidadUnidades, setCantidadUnidades] = useState('')
  const [varianteId, setVarianteId] = useState<number | null>(null)
  const [usarVariante, setUsarVariante] = useState(false)
  const [nuevaVarianteNombre, setNuevaVarianteNombre] = useState('')
  const [nuevaVarianteFactor, setNuevaVarianteFactor] = useState('')
  const [crearNuevaVariante, setCrearNuevaVariante] = useState(false)
  const [piezas, setPiezas] = useState<Pieza[]>([{ id: 1, pesoKg: '' }])
  const [fechaCaducidad, setFechaCaducidad] = useState('')
  const [numeroLote, setNumeroLote] = useState('')
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const producto = productos.find((p) => p.id === productoId) ?? null
  const esVariable = producto?.tipoPeso === 'VARIABLE'
  const unidadDisplay = producto
    ? (producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida)
    : ''

  const totalFijoVal = producto
    ? calcularTotalFijo(
        producto,
        cantidadUnidades,
        usarVariante,
        crearNuevaVariante,
        varianteId,
        nuevaVarianteFactor
      )
    : null

  const totalVariable = piezas.reduce((s, p) => s + (parseFloat(p.pesoKg) || 0), 0)

  const addPieza = () =>
    setPiezas((prev) => [...prev, { id: Date.now(), pesoKg: '' }])

  const removePieza = (id: number) =>
    setPiezas((prev) => prev.filter((p) => p.id !== id))

  const updatePieza = (id: number, val: string) =>
    setPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, pesoKg: val } : p)))

  const resetForm = () => {
    setProductoId(null)
    setCantidadUnidades('')
    setVarianteId(null)
    setUsarVariante(false)
    setNuevaVarianteNombre('')
    setNuevaVarianteFactor('')
    setCrearNuevaVariante(false)
    setPiezas([{ id: 1, pesoKg: '' }])
    setFechaCaducidad('')
    setNumeroLote('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productoId) return

    startTransition(async () => {
      try {
        const base = {
          tenantId,
          productoId,
          fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : undefined,
          numeroLote: numeroLote || undefined,
        }

        const result = esVariable
          ? await registrarRecepcion({
              ...base,
              piezas: piezas
                .filter((p) => parseFloat(p.pesoKg) > 0)
                .map((p) => ({ pesoKg: parseFloat(p.pesoKg) })),
            })
          : await registrarRecepcion({
              ...base,
              cantidadUnidades: parseFloat(cantidadUnidades),
              varianteProveedorId:
                usarVariante && !crearNuevaVariante && varianteId ? varianteId : undefined,
              nuevaVariante:
                usarVariante && crearNuevaVariante
                  ? {
                      nombre: nuevaVarianteNombre,
                      factorConversion: parseFloat(nuevaVarianteFactor),
                    }
                  : undefined,
            })

        if (result.ok) {
          const n = result.lotesCreados.length
          setResultado({
            ok: true,
            mensaje: `${n} lote${n > 1 ? 's' : ''} creado${n > 1 ? 's' : ''} correctamente`,
          })
          resetForm()
        } else {
          setResultado({ ok: false, mensaje: result.error ?? 'Error al registrar' })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error inesperado'
        setResultado({ ok: false, mensaje: msg })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resultado && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            resultado.ok
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {resultado.mensaje}
          {resultado.ok && (
            <button
              type="button"
              className="ml-3 underline text-xs"
              onClick={() => setResultado(null)}
            >
              Registrar otra
            </button>
          )}
        </div>
      )}

      {/* Selector de producto */}
      <div className="space-y-1.5">
        <Label>Producto</Label>
        <Select
          value={productoId?.toString() ?? ''}
          onValueChange={(v) => {
            setProductoId(parseInt(v, 10))
            setUsarVariante(false)
            setVarianteId(null)
            setCrearNuevaVariante(false)
            setPiezas([{ id: 1, pesoKg: '' }])
            setCantidadUnidades('')
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un producto" />
          </SelectTrigger>
          <SelectContent>
            {productos.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.nombre}
                {p.tipoPeso === 'VARIABLE' && (
                  <span className="ml-2 text-xs text-muted-foreground">(peso variable)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Formulario FIJO */}
      {producto && !esVariable && (
        <>
          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min="0.001"
              step="any"
              value={cantidadUnidades}
              onChange={(e) => setCantidadUnidades(e.target.value)}
              placeholder="Número de unidades"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="usar-variante"
              checked={usarVariante}
              onCheckedChange={(v) => setUsarVariante(!!v)}
            />
            <Label htmlFor="usar-variante">El proveedor entrega en formato diferente</Label>
          </div>

          {usarVariante && (
            <div className="pl-6 space-y-4 border-l-2 border-muted">
              {producto.variantesProveedor.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Variante existente</Label>
                  <Select
                    value={varianteId?.toString() ?? ''}
                    onValueChange={(v) => {
                      setVarianteId(parseInt(v, 10))
                      setCrearNuevaVariante(false)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una variante" />
                    </SelectTrigger>
                    <SelectContent>
                      {producto.variantesProveedor.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          {v.nombre} (×{v.factorConversion} {unidadDisplay}/unidad)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="crear-variante"
                  checked={crearNuevaVariante}
                  onCheckedChange={(v) => {
                    setCrearNuevaVariante(!!v)
                    if (v) setVarianteId(null)
                  }}
                />
                <Label htmlFor="crear-variante">+ Crear nueva variante</Label>
              </div>

              {crearNuevaVariante && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nombre de variante</Label>
                    <Input
                      value={nuevaVarianteNombre}
                      onChange={(e) => setNuevaVarianteNombre(e.target.value)}
                      placeholder="Ej: Caja 2kg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Factor ({unidadDisplay}/unidad)</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={nuevaVarianteFactor}
                      onChange={(e) => setNuevaVarianteFactor(e.target.value)}
                      placeholder="2"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {totalFijoVal !== null && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
              Total a ingresar:{' '}
              <strong>
                {totalFijoVal} {unidadDisplay}
              </strong>
            </p>
          )}
        </>
      )}

      {/* Formulario VARIABLE — tabla de piezas */}
      {producto && esVariable && (
        <div className="space-y-3">
          <Label>Piezas recibidas</Label>
          <div className="border rounded-md divide-y">
            {piezas.map((pieza, i) => (
              <div key={pieza.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm text-muted-foreground w-16">Pieza {i + 1}</span>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={pieza.pesoKg}
                  onChange={(e) => updatePieza(pieza.id, e.target.value)}
                  placeholder="Peso en kg"
                  className="w-40"
                />
                <span className="text-sm text-muted-foreground">kg</span>
                {piezas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePieza(pieza.id)}
                    className="ml-auto text-xs text-destructive hover:underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPieza}>
            + Añadir pieza
          </Button>
          <p className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
            Total recibido: <strong>{totalVariable.toFixed(3)} kg</strong>
          </p>
        </div>
      )}

      {/* Campos comunes */}
      {producto && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Fecha de caducidad</Label>
            <Input
              type="date"
              value={fechaCaducidad}
              onChange={(e) => setFechaCaducidad(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nº lote proveedor</Label>
            <Input
              value={numeroLote}
              onChange={(e) => setNumeroLote(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
      )}

      <Button type="submit" disabled={!productoId || isPending} className="w-full">
        {isPending ? 'Registrando...' : 'Registrar entrada'}
      </Button>
    </form>
  )
}

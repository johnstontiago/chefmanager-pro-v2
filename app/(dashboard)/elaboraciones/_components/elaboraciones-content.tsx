'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { crearElaboracion } from '@/lib/elaboraciones/crearElaboracion'
import { producirElaboracion } from '@/lib/elaboraciones/producirElaboracion'
import Link from 'next/link'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Producto = {
  id: number
  nombre: string
  unidadMedida: string
  unidadBase: string | null
  contenidoUnidad: string | null
}

type Ingrediente = {
  id: number
  cantidad: number
  unidad: string
  producto: Producto
}

type Elaboracion = {
  id: number
  nombre: string
  descripcion: string | null
  unidadBase: string
  stockMinimo: number | null
  stockActual: number
  proximaCaducidad: Date | null
  ingredientes: Ingrediente[]
  lotes: { id: number; cantidadActual: number; fechaCaducidad: Date | null }[]
}

interface Props {
  elaboraciones: Elaboracion[]
  productos: Producto[]
  tenantId: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EstadoBadge({ actual, minimo }: { actual: number; minimo: number | null }) {
  if (actual <= 0) return <Badge variant="destructive">Agotado</Badge>
  if (minimo !== null && actual <= minimo)
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Bajo mínimo</Badge>
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>
}

function unidadLabel(p: Producto) {
  return p.unidadBase ?? p.contenidoUnidad ?? p.unidadMedida
}

// ── Modal: Registrar producción ───────────────────────────────────────────────

function ModalProduccion({ elaboracion, tenantId }: { elaboracion: Elaboracion; tenantId: number }) {
  const router = useRouter()
  const [cantidad, setCantidad] = useState('')
  const [caducidad, setCaducidad] = useState('')
  const [notas, setNotas] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleProducir = () => {
    const cant = parseFloat(cantidad)
    if (isNaN(cant) || cant <= 0) return

    startTransition(async () => {
      const res = await producirElaboracion({
        elaboracionId: elaboracion.id,
        cantidadProducida: cant,
        fechaCaducidad: caducidad ? new Date(caducidad) : undefined,
        notas: notas || undefined,
      })

      if (res.ok) {
        setMensaje({ ok: true, texto: `Lote #${res.loteElaboracionId} creado — ${cant} ${elaboracion.unidadBase}` })
        setCantidad('')
        setCaducidad('')
        setNotas('')
        router.refresh()
      } else if (res.ingredientesFallidos.length > 0) {
        setMensaje({
          ok: false,
          texto: `Lote creado con stock insuficiente en: ${res.ingredientesFallidos.join(', ')}`,
        })
        router.refresh()
      } else {
        setMensaje({ ok: false, texto: res.error ?? 'Error desconocido' })
      }
    })
  }

  const cantNum = parseFloat(cantidad) || 0

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMensaje(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Registrar producción</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Producción — {elaboracion.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mensaje && (
            <div className={`rounded px-3 py-2 text-sm ${mensaje.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              {mensaje.texto}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cantidad producida ({elaboracion.unidadBase})</Label>
            <Input
              type="number"
              min="0.001"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 5000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de caducidad <span className="text-muted-foreground">(opcional)</span></Label>
            <Input type="date" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground">(opcional)</span></Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Batch tarde del martes" />
          </div>

          {cantNum > 0 && elaboracion.ingredientes.length > 0 && (
            <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
              <p className="font-medium text-muted-foreground mb-1">Se consumirá del inventario:</p>
              {elaboracion.ingredientes.map((ing) => (
                <p key={ing.id}>
                  • {ing.producto.nombre}:{' '}
                  <strong>{(ing.cantidad * cantNum).toFixed(3)} {ing.unidad}</strong>
                </p>
              ))}
            </div>
          )}

          <Button onClick={handleProducir} disabled={!cantidad || isPending} className="w-full">
            {isPending ? 'Registrando...' : 'Confirmar producción'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal: Nueva elaboración ──────────────────────────────────────────────────

interface LineaIngrediente {
  uid: number
  productoId: number | null
  cantidad: string
  unidad: string
}

const UNIDADES_BASE = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidades' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'l', label: 'Litros (l)' },
]

function ModalNuevaElaboracion({ productos, tenantId }: { productos: Producto[]; tenantId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [unidadBase, setUnidadBase] = useState('g')
  const [stockMinimo, setStockMinimo] = useState('')
  const [lineas, setLineas] = useState<LineaIngrediente[]>([
    { uid: 1, productoId: null, cantidad: '', unidad: 'g' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const addLinea = () =>
    setLineas((prev) => [...prev, { uid: Date.now(), productoId: null, cantidad: '', unidad: 'g' }])

  const removeLinea = (uid: number) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid))

  const updateLinea = (uid: number, campo: Partial<LineaIngrediente>) =>
    setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...campo } : l)))

  const resetForm = () => {
    setNombre('')
    setDescripcion('')
    setUnidadBase('g')
    setStockMinimo('')
    setLineas([{ uid: 1, productoId: null, cantidad: '', unidad: 'g' }])
    setError(null)
  }

  const handleCrear = () => {
    const ingredientesValidos = lineas.filter(
      (l) => l.productoId !== null && parseFloat(l.cantidad) > 0
    )
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (ingredientesValidos.length === 0) { setError('Añade al menos un ingrediente con cantidad'); return }

    startTransition(async () => {
      const res = await crearElaboracion({
        nombre,
        descripcion: descripcion || undefined,
        unidadBase,
        stockMinimo: stockMinimo ? parseFloat(stockMinimo) : undefined,
        ingredientes: ingredientesValidos.map((l) => ({
          productoId: l.productoId!,
          cantidad: parseFloat(l.cantidad),
          unidad: l.unidad,
        })),
      })

      if (res.ok) {
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error ?? 'Error al crear')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger asChild>
        <Button>+ Nueva elaboración</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva elaboración</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Datos básicos */}
          <div className="space-y-1.5">
            <Label>Nombre <span className="text-destructive">*</span></Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pulled pork, Salsa base, Masa de pan..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas sobre la elaboración"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidad de stock <span className="text-destructive">*</span></Label>
              <Select value={unidadBase} onValueChange={setUnidadBase}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_BASE.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los lotes de producción se medirán en esta unidad
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Stock mínimo ({unidadBase}) <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="Ej: 2000"
              />
              <p className="text-xs text-muted-foreground">
                Genera alerta cuando el stock baje de aquí
              </p>
            </div>
          </div>

          {/* Ingredientes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                Ingredientes <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Cantidad por unidad de {unidadBase} producida
              </p>
            </div>

            <div className="space-y-2">
              {lineas.map((linea, i) => {
                const prodSel = productos.find((p) => p.id === linea.productoId)
                return (
                  <div key={linea.uid} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    {/* Producto */}
                    <Select
                      value={linea.productoId?.toString() ?? ''}
                      onValueChange={(v) => {
                        const p = productos.find((p) => p.id === parseInt(v, 10))
                        updateLinea(linea.uid, {
                          productoId: parseInt(v, 10),
                          unidad: p ? unidadLabel(p) : 'g',
                        })
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Producto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {productos.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Cantidad */}
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={linea.cantidad}
                      onChange={(e) => updateLinea(linea.uid, { cantidad: e.target.value })}
                      placeholder="Cant."
                      className="w-24 text-sm"
                    />

                    {/* Unidad (auto-rellena del producto, editable) */}
                    <Input
                      value={linea.unidad}
                      onChange={(e) => updateLinea(linea.uid, { unidad: e.target.value })}
                      placeholder="g"
                      className="w-16 text-sm text-center"
                      title="Unidad de medida del ingrediente"
                    />

                    {/* Eliminar */}
                    {lineas.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLinea(linea.uid)}
                        className="text-muted-foreground hover:text-destructive text-lg leading-none"
                        title="Eliminar ingrediente"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="w-5" />
                    )}
                  </div>
                )
              })}
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={addLinea} className="text-xs">
              + Añadir ingrediente
            </Button>
          </div>

          {/* Resumen */}
          {nombre && lineas.some((l) => l.productoId && parseFloat(l.cantidad) > 0) && (
            <div className="bg-muted/50 rounded p-3 text-xs space-y-1 text-muted-foreground">
              <p className="font-medium">Para producir 1 {unidadBase} de <em>{nombre}</em>:</p>
              {lineas
                .filter((l) => l.productoId && parseFloat(l.cantidad) > 0)
                .map((l) => {
                  const p = productos.find((p) => p.id === l.productoId)
                  return (
                    <p key={l.uid}>• {p?.nombre}: {l.cantidad} {l.unidad}</p>
                  )
                })}
            </div>
          )}

          <Button onClick={handleCrear} disabled={isPending} className="w-full">
            {isPending ? 'Creando...' : 'Crear elaboración'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ElaboracionesContent({ elaboraciones, productos, tenantId }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Elaboraciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Producciones propias — cada lote cuenta en el stock igual que un producto
          </p>
        </div>
        <ModalNuevaElaboracion productos={productos} tenantId={tenantId} />
      </div>

      {elaboraciones.length === 0 && (
        <div className="border border-dashed rounded-lg p-10 text-center">
          <p className="text-muted-foreground text-sm">No hay elaboraciones todavía.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea una para empezar a registrar producciones y controlar su stock.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {elaboraciones.map((e) => (
          <div key={e.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{e.nombre}</span>
                <EstadoBadge actual={e.stockActual} minimo={e.stockMinimo} />
              </div>

              <p className="text-sm text-muted-foreground">
                Stock:{' '}
                <strong>{e.stockActual.toFixed(1)} {e.unidadBase}</strong>
                {e.stockMinimo !== null && (
                  <span> · mín. {e.stockMinimo} {e.unidadBase}</span>
                )}
                {e.proximaCaducidad && (
                  <span> · Caduca {new Date(e.proximaCaducidad).toLocaleDateString('es-ES')}</span>
                )}
              </p>

              {e.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5">{e.descripcion}</p>
              )}

              {/* Ingredientes resumidos */}
              {e.ingredientes.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Ingredientes: {e.ingredientes.map((i) => `${i.producto.nombre} (${i.cantidad} ${i.unidad})`).join(' · ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 mt-1">
              <Link href={`/elaboraciones/${e.id}/lotes`}>
                <Button size="sm" variant="ghost">Ver lotes</Button>
              </Link>
              <ModalProduccion elaboracion={e} tenantId={tenantId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

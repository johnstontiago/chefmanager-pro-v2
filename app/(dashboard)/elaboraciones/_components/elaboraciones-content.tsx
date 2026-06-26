'use client'

import { useState, useTransition } from 'react'
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
import { producirElaboracion } from '@/lib/elaboraciones/producirElaboracion'
import Link from 'next/link'

type Ingrediente = {
  id: number
  cantidad: number
  unidad: string
  producto: { id: number; nombre: string; unidadMedida: string }
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
  tenantId: number
}

function EstadoBadge({ actual, minimo }: { actual: number; minimo: number | null }) {
  if (actual <= 0) return <Badge variant="destructive">Agotado</Badge>
  if (minimo && actual <= minimo) return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Bajo mínimo</Badge>
  return <Badge variant="secondary" className="bg-green-100 text-green-800">OK</Badge>
}

function ModalProduccion({ elaboracion }: { elaboracion: Elaboracion }) {
  const [cantidad, setCantidad] = useState('')
  const [caducidad, setCaducidad] = useState('')
  const [notas, setNotas] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleProducir = () => {
    const cant = parseFloat(cantidad)
    if (isNaN(cant) || cant <= 0) return

    startTransition(async () => {
      const res = await producirElaboracion({
        tenantId: elaboracion.id,
        elaboracionId: elaboracion.id,
        cantidadProducida: cant,
        fechaCaducidad: caducidad ? new Date(caducidad) : undefined,
        notas: notas || undefined,
      })

      if (res.ok) {
        setResultado(`Lote creado (ID: ${res.loteElaboracionId})`)
        setCantidad('')
        setCaducidad('')
        setNotas('')
      } else if (res.ingredientesFallidos.length > 0) {
        setResultado(
          `Lote creado con stock insuficiente en: ${res.ingredientesFallidos.join(', ')}`
        )
      } else {
        setResultado(res.error ?? 'Error desconocido')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Registrar producción
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Producción — {elaboracion.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {resultado && (
            <p className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">
              {resultado}
            </p>
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
            <Label>Fecha de caducidad</Label>
            <Input
              type="date"
              value={caducidad}
              onChange={(e) => setCaducidad(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Ingredientes que se consumirán:</p>
            {elaboracion.ingredientes.map((ing) => (
              <p key={ing.id}>
                • {ing.producto.nombre}: {ing.cantidad} {ing.unidad}
                {parseFloat(cantidad) > 0
                  ? ` × ${parseFloat(cantidad)} = ${(ing.cantidad * parseFloat(cantidad)).toFixed(3)} ${ing.unidad}`
                  : ''}
              </p>
            ))}
          </div>
          <Button
            onClick={handleProducir}
            disabled={!cantidad || isPending}
            className="w-full"
          >
            {isPending ? 'Produciendo...' : 'Confirmar producción'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function ElaboracionesContent({ elaboraciones, tenantId }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Elaboraciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Producciones propias con trazabilidad de lotes
          </p>
        </div>
      </div>

      {elaboraciones.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay elaboraciones configuradas aún.
        </p>
      )}

      <div className="space-y-3">
        {elaboraciones.map((e) => (
          <div
            key={e.id}
            className="border rounded-lg p-4 flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{e.nombre}</span>
                <EstadoBadge actual={e.stockActual} minimo={e.stockMinimo} />
              </div>
              <p className="text-sm text-muted-foreground">
                Stock:{' '}
                <strong>
                  {e.stockActual.toFixed(1)} {e.unidadBase}
                </strong>
                {e.stockMinimo && ` (mín. ${e.stockMinimo} ${e.unidadBase})`}
                {e.proximaCaducidad && (
                  <span className="ml-3">
                    · Caduca: {new Date(e.proximaCaducidad).toLocaleDateString('es-ES')}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/elaboraciones/${e.id}/lotes`}>
                <Button size="sm" variant="ghost">
                  Ver lotes
                </Button>
              </Link>
              <ModalProduccion elaboracion={e} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

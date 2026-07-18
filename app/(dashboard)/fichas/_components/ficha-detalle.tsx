"use client";

import { useState } from "react";
import { Clock, Users, Euro, Printer, BookOpen, Soup, ListOrdered, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALERGENOS } from "./alergenos-selector";
import { formatCurrency } from "@/lib/utils";

interface Preparacion {
  id: number;
  nombre: string;
  porciones: number;
  costoTotal: number;
  costoPorPorcion: number;
  procedimiento?: string | null;
  ingredientes: Array<{
    id: number;
    cantidad: number;
    insumo: { nombre: string; unidad: string };
  }>;
}

interface FichaDetalleProps {
  ficha: {
    id: number;
    nombre: string;
    descripcion?: string | null;
    porciones: number;
    tiempoMin: number;
    tiempoMiseEnPlace?: number | null;
    pvp?: number | null;
    urlImagen?: string | null;
    alergenos: string[];
    procedimiento?: string | null;
    tecnicas?: string | null;
    puntosCriticos?: string | null;
    presentacion?: string | null;
    conservacion?: string | null;
    costoTotal: number;
    costoPorPorcion: number;
    categoria?: { id: number; nombre: string } | null;
    ingredientes: Array<{
      id: number;
      cantidad: number;
      costoCalculado: number;
      insumo: {
        id: number;
        nombre: string;
        unidad: string;
        valorPorUnidad: number;
        esPreparacion?: boolean;
        preparacionId?: number | null;
        productoId?: number | null;
      };
    }>;
    creadoPor?: { nombre: string } | null;
  };
}

export function FichaDetalle({ ficha }: FichaDetalleProps) {
  const [preparacionModal, setPreparacionModal] = useState<Preparacion | null>(null);
  const [loadingPrep, setLoadingPrep] = useState(false);

  async function verPreparacion(preparacionId: number) {
    setLoadingPrep(true);
    try {
      const res = await fetch(`/api/fichas-tecnicas/preparaciones/${preparacionId}`);
      if (res.ok) {
        const data = await res.json();
        setPreparacionModal(data);
      }
    } finally {
      setLoadingPrep(false);
    }
  }

  function exportarPDF() {
    window.open(`/api/fichas-tecnicas/fichas/${ficha.id}/pdf`, "_blank");
  }

  const alergenosPresentes = ficha.alergenos
    .map((a) => ALERGENOS.find((al) => al.id === a))
    .filter(Boolean);

  const procedimientoLineas = ficha.procedimiento
    ? ficha.procedimiento.split("\n").filter((l) => l.trim())
    : [];

  return (
    <div className="space-y-6">
      {ficha.urlImagen && (
        <div className="relative h-56 rounded-lg overflow-hidden bg-muted">
          <img
            src={ficha.urlImagen}
            alt={ficha.nombre}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground break-words">{ficha.nombre}</h2>
          {ficha.categoria && (
            <Badge className="mt-1 bg-blue-100 text-blue-700 border-blue-200" variant="outline">
              {ficha.categoria.nombre}
            </Badge>
          )}
          {ficha.descripcion && (
            <p className="text-muted-foreground text-sm mt-2">{ficha.descripcion}</p>
          )}
        </div>
        <Button onClick={exportarPDF} variant="outline" className="flex-shrink-0 min-h-[44px]">
          <Printer className="h-4 w-4 mr-1" />
          PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Porciones", value: String(ficha.porciones) },
          { label: "Tiempo total", value: `${ficha.tiempoMin} min` },
          ...(ficha.tiempoMiseEnPlace ? [{ label: "Mise en place", value: `${ficha.tiempoMiseEnPlace} min` }] : []),
          { label: "Costo/Porción", value: formatCurrency(ficha.costoPorPorcion) },
          ...(ficha.pvp ? [{ label: "PVP", value: formatCurrency(ficha.pvp) }] : []),
        ].map((item) => (
          <div
            key={item.label}
            className="bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3 text-center"
          >
            <p className="text-xs text-blue-600 font-medium">{item.label}</p>
            <p className="text-lg font-bold text-blue-800">{item.value}</p>
          </div>
        ))}
      </div>

      {ficha.ingredientes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            Ingredientes
          </h3>
          <div className="space-y-2">
            {ficha.ingredientes.map((ing) => (
              <div
                key={ing.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted border border-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {ing.insumo.esPreparacion && (
                    <Soup className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  )}
                  {ing.insumo.productoId != null && (
                    <Package className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  )}
                  <span className="text-sm text-foreground font-medium truncate">
                    {ing.insumo.nombre}
                  </span>
                  {ing.insumo.esPreparacion && ing.insumo.preparacionId != null && (
                    <button
                      onClick={() => verPreparacion(ing.insumo.preparacionId!)}
                      disabled={loadingPrep}
                      className="flex-shrink-0 flex items-center gap-1 min-h-[44px] px-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                      title="Ver cómo hacer esta preparación"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span className="hidden sm:inline">Ver receta</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm text-muted-foreground">
                    {ing.cantidad} {ing.insumo.unidad}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium w-16 text-right">
                    {formatCurrency(ing.costoCalculado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-600">Total: </span>
              <span className="text-sm font-bold text-blue-800">
                {formatCurrency(ficha.costoTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {alergenosPresentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            Alérgenos
          </h3>
          <div className="flex flex-wrap gap-2">
            {alergenosPresentes.map((a) => (
              <div
                key={a!.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full"
              >
                <span className="text-sm">{a!.emoji}</span>
                <span className="text-xs font-medium text-yellow-800">{a!.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {procedimientoLineas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            Procedimiento
          </h3>
          <ol className="space-y-2">
            {procedimientoLineas.map((linea, i) => (
              <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-relaxed pt-0.5">
                  {linea.replace(/^\d+\.\s*/, "")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {ficha.tecnicas && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span>🔥</span> Técnicas culinarias
          </h3>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-foreground whitespace-pre-line">
            {ficha.tecnicas}
          </div>
        </div>
      )}

      {ficha.puntosCriticos && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span>⚠️</span> Puntos críticos
          </h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-foreground whitespace-pre-line">
            {ficha.puntosCriticos}
          </div>
        </div>
      )}

      {ficha.presentacion && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span>🍽️</span> Presentación y emplatado
          </h3>
          <div className="bg-muted border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-line">
            {ficha.presentacion}
          </div>
        </div>
      )}

      {ficha.conservacion && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span>❄️</span> Conservación
          </h3>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-foreground whitespace-pre-line">
            {ficha.conservacion}
          </div>
        </div>
      )}

      {ficha.creadoPor && (
        <div className="text-xs text-muted-foreground text-right">
          Creado por: {ficha.creadoPor.nombre}
        </div>
      )}

      {/* Modal de preparación base */}
      <Dialog open={!!preparacionModal} onOpenChange={(o) => !o && setPreparacionModal(null)}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Soup className="h-5 w-5 text-blue-600" />
              {preparacionModal?.nombre}
            </DialogTitle>
          </DialogHeader>

          {preparacionModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-blue-600">Porciones</p>
                  <p className="font-bold text-blue-800">{preparacionModal.porciones}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-blue-600">Costo total</p>
                  <p className="font-bold text-blue-800 text-sm">
                    {formatCurrency(preparacionModal.costoTotal)}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-blue-600">Costo/ración</p>
                  <p className="font-bold text-blue-800 text-sm">
                    {formatCurrency(preparacionModal.costoPorPorcion)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Ingredientes
                </h4>
                <div className="space-y-1.5">
                  {preparacionModal.ingredientes.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between py-1.5 px-3 bg-muted rounded-lg border border-border text-sm"
                    >
                      <span className="text-foreground font-medium">{ing.insumo.nombre}</span>
                      <span className="text-muted-foreground">
                        {ing.cantidad} {ing.insumo.unidad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {preparacionModal.procedimiento && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Procedimiento
                  </h4>
                  <ol className="space-y-1.5">
                    {preparacionModal.procedimiento
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((linea, i) => (
                        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="pt-0.5 leading-relaxed">
                            {linea.replace(/^\d+\.\s*/, "")}
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Preparación base · rinde {preparacionModal.porciones} {preparacionModal.porciones === 1 ? "porción" : "porciones"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

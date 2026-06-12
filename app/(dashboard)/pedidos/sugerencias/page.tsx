"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  PartyPopper,
  ShoppingCart,
  TrendingUp,
  Plus,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface Sugerencia {
  productoId: number;
  nombre: string;
  unidadMedida: string;
  precioUnitario: number;
  consumoSemanalPrevisto: number;
  stockDisponible: number;
  colchonSeguridad: number;
  cantidadSugerida: number;
  fuente: "consumo" | "compras";
  semanasConDatos: number;
}

interface Festivo {
  id?: number;
  fecha: string;
  nombre: string;
  factor: number;
}

interface LineaEditable extends Sugerencia {
  incluida: boolean;
  cantidad: string;
}

export default function SugerenciasPedidoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [festivosSemana, setFestivosSemana] = useState<Festivo[]>([]);
  const [factorFestivo, setFactorFestivo] = useState(1);
  const [proximosFestivos, setProximosFestivos] = useState<Festivo[]>([]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalFestivos, setModalFestivos] = useState(false);
  const [nuevoFestivo, setNuevoFestivo] = useState({ fecha: "", nombre: "", factor: "1.25" });
  const [guardandoFestivo, setGuardandoFestivo] = useState(false);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [sugRes, festRes] = await Promise.all([
        apiFetch("/api/predicciones/sugerencias"),
        apiFetch("/api/predicciones/festivos"),
      ]);
      if (!sugRes.ok) {
        const err = await sugRes.json();
        setError(err.error || "Error al generar sugerencias");
        return;
      }
      const data = await sugRes.json();
      setLineas(
        (data.lineas || []).map((l: Sugerencia) => ({
          ...l,
          incluida: true,
          cantidad: String(l.cantidadSugerida),
        }))
      );
      setFestivosSemana(data.festivos || []);
      setFactorFestivo(data.factorFestivo || 1);
      if (festRes.ok) {
        const fest = await festRes.json();
        if (Array.isArray(fest)) setProximosFestivos(fest);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionadas = lineas.filter((l) => l.incluida && parseFloat(l.cantidad) > 0);
  const totalEstimado = seleccionadas.reduce(
    (acc, l) => acc + (parseFloat(l.cantidad) || 0) * l.precioUnitario,
    0
  );

  async function crearBorrador() {
    if (seleccionadas.length === 0) return;
    setCreando(true);
    try {
      const res = await apiFetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "borrador",
          notas: `Generado por sugerencias automáticas (${new Date().toLocaleDateString("es-ES")})${
            festivosSemana.length > 0
              ? ` · Festivo próximo: ${festivosSemana.map((f) => f.nombre).join(", ")}`
              : ""
          }`,
          items: seleccionadas.map((l) => ({
            productoId: l.productoId,
            cantidad: parseFloat(l.cantidad),
            precioUnitario: l.precioUnitario,
          })),
        }),
      });
      if (res.ok) {
        toast({
          title: "Borrador de pedido creado",
          description: `${seleccionadas.length} producto(s). Revísalo y envíalo desde Pedidos.`,
        });
        router.push("/pedidos");
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al crear el borrador", variant: "destructive" });
    } finally {
      setCreando(false);
    }
  }

  async function agregarFestivo(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoFestivo(true);
    try {
      const res = await apiFetch("/api/predicciones/festivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoFestivo),
      });
      if (res.ok) {
        toast({ title: "Festivo agregado" });
        setNuevoFestivo({ fecha: "", nombre: "", factor: "1.25" });
        cargar();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setGuardandoFestivo(false);
    }
  }

  async function eliminarFestivo(id: number) {
    try {
      const res = await apiFetch(`/api/predicciones/festivos/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Festivo eliminado" });
        cargar();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Sugerencias de pedido
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Basadas en tu consumo y compras de las últimas 12 semanas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalFestivos(true)}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Festivos
          </Button>
          <Link href="/pedidos">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Pedidos
            </Button>
          </Link>
        </div>
      </div>

      {festivosSemana.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <PartyPopper className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">
              Festivo en los próximos 7 días — sugerencias aumentadas ×{factorFestivo}
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              {festivosSemana.map((f) => `${f.nombre} (${f.fecha})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white rounded-lg border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-red-600">{error}</p>
        </div>
      ) : lineas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">Sin sugerencias por ahora</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            No hay necesidad de reponer según el historial, o aún falta historial de
            consumo y pedidos. Las sugerencias mejoran cuando la cocina registra los
            consumos en el módulo Consumo.
          </p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{lineas.length} producto(s) con reposición sugerida</span>
                <span className="text-sm font-normal text-slate-500">
                  Marca, ajusta cantidades y crea el borrador
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lineas.map((linea, idx) => (
                <div
                  key={linea.productoId}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
                    linea.incluida ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={linea.incluida}
                      onCheckedChange={(c) => {
                        setLineas(lineas.map((l, i) => (i === idx ? { ...l, incluida: !!c } : l)));
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{linea.nombre}</p>
                      <p className="text-xs text-slate-500">
                        Previsto: {linea.consumoSemanalPrevisto} {linea.unidadMedida}/sem · Stock:{" "}
                        {linea.stockDisponible} · Colchón: {linea.colchonSeguridad}
                        {factorFestivo > 1 && " · ×" + factorFestivo + " festivo"}
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] ${
                          linea.fuente === "consumo"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {linea.fuente === "consumo"
                          ? `Consumo real (${linea.semanasConDatos} sem)`
                          : `Ritmo de compra (${linea.semanasConDatos} sem)`}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={linea.cantidad}
                      disabled={!linea.incluida}
                      onChange={(e) =>
                        setLineas(lineas.map((l, i) => (i === idx ? { ...l, cantidad: e.target.value } : l)))
                      }
                      className="w-24 h-10"
                    />
                    <span className="text-xs text-slate-400 w-16">{linea.unidadMedida}</span>
                    <span className="text-sm text-slate-600 font-medium w-20 text-right">
                      {formatCurrency((parseFloat(linea.cantidad) || 0) * linea.precioUnitario)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="sticky bottom-4 bg-white border border-slate-200 rounded-lg shadow-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">
                {seleccionadas.length} producto(s) seleccionado(s)
              </p>
              <p className="text-lg font-bold text-slate-900">
                Total estimado: {formatCurrency(totalEstimado)}
              </p>
            </div>
            <Button
              onClick={crearBorrador}
              disabled={seleccionadas.length === 0 || creando}
              className="bg-blue-600 hover:bg-blue-700 min-h-[44px]"
            >
              {creando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Crear borrador de pedido
            </Button>
          </div>
        </>
      )}

      {/* Gestión de festivos */}
      <Dialog open={modalFestivos} onOpenChange={setModalFestivos}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Festivos y eventos
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">
            En semanas con festivo, las sugerencias se multiplican por el factor.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {proximosFestivos.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">Sin festivos próximos</p>
            )}
            {proximosFestivos.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-800">{f.nombre}</span>
                  <span className="text-slate-400 ml-2">{f.fecha}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">×{f.factor}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => f.id && eliminarFestivo(f.id)}
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={agregarFestivo} className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha *</Label>
                <Input
                  type="date"
                  value={nuevoFestivo.fecha}
                  onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Factor</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  step="0.05"
                  value={nuevoFestivo.factor}
                  onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, factor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input
                placeholder="Ej: Fiestas de San Juan, evento privado..."
                value={nuevoFestivo.nombre}
                onChange={(e) => setNuevoFestivo({ ...nuevoFestivo, nombre: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={guardandoFestivo} className="w-full">
                {guardandoFestivo ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar festivo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

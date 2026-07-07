"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Soup, Loader2, Printer, Bluetooth, Tag, Package, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { formatDate, formatDecimal } from "@/lib/utils";
import { producirElaboracion } from "@/lib/elaboraciones/producirElaboracion";
import { canEditFichas } from "@/lib/fichas/roles";

type Elaboracion = {
  id: number; nombre: string; unidadBase: string;
  contenidoNeto: number | null; contenidoUnidad: string | null;
  ingredientes: {
    id: number; cantidad: number; unidad: string;
    producto: { id: number; nombre: string } | null;
    insumo: { id: number; nombre: string } | null;
    cantidadEnUnidadInsumo: number | null; unidadInsumo: string | null;
  }[];
};
type Produccion = {
  id: number; elaboracionNombre: string; unidadBase: string;
  cantidadInicial: number; cantidadActual: number;
  numeroLote: string | null; numeroEnvases: number | null; codigoUnico: string | null;
  fechaProduccion: string; fechaCaducidad: string | null; agotado: boolean;
};
interface Props { elaboraciones: Elaboracion[]; producciones: Produccion[]; rol: string; }

export default function PreparacionesManager({ elaboraciones, producciones, rol }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = canEditFichas(rol);
  const {
    status: printerStatus, deviceName, isSupported: btSupported, lastError,
    connect: connectPrinter, printLabel,
  } = useBluetoothPrinter();

  const handleConnect = async () => {
    await connectPrinter();
  };

  const [open, setOpen] = useState(false);
  const [elaboracionId, setElaboracionId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [numeroEnvases, setNumeroEnvases] = useState("1");
  const [caducidad, setCaducidad] = useState("");
  const [notas, setNotas] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [detalle, setDetalle] = useState<any | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const abrirDetalle = async (id: number) => {
    setDetalleLoading(true);
    setDetalle({ id });
    try {
      const res = await fetch(`/api/preparaciones/${id}`);
      if (res.ok) setDetalle(await res.json());
      else { setDetalle(null); toast({ title: "No se pudo cargar el detalle", variant: "destructive" }); }
    } catch {
      setDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  };

  const elaboracion = elaboraciones.find((e) => e.id === elaboracionId) ?? null;
  const cantNum = parseFloat(cantidad) || 0;
  const envases = parseInt(numeroEnvases, 10) || 1;

  const reset = () => {
    setElaboracionId(null); setCantidad(""); setNumeroLote(""); setNumeroEnvases("1");
    setCaducidad(""); setNotas(""); setMensaje(null);
  };

  // Imprime una etiqueta por envase. OJO: el endpoint TSPL usa `cantidad` como
  // número de COPIAS (PRINT 1,cantidad), así que aquí `cantidad` = nº de envases.
  // No hay que repetir en bucle (eso multiplicaría las copias).
  const imprimirEtiquetas = async (p: {
    nombre: string; lote: string; codigoUnico: string; cadEmbalaje: string; copias: number;
  }) => {
    if (printerStatus !== "connected") {
      toast({ title: "Conecta la impresora primero", variant: "destructive" });
      return;
    }
    const copias = Math.max(1, Math.round(p.copias));
    try {
      await printLabel({
        nombre: p.nombre,
        fabricante: "",
        lote: p.lote,
        cadEmbalaje: p.cadEmbalaje,
        codigoUnico: p.codigoUnico,
        cantidad: copias,
        variant: "consumo",
      });
      toast({ title: `${copias} etiqueta(s) impresa(s)` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de impresión";
      toast({ title: "Error al imprimir", description: msg, variant: "destructive" });
    }
  };

  const handleProducir = () => {
    if (!elaboracion || cantNum <= 0) return;
    startTransition(async () => {
      const res = await producirElaboracion({
        elaboracionId: elaboracion.id,
        cantidadProducida: cantNum,
        fechaCaducidad: caducidad ? new Date(caducidad) : undefined,
        notas: notas || undefined,
        numeroLote: numeroLote || undefined,
        numeroEnvases: envases,
      });

      if (res.ok || res.loteElaboracionId) {
        const aviso = res.stockInsuficiente
          ? `Producción creada con stock insuficiente en: ${res.ingredientesFallidos.join(", ")}`
          : `Producción creada · ${envases} envase(s)`;
        setMensaje({ ok: !res.stockInsuficiente, texto: aviso });

        // Imprimir si hay impresora
        if (printerStatus === "connected" && res.codigoUnico) {
          await imprimirEtiquetas({
            nombre: elaboracion.nombre,
            lote: numeroLote || `L${res.loteElaboracionId}`,
            codigoUnico: res.codigoUnico,
            cadEmbalaje: caducidad,
            copias: envases,
          });
        }
        router.refresh();
        // Mantener el modal con el aviso; limpiar campos de cantidad/lote
        setCantidad(""); setNumeroLote(""); setNumeroEnvases("1"); setCaducidad(""); setNotas("");
      } else {
        setMensaje({ ok: false, texto: res.error ?? "Error al producir" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {btSupported ? (
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={handleConnect}
              disabled={printerStatus === "connecting" || printerStatus === "printing"}
              className={printerStatus === "connected" ? "border-green-500 text-green-600" : ""}>
              {printerStatus === "connecting" || printerStatus === "printing"
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : printerStatus === "connected" ? <Bluetooth className="w-4 h-4 mr-1" /> : <Printer className="w-4 h-4 mr-1" />}
              {printerStatus === "connected" ? (deviceName ?? "Conectada") : "Conectar impresora"}
            </Button>
            {printerStatus === "error" && lastError && (
              <span className="text-xs text-red-600 max-w-xs flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{lastError}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-amber-600 flex items-center gap-1 max-w-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Este navegador no soporta impresión Bluetooth. Usa Chrome en Windows, Mac o Android.
          </span>
        )}
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="ml-auto"><Plus className="h-4 w-4 mr-2" />Nueva preparación</Button>
            </DialogTrigger>
            <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nueva preparación (producción)</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {mensaje && (
                  <div className={`rounded px-3 py-2 text-sm ${mensaje.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                    {mensaje.texto}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Elaboración *</Label>
                  <Select value={elaboracionId?.toString() ?? ""} onValueChange={(v) => setElaboracionId(parseInt(v, 10))}>
                    <SelectTrigger><SelectValue placeholder="Elige la elaboración a producir" /></SelectTrigger>
                    <SelectContent>
                      {elaboraciones.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {elaboracion && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Cantidad producida ({elaboracion.unidadBase}) *</Label>
                        <Input type="number" min="0.001" step="any" value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)} placeholder="Ej: 2000" />
                        {elaboracion.contenidoNeto && cantNum > 0 && (
                          <p className="text-[11px] text-slate-400">
                            ≈ {(cantNum * elaboracion.contenidoNeto).toFixed(0)} {elaboracion.contenidoUnidad} en total
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nº de envases/bolsas</Label>
                        <Input type="number" min="1" step="1" value={numeroEnvases}
                          onChange={(e) => setNumeroEnvases(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nº de lote</Label>
                        <Input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} placeholder="Ej: PP-20260627" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Caducidad</Label>
                        <Input type="date" value={caducidad} onChange={(e) => setCaducidad(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Notas</Label>
                      <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
                    </div>

                    {/* Ingredientes que se consumirán */}
                    {cantNum > 0 && (
                      <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
                        <p className="font-medium text-slate-600 flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />Se consumirá del inventario (FIFO):
                        </p>
                        {elaboracion.ingredientes.map((ing) => (
                          <p key={ing.id} className="text-slate-500">
                            • {ing.insumo?.nombre ?? ing.producto?.nombre ?? "?"}: <strong>{(ing.cantidad * cantNum).toFixed(3)} {ing.unidad}</strong>
                            {ing.cantidadEnUnidadInsumo != null && (
                              <span className="text-slate-400"> (≈ {(ing.cantidadEnUnidadInsumo * cantNum).toFixed(2)} {ing.unidadInsumo} de stock)</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}

                    {envases > 1 && cantNum > 0 && (
                      <p className="text-xs text-slate-500">
                        {envases} envases × {formatDecimal(cantNum / envases)} {elaboracion.unidadBase} cada uno
                        {printerStatus === "connected" && " · se imprimirán " + envases + " etiquetas"}
                      </p>
                    )}

                    <Button onClick={handleProducir} disabled={!cantidad || isPending} className="w-full">
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Producir{printerStatus === "connected" ? " e imprimir" : ""}
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Historial de producciones */}
      {producciones.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Soup className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay producciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {producciones.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => abrirDetalle(p.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 hover:text-blue-600">{p.elaboracionNombre}</h3>
                    {p.agotado
                      ? <Badge variant="destructive">Agotado</Badge>
                      : <Badge className="bg-green-100 text-green-800 hover:bg-green-100">En stock</Badge>}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {formatDecimal(p.cantidadActual)} / {formatDecimal(p.cantidadInicial)} {p.unidadBase}
                    {p.numeroEnvases ? ` · ${p.numeroEnvases} envase(s)` : ""}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-1">
                    {p.numeroLote && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{p.numeroLote}</span>}
                    <span>Prod: {formatDate(p.fechaProduccion)}</span>
                    {p.fechaCaducidad && <span>Cad: {formatDate(p.fechaCaducidad)}</span>}
                  </div>
                </button>
                {btSupported && p.codigoUnico && (
                  <Button variant="outline" size="sm" className="flex-shrink-0"
                    onClick={() => imprimirEtiquetas({
                      nombre: p.elaboracionNombre,
                      lote: p.numeroLote || `L${p.id}`,
                      codigoUnico: p.codigoUnico!,
                      cadEmbalaje: p.fechaCaducidad ? p.fechaCaducidad.slice(0, 10) : "",
                      copias: p.numeroEnvases || 1,
                    })}>
                    <Printer className="h-4 w-4 mr-1" />Etiquetas
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalle de la preparación: trazabilidad de ítems de inventario usados */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detalle?.elaboracionNombre ?? "Preparación"}
              {detalle?.numeroLote ? ` · ${detalle.numeroLote}` : ""}
            </DialogTitle>
          </DialogHeader>

          {detalleLoading || !detalle?.insumos ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Cabecera */}
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Producido" value={formatDate(detalle.fechaProduccion)} />
                <Stat label="Stock" value={`${formatDecimal(detalle.cantidadActual)} / ${formatDecimal(detalle.cantidadInicial)} ${detalle.unidadBase}`} />
                {detalle.numeroEnvases ? <Stat label="Envases" value={String(detalle.numeroEnvases)} /> : null}
                {detalle.fechaCaducidad ? <Stat label="Caducidad" value={formatDate(detalle.fechaCaducidad)} /> : null}
                {detalle.codigoUnico ? <Stat label="Código" value={detalle.codigoUnico} /> : null}
              </div>

              {/* Ítems de inventario consumidos (trazabilidad) */}
              <div>
                <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-amber-600" />Ítems de inventario usados
                </p>
                {detalle.insumos.length === 0 ? (
                  <p className="text-slate-500 text-xs">Sin datos de trazabilidad.</p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {detalle.insumos.map((ins: any) => (
                      <div key={ins.id} className="flex items-center justify-between px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{ins.productoNombre}</p>
                          <p className="text-xs text-slate-400 flex flex-wrap gap-x-2">
                            {ins.numeroLote && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />Lote {ins.numeroLote}</span>}
                            {ins.codigoUnico && <span>Cód: {ins.codigoUnico}</span>}
                            {!ins.numeroLote && !ins.codigoUnico && <span>Lote inv. #{ins.loteInventarioId}</span>}
                          </p>
                        </div>
                        <span className="font-semibold text-slate-700 flex-shrink-0">{formatDecimal(ins.cantidadUsada)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consumos posteriores */}
              {detalle.consumos?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Consumos</p>
                  <div className="border rounded-lg divide-y">
                    {detalle.consumos.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="text-slate-500">{formatDate(c.createdAt)}</span>
                        <span className={`px-1.5 py-0.5 rounded ${c.motivo === "VENTA" ? "bg-blue-100 text-blue-700" : c.motivo === "MERMA" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{c.motivo}</span>
                        <span className="font-semibold">{formatDecimal(c.cantidad)} {detalle.unidadBase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detalle.procedimiento && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Paso a paso</p>
                  <p className="text-xs text-slate-500 whitespace-pre-line">{detalle.procedimiento}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value}</p>
    </div>
  );
}

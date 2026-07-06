"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, Utensils, ListOrdered, Loader2, Package, Layers, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { crearElaboracion } from "@/lib/elaboraciones/crearElaboracion";
import { editarElaboracion, eliminarElaboracion } from "@/lib/elaboraciones/gestionElaboracion";
import { canEditFichas, canDeleteFichas } from "@/lib/fichas/roles";

type Producto = {
  id: number; nombre: string; unidadMedida: string;
  unidadBase: string | null; contenidoUnidad: string | null;
};
type InsumoOpcion = {
  id: number; nombre: string; unidad: string;
  productoId: number | null; elaboracionId: number | null; preparacionId: number | null;
};
type Ingrediente = {
  id: number; cantidad: number; unidad: string;
  producto: Producto | null; insumo: { id: number; nombre: string; unidad: string } | null;
};
type Elaboracion = {
  id: number; nombre: string; descripcion: string | null; procedimiento: string | null;
  unidadBase: string; stockMinimo: number | null; stockActual: number;
  ingredientes: Ingrediente[];
};
interface Props { elaboraciones: Elaboracion[]; insumos: InsumoOpcion[]; rol: string; }

const UNIDADES_BASE = [
  { value: "g", label: "Gramos (g)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "unidad", label: "Unidades" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "l", label: "Litros (l)" },
];

// Icono según el origen del insumo, para distinguirlo en el picker.
function IconoOrigen({ insumo }: { insumo: InsumoOpcion }) {
  if (insumo.productoId != null) return <Package className="h-3 w-3 text-emerald-600" />;
  if (insumo.elaboracionId != null) return <Layers className="h-3 w-3 text-blue-600" />;
  return <FlaskConical className="h-3 w-3 text-amber-600" />;
}

interface LineaIng { uid: number; insumoId: number | null; cantidad: string; unidad: string; }

export default function ElaboracionesManager({ elaboraciones, insumos, rol }: Props) {
  const router = useRouter();
  const canEdit = canEditFichas(rol);
  const canDelete = canDeleteFichas(rol);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [unidadBase, setUnidadBase] = useState("g");
  const [stockMinimo, setStockMinimo] = useState("");
  const [procedimiento, setProcedimiento] = useState("");
  const [lineas, setLineas] = useState<LineaIng[]>([{ uid: 1, insumoId: null, cantidad: "", unidad: "g" }]);
  const [produccionLote, setProduccionLote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const resetForm = () => {
    setEditId(null); setNombre(""); setUnidadBase("g"); setStockMinimo("");
    setProcedimiento(""); setLineas([{ uid: 1, insumoId: null, cantidad: "", unidad: "g" }]);
    setProduccionLote(""); setError(null);
  };

  // Conversor: divide cada cantidad entre la producción del lote para obtener
  // la proporción por unidad. Conserva decimales para no anular ingredientes pequeños.
  const convertirProporciones = () => {
    const output = parseFloat(produccionLote);
    if (isNaN(output) || output <= 0) {
      setError("Indica la producción total del lote para convertir");
      return;
    }
    setError(null);
    setLineas((prev) =>
      prev.map((l) => {
        const cant = parseFloat(l.cantidad);
        if (isNaN(cant) || cant <= 0) return l;
        const ratio = cant / output;
        // 2 decimales; si quedaría 0 con un ingrediente real, sube precisión
        let texto = ratio.toFixed(2);
        if (parseFloat(texto) === 0) {
          for (let d = 3; d <= 6 && parseFloat(texto) === 0; d++) texto = ratio.toFixed(d);
        }
        return { ...l, cantidad: String(parseFloat(texto)) };
      })
    );
  };

  const openCrear = () => { resetForm(); setOpen(true); };
  const openEditar = (e: Elaboracion) => {
    setProduccionLote("");
    setEditId(e.id); setNombre(e.nombre); setUnidadBase(e.unidadBase);
    setStockMinimo(e.stockMinimo != null ? String(e.stockMinimo) : "");
    setProcedimiento(e.procedimiento || "");
    setLineas(e.ingredientes.map((i) => ({
      uid: i.id, insumoId: i.insumo?.id ?? i.producto?.id ?? null, cantidad: String(i.cantidad), unidad: i.unidad,
    })));
    setOpen(true);
  };

  const addLinea = () => setLineas((p) => [...p, { uid: Date.now(), insumoId: null, cantidad: "", unidad: "g" }]);
  const removeLinea = (uid: number) => setLineas((p) => p.filter((l) => l.uid !== uid));
  const updateLinea = (uid: number, c: Partial<LineaIng>) =>
    setLineas((p) => p.map((l) => (l.uid === uid ? { ...l, ...c } : l)));

  const handleGuardar = () => {
    const validos = lineas.filter((l) => l.insumoId !== null && parseFloat(l.cantidad) > 0);
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (validos.length === 0) { setError("Añade al menos un ingrediente con cantidad"); return; }

    const payload = {
      nombre,
      procedimiento: procedimiento || undefined,
      unidadBase,
      stockMinimo: stockMinimo ? parseFloat(stockMinimo) : undefined,
      ingredientes: validos.map((l) => ({
        insumoId: l.insumoId!, cantidad: parseFloat(l.cantidad), unidad: l.unidad,
      })),
    };

    startTransition(async () => {
      const res = editId
        ? await editarElaboracion({ id: editId, ...payload })
        : await crearElaboracion(payload);
      if (res.ok) { setOpen(false); resetForm(); router.refresh(); }
      else setError(res.error ?? "Error al guardar");
    });
  };

  const handleEliminar = () => {
    if (eliminando === null) return;
    startTransition(async () => {
      await eliminarElaboracion(eliminando);
      setEliminando(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCrear}><Plus className="h-4 w-4 mr-2" />Nueva elaboración</Button>
            </DialogTrigger>
            <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar elaboración" : "Nueva elaboración"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded px-3 py-2 text-sm">{error}</div>
                )}
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pulled Pork, Salsa base..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Unidad de stock *</Label>
                    <Select value={unidadBase} onValueChange={setUnidadBase}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES_BASE.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stock mínimo ({unidadBase})</Label>
                    <Input type="number" min="0" step="any" value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Ingredientes *</Label>
                    <span className="text-xs text-slate-400">por unidad de {unidadBase} producida</span>
                  </div>

                  {/* Conversor: receta real → proporciones por unidad */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                    <p className="text-xs text-blue-800 font-medium">
                      Conversor de proporciones
                    </p>
                    <p className="text-[11px] text-blue-700/80 leading-snug">
                      Pon las cantidades reales de un lote en los ingredientes, indica cuánto produjo
                      ese lote y pulsa convertir. Cada cantidad se divide entre la producción.
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Producción del lote ({unidadBase})</Label>
                        <Input type="number" min="0.001" step="any" value={produccionLote}
                          onChange={(e) => setProduccionLote(e.target.value)}
                          placeholder="Ej: 3500" className="mt-1 bg-white h-9" />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={convertirProporciones}
                        className="h-9 border-blue-300 text-blue-700">
                        Convertir a proporciones
                      </Button>
                    </div>
                  </div>

                  {lineas.map((l) => (
                    <div key={l.uid}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 border-b sm:border-0 pb-2 sm:pb-0">
                      <Select
                        value={l.insumoId?.toString() ?? ""}
                        onValueChange={(v) => {
                          const i = insumos.find((i) => i.id === parseInt(v, 10));
                          updateLinea(l.uid, { insumoId: parseInt(v, 10), unidad: i ? i.unidad : "g" });
                        }}>
                        <SelectTrigger className="text-sm w-full sm:flex-1"><SelectValue placeholder="Ingrediente..." /></SelectTrigger>
                        <SelectContent>
                          {insumos
                            .filter((i) => i.elaboracionId !== editId)
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id.toString()}>
                                <span className="flex items-center gap-1.5"><IconoOrigen insumo={i} />{i.nombre}</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Input type="number" min="0.001" step="any" value={l.cantidad}
                          onChange={(e) => updateLinea(l.uid, { cantidad: e.target.value })}
                          placeholder="Cant." className="flex-1 sm:w-24 text-sm" />
                        <Input value={l.unidad} onChange={(e) => updateLinea(l.uid, { unidad: e.target.value })}
                          className="w-16 text-sm text-center" />
                        {lineas.length > 1 ? (
                          <button type="button" onClick={() => removeLinea(l.uid)}
                            className="text-slate-400 hover:text-red-500 text-xl leading-none px-1 flex-shrink-0">×</button>
                        ) : <div className="w-6 flex-shrink-0" />}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={addLinea} className="text-xs">
                    <Plus className="h-3 w-3 mr-1" />Añadir ingrediente
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Paso a paso</Label>
                  <Textarea value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)} rows={5}
                    placeholder={"1. Salar la paleta...\n2. Confitar a 80°C durante 12h...\n3. Desmechar y enfriar..."} />
                </div>

                <Button onClick={handleGuardar} disabled={isPending} className="w-full">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editId ? "Guardar cambios" : "Crear elaboración"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {elaboraciones.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Utensils className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay elaboraciones todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elaboraciones.map((e) => (
            <div key={e.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{e.nombre}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Stock: <strong>{e.stockActual.toFixed(1)} {e.unidadBase}</strong>
                    {e.stockMinimo != null && ` · mín. ${e.stockMinimo} ${e.unidadBase}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.ingredientes.map((i) => (
                      <span key={i.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {i.insumo?.nombre ?? i.producto?.nombre ?? "?"} × {i.cantidad} {i.unidad}
                      </span>
                    ))}
                  </div>
                  {e.procedimiento && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <ListOrdered className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                      <span className="line-clamp-2 whitespace-pre-line">{e.procedimiento}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => openEditar(e)}
                      className="h-10 w-10 text-slate-500 hover:text-slate-700"><Edit2 className="h-4 w-4" /></Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => setEliminando(e.id)}
                      className="h-10 w-10 text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={eliminando !== null} onOpenChange={(o) => !o && setEliminando(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar elaboración</AlertDialogTitle>
            <AlertDialogDescription>
              Si tiene producciones registradas se desactivará (se conserva la trazabilidad). Si no, se elimina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminar} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

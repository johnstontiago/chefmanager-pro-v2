"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Edit2, Trash2, Soup, Loader2, ListOrdered, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { canEditFichas, canDeleteFichas } from "@/lib/fichas/roles";
import { FichasNav } from "../_components/fichas-nav";

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  valorPorUnidad: number;
  esPreparacion: boolean;
  productoId?: number | null;
  preparacionId?: number | null;
}

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
    insumo: { id: number; nombre: string; unidad: string; valorPorUnidad: number };
  }>;
}

interface IngForm {
  insumoId: string;
  cantidad: string;
}

export default function PreparacionesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [preparaciones, setPreparaciones] = useState<Preparacion[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Preparacion | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [porciones, setPorciones] = useState("1");
  const [procedimiento, setProcedimiento] = useState("");
  const [ingredientes, setIngredientes] = useState<IngForm[]>([]);

  const rol = (session?.user as any)?.rol || "viewer";
  const canEdit = canEditFichas(rol);
  const canDelete = canDeleteFichas(rol);

  async function fetchData() {
    setLoading(true);
    try {
      const [prepRes, insRes] = await Promise.all([
        fetch("/api/fichas-tecnicas/preparaciones"),
        fetch("/api/fichas-tecnicas/insumos"),
      ]);
      if (prepRes.ok) {
        const preps = await prepRes.json();
        if (Array.isArray(preps)) setPreparaciones(preps);
      }
      if (insRes.ok) {
        const ins = await insRes.json();
        // Incluye preparaciones: pueden usarse como ingrediente de otra
        // preparación (ej: masa de pizza hecha con biga)
        if (Array.isArray(ins)) setInsumos(ins);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCrear() {
    setEditando(null);
    setNombre("");
    setPorciones("1");
    setProcedimiento("");
    setIngredientes([]);
    setModalOpen(true);
  }

  function openEditar(prep: Preparacion) {
    setEditando(prep);
    setNombre(prep.nombre);
    setPorciones(String(prep.porciones));
    setProcedimiento(prep.procedimiento || "");
    setIngredientes(
      prep.ingredientes.map((i) => ({
        insumoId: String(i.insumo.id),
        cantidad: String(i.cantidad),
      }))
    );
    setModalOpen(true);
  }

  // Al editar, la propia preparación no puede ser su ingrediente
  const insumosDisponibles = editando
    ? insumos.filter((i) => !(i.esPreparacion && i.preparacionId === editando.id))
    : insumos;

  const costoTotal = ingredientes.reduce((acc, ing) => {
    const insumo = insumos.find((i) => String(i.id) === ing.insumoId);
    return acc + (insumo ? insumo.valorPorUnidad * (parseFloat(ing.cantidad) || 0) : 0);
  }, 0);

  const costoPorPorcion = costoTotal / (parseFloat(porciones) || 1);

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editando
        ? `/api/fichas-tecnicas/preparaciones/${editando.id}`
        : "/api/fichas-tecnicas/preparaciones";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          porciones: parseFloat(porciones),
          procedimiento: procedimiento || null,
          ingredientes: ingredientes
            .filter((i) => i.insumoId)
            .map((i) => ({
              insumoId: parseInt(i.insumoId, 10),
              cantidad: parseFloat(i.cantidad) || 0,
            })),
        }),
      });
      if (res.ok) {
        toast({ title: editando ? "Preparación actualizada" : "Preparación creada" });
        setModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (eliminando === null) return;
    try {
      const res = await fetch(`/api/fichas-tecnicas/preparaciones/${eliminando}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Preparación eliminada" });
        setEliminando(null);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const filtradas = preparaciones.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Preparaciones</h1>
          <p className="text-slate-500 text-sm">Recetas base reutilizables</p>
        </div>
        {canEdit && (
          <Button onClick={openCrear}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Preparación
          </Button>
        )}
      </div>

      <FichasNav />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar preparaciones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-white rounded-lg border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Soup className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {search
              ? "No se encontraron preparaciones"
              : "No hay preparaciones registradas"}
          </p>
          {canEdit && !search && (
            <Button className="mt-3" onClick={openCrear}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Preparación
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((prep) => (
            <div
              key={prep.id}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{prep.nombre}</h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                    <span>{prep.porciones} porción(es)</span>
                    <span className="text-blue-600 font-medium">
                      Total: {formatCurrency(prep.costoTotal)}
                    </span>
                    <span className="text-blue-600 font-medium">
                      /Porción: {formatCurrency(prep.costoPorPorcion)}
                    </span>
                  </div>
                  {prep.ingredientes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prep.ingredientes.map((ing) => (
                        <span
                          key={ing.id}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {ing.insumo.nombre} × {ing.cantidad}
                        </span>
                      ))}
                    </div>
                  )}
                  {prep.procedimiento && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <ListOrdered className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{prep.procedimiento}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditar(prep)}
                      className="h-11 w-11 text-slate-500 hover:text-slate-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEliminando(prep.id)}
                      className="h-11 w-11 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !saving && setModalOpen(o)}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {editando ? "Editar Preparación" : "Nueva Preparación"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[55dvh] sm:max-h-[70vh]">
            <form onSubmit={handleGuardar} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Sofrito base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Porciones *</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={porciones}
                  onChange={(e) => setPorciones(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Ingredientes</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setIngredientes([
                        ...ingredientes,
                        { insumoId: "", cantidad: "1" },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                  </Button>
                </div>
                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => {
                    const insumo = insumos.find((i) => String(i.id) === ing.insumoId);
                    const costo = insumo
                      ? insumo.valorPorUnidad * (parseFloat(ing.cantidad) || 0)
                      : 0;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex-1 min-w-0">
                          <Select
                            value={ing.insumoId}
                            onValueChange={(v) => {
                              const updated = ingredientes.map((item, i) =>
                                i === idx ? { ...item, insumoId: v } : item
                              );
                              setIngredientes(updated);
                            }}
                          >
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {insumosDisponibles.map((i) => (
                                <SelectItem key={i.id} value={String(i.id)}>
                                  <span className="flex items-center gap-1.5">
                                    {i.productoId != null && (
                                      <Package className="h-3 w-3 text-emerald-600" />
                                    )}
                                    {i.esPreparacion && (
                                      <Soup className="h-3 w-3 text-blue-500" />
                                    )}
                                    {i.nombre}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ing.cantidad}
                            onChange={(e) => {
                              const updated = ingredientes.map((item, i) =>
                                i === idx ? { ...item, cantidad: e.target.value } : item
                              );
                              setIngredientes(updated);
                            }}
                            className="h-10 text-sm w-24"
                          />
                          {insumo && (
                            <span className="text-xs text-slate-400 flex-shrink-0">{insumo.unidad}</span>
                          )}
                          <span className="text-xs text-blue-600 w-14 text-right flex-shrink-0">
                            {formatCurrency(costo)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setIngredientes(
                                ingredientes.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-red-500 h-11 w-11 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {ingredientes.length > 0 && (
                  <div className="flex justify-end gap-4 text-sm font-medium bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-blue-600">
                      Total: {formatCurrency(costoTotal)}
                    </span>
                    <span className="text-blue-600">
                      /P: {formatCurrency(costoPorPorcion)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Procedimiento</Label>
                <Textarea
                  value={procedimiento}
                  onChange={(e) => setProcedimiento(e.target.value)}
                  placeholder={"1. Calentar el aceite a fuego medio...\n2. Añadir la cebolla picada...\n3. Sofreír hasta que esté transparente..."}
                  rows={5}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editando ? "Guardar" : "Crear"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={eliminando !== null}
        onOpenChange={(o) => !o && setEliminando(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Preparación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar esta preparación? También se eliminará el insumo
              asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

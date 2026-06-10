"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Edit2, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  preparacion?: { nombre: string } | null;
  producto?: { id: number; nombre: string; activo: boolean } | null;
}

export default function InsumosPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", unidad: "", valorPorUnidad: "" });

  const rol = (session?.user as any)?.rol || "viewer";
  const canEdit = canEditFichas(rol);
  const canDelete = canDeleteFichas(rol);

  async function fetchInsumos() {
    setLoading(true);
    try {
      const res = await fetch("/api/fichas-tecnicas/insumos");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setInsumos(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsumos();
  }, []);

  function openCrear() {
    setEditando(null);
    setForm({ nombre: "", unidad: "", valorPorUnidad: "" });
    setModalOpen(true);
  }

  function openEditar(insumo: Insumo) {
    setEditando(insumo);
    setForm({
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      valorPorUnidad: String(insumo.valorPorUnidad),
    });
    setModalOpen(true);
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editando
        ? `/api/fichas-tecnicas/insumos/${editando.id}`
        : "/api/fichas-tecnicas/insumos";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          unidad: form.unidad,
          valorPorUnidad: parseFloat(form.valorPorUnidad),
        }),
      });
      if (res.ok) {
        toast({
          title: editando ? "Insumo actualizado" : "Insumo creado",
        });
        setModalOpen(false);
        fetchInsumos();
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
      const res = await fetch(`/api/fichas-tecnicas/insumos/${eliminando}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Insumo eliminado" });
        setEliminando(null);
        fetchInsumos();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  const filtrados = insumos.filter(
    (i) =>
      i.nombre.toLowerCase().includes(search.toLowerCase()) ||
      i.unidad.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insumos</h1>
          <p className="text-slate-500 text-sm">
            Productos del inventario, preparaciones e insumos manuales
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCrear}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Insumo
          </Button>
        )}
      </div>

      <FichasNav />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar insumos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-white rounded-lg border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {search ? "No se encontraron insumos" : "No hay insumos registrados"}
          </p>
          {canEdit && !search && (
            <Button className="mt-3" onClick={openCrear}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Insumo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((insumo) => {
            const esDeInventario = insumo.productoId != null;
            const esManual = !esDeInventario && !insumo.esPreparacion;
            return (
              <div
                key={insumo.id}
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{insumo.nombre}</span>
                    {insumo.esPreparacion && (
                      <Badge variant="secondary" className="text-xs">
                        Preparación
                      </Badge>
                    )}
                    {esDeInventario && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                        Inventario
                      </Badge>
                    )}
                    {esDeInventario && insumo.producto?.activo === false && (
                      <Badge variant="secondary" className="text-xs text-slate-500">
                        Producto inactivo
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>Unidad: {insumo.unidad}</span>
                    <span className="text-blue-600 font-medium">
                      {formatCurrency(insumo.valorPorUnidad)}/{insumo.unidad}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {canEdit && esManual && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditar(insumo)}
                      className="h-11 w-11 text-slate-500 hover:text-slate-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && esManual && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEliminando(insumo.id)}
                      className="h-11 w-11 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !saving && setModalOpen(o)}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {editando ? "Editar Insumo" : "Nuevo Insumo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Tomate triturado"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad *</Label>
              <Input
                id="unidad"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Ej: kg, l, ud, g"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Precio por unidad (€) *</Label>
              <Input
                id="valor"
                type="number"
                min="0"
                step="0.001"
                value={form.valorPorUnidad}
                onChange={(e) =>
                  setForm({ ...form, valorPorUnidad: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editando ? "Guardar Cambios" : "Crear Insumo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={eliminando !== null}
        onOpenChange={(o) => !o && setEliminando(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Insumo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar este insumo? Esta acción puede afectar
              fichas técnicas que lo usen.
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

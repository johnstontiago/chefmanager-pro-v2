"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, Tag, Loader2 } from "lucide-react";
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
import { canEditFichas, canDeleteFichas } from "@/lib/fichas/roles";
import { FichasNav } from "../_components/fichas-nav";

interface Categoria {
  id: number;
  nombre: string;
  _count?: { fichas: number };
}

export default function CategoriasFichasPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");

  const rol = (session?.user as any)?.rol || "viewer";
  const canEdit = canEditFichas(rol);
  const canDelete = canDeleteFichas(rol);

  async function fetchCategorias() {
    setLoading(true);
    try {
      const res = await fetch("/api/fichas-tecnicas/categorias");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCategorias(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategorias();
  }, []);

  function openCrear() {
    setEditando(null);
    setNombre("");
    setModalOpen(true);
  }

  function openEditar(cat: Categoria) {
    setEditando(cat);
    setNombre(cat.nombre);
    setModalOpen(true);
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editando
        ? `/api/fichas-tecnicas/categorias/${editando.id}`
        : "/api/fichas-tecnicas/categorias";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (res.ok) {
        toast({ title: editando ? "Categoría actualizada" : "Categoría creada" });
        setModalOpen(false);
        fetchCategorias();
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
      const res = await fetch(`/api/fichas-tecnicas/categorias/${eliminando}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Categoría eliminada" });
        setEliminando(null);
        fetchCategorias();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorías</h1>
          <p className="text-slate-500 text-sm">Organiza tus fichas técnicas</p>
        </div>
        {canEdit && (
          <Button onClick={openCrear}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        )}
      </div>

      <FichasNav />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-white rounded-lg border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Tag className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay categorías registradas</p>
          {canEdit && (
            <Button className="mt-3" onClick={openCrear}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Tag className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <span className="font-medium text-slate-900">{cat.nombre}</span>
                  {cat._count && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cat._count.fichas} ficha(s)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cat._count && cat._count.fichas > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {cat._count.fichas}
                  </Badge>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditar(cat)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEliminando(cat.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !saving && setModalOpen(o)}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900">
              {editando ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Entrantes, Postres..."
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
                {editando ? "Guardar" : "Crear"}
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
            <AlertDialogTitle>Eliminar Categoría</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar esta categoría? Las fichas asociadas quedarán sin
              categoría.
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

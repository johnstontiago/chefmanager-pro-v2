"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Filter, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { FichaCard } from "./_components/ficha-card";
import { FichaForm } from "./_components/ficha-form";
import { FichaDetalle } from "./_components/ficha-detalle";
import { FichasNav } from "./_components/fichas-nav";
import { useToast } from "@/components/ui/use-toast";
import { canEditFichas, canDeleteFichas } from "@/lib/fichas/roles";

interface Ficha {
  id: number;
  nombre: string;
  descripcion?: string | null;
  porciones: number;
  tiempoMin: number;
  urlImagen?: string | null;
  alergenos: string[];
  procedimiento?: string | null;
  costoTotal: number;
  costoPorPorcion: number;
  categoriaId?: number | null;
  categoria?: { id: number; nombre: string } | null;
  ingredientes: Array<{
    id: number;
    insumoId: number;
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
}

interface Categoria {
  id: number;
  nombre: string;
}

export default function FichasPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<Ficha | null>(null);
  const [modalDetalle, setModalDetalle] = useState<Ficha | null>(null);
  const [modalEliminar, setModalEliminar] = useState<{ id: number; nombre: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchFichas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoriaFiltro) params.set("categoriaId", categoriaFiltro);
      const res = await fetch(`/api/fichas-tecnicas/fichas?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setFichas(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [search, categoriaFiltro]);

  useEffect(() => {
    fetchFichas();
  }, [fetchFichas]);

  useEffect(() => {
    fetch("/api/fichas-tecnicas/categorias")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCategorias(data))
      .catch(() => {});
  }, []);

  async function handleCrear(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/fichas-tecnicas/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: "Ficha creada correctamente" });
        setModalCrear(false);
        fetchFichas();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al crear ficha", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEditar(data: Record<string, unknown>) {
    if (!modalEditar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fichas-tecnicas/fichas/${modalEditar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast({ title: "Ficha actualizada correctamente" });
        setModalEditar(null);
        fetchFichas();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al actualizar ficha", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (!modalEliminar) return;
    try {
      const res = await fetch(`/api/fichas-tecnicas/fichas/${modalEliminar.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Ficha eliminada" });
        setModalEliminar(null);
        fetchFichas();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al eliminar ficha", variant: "destructive" });
    }
  }

  const rol = (session?.user as any)?.rol || "viewer";
  const canEdit = canEditFichas(rol);
  const canDelete = canDeleteFichas(rol);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Fichas Técnicas</h1>
          <p className="text-slate-500 text-sm">Gestión de escandallos con costos del inventario</p>
        </div>
        {canEdit && (
          <Button onClick={() => setModalCrear(true)} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Ficha
          </Button>
        )}
      </div>

      <FichasNav />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar fichas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="sm:w-48">
          <Select value={categoriaFiltro || "all"} onValueChange={(v) => setCategoriaFiltro(v === "all" ? "" : v)}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 bg-white rounded-lg border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : fichas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <ChefHat className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">No hay fichas técnicas</h3>
          <p className="text-slate-400 text-sm mt-1">
            {search || categoriaFiltro
              ? "No se encontraron resultados para tu búsqueda"
              : "Comienza creando tu primera ficha técnica"}
          </p>
          {canEdit && !search && !categoriaFiltro && (
            <Button className="mt-4" onClick={() => setModalCrear(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Ficha
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fichas.map((ficha) => (
            <FichaCard
              key={ficha.id}
              ficha={ficha}
              canEdit={canEdit}
              canDelete={canDelete || canEdit}
              onVer={() => setModalDetalle(ficha)}
              onEditar={() => setModalEditar(ficha)}
              onEliminar={() => setModalEliminar({ id: ficha.id, nombre: ficha.nombre })}
            />
          ))}
        </div>
      )}

      <Dialog open={modalCrear} onOpenChange={setModalCrear}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Nueva Ficha Técnica</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[55dvh] sm:max-h-[75vh] pr-1">
            <FichaForm onSubmit={handleCrear} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalEditar} onOpenChange={(o) => !o && setModalEditar(null)}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Editar Ficha Técnica</DialogTitle>
          </DialogHeader>
          {modalEditar && (
            <div className="overflow-y-auto max-h-[55dvh] sm:max-h-[75vh] pr-1">
              <FichaForm
                initialData={{
                  ...modalEditar,
                  ingredientes: modalEditar.ingredientes.map((ing) => ({
                    insumoId: ing.insumoId,
                    cantidad: ing.cantidad,
                    costoCalculado: ing.costoCalculado,
                  })),
                }}
                onSubmit={handleEditar}
                loading={saving}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!modalDetalle}
        onOpenChange={(o) => !o && setModalDetalle(null)}
      >
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Detalle de Ficha</DialogTitle>
          </DialogHeader>
          {modalDetalle && (
            <div className="overflow-y-auto max-h-[70dvh] sm:max-h-[80vh] pr-1">
              <FichaDetalle ficha={modalDetalle} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!modalEliminar}
        onOpenChange={(o) => !o && setModalEliminar(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              ¿Eliminar ficha técnica?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Estás a punto de eliminar permanentemente{" "}
              <span className="font-semibold text-slate-900">
                &ldquo;{modalEliminar?.nombre}&rdquo;
              </span>
              .{" "}
              <span className="text-red-600 font-medium">
                Esta acción no se puede deshacer.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-red-600 hover:bg-red-700"
            >
              Sí, eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

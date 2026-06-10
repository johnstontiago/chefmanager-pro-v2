"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlergenosSelector } from "./alergenos-selector";
import { formatCurrency } from "@/lib/utils";

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  valorPorUnidad: number;
  esPreparacion: boolean;
  productoId?: number | null;
}

interface Categoria {
  id: number;
  nombre: string;
}

interface Ingrediente {
  insumoId: string;
  cantidad: string;
  costoCalculado: number;
}

interface FichaFormProps {
  initialData?: {
    id?: number;
    nombre?: string;
    categoriaId?: number | null;
    descripcion?: string | null;
    porciones?: number;
    tiempoMin?: number;
    urlImagen?: string | null;
    alergenos?: string[];
    procedimiento?: string | null;
    ingredientes?: Array<{
      insumoId: number;
      cantidad: number;
      costoCalculado: number;
    }>;
  };
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
}

export function FichaForm({ initialData, onSubmit, loading }: FichaFormProps) {
  const [nombre, setNombre] = useState(initialData?.nombre || "");
  const [categoriaId, setCategoriaId] = useState(
    initialData?.categoriaId ? String(initialData.categoriaId) : ""
  );
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || "");
  const [porciones, setPorciones] = useState(String(initialData?.porciones || 1));
  const [tiempoMin, setTiempoMin] = useState(String(initialData?.tiempoMin || 0));
  const [urlImagen, setUrlImagen] = useState(initialData?.urlImagen || "");
  const [alergenos, setAlergenos] = useState<string[]>(initialData?.alergenos || []);
  const [procedimiento, setProcedimiento] = useState(initialData?.procedimiento || "");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>(
    (initialData?.ingredientes || []).map((ing) => ({
      insumoId: String(ing.insumoId),
      cantidad: String(ing.cantidad),
      costoCalculado: ing.costoCalculado,
    }))
  );
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    fetch("/api/fichas-tecnicas/insumos")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setInsumos(data))
      .catch(() => {});
    fetch("/api/fichas-tecnicas/categorias")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCategorias(data))
      .catch(() => {});
  }, []);

  function addIngrediente() {
    setIngredientes([
      ...ingredientes,
      { insumoId: "", cantidad: "1", costoCalculado: 0 },
    ]);
  }

  function removeIngrediente(idx: number) {
    setIngredientes(ingredientes.filter((_, i) => i !== idx));
  }

  function updateIngrediente(
    idx: number,
    field: keyof Ingrediente,
    value: string
  ) {
    const updated = [...ingredientes];
    updated[idx] = { ...updated[idx], [field]: value };

    if (field === "insumoId" || field === "cantidad") {
      const insumoId = field === "insumoId" ? value : updated[idx].insumoId;
      const cantidad = field === "cantidad" ? parseFloat(value) || 0 : parseFloat(updated[idx].cantidad) || 0;
      const insumo = insumos.find((i) => String(i.id) === insumoId);
      if (insumo) {
        updated[idx].costoCalculado = insumo.valorPorUnidad * cantidad;
      }
    }

    setIngredientes(updated);
  }

  const costoTotal = ingredientes.reduce(
    (acc, ing) => acc + (ing.costoCalculado || 0),
    0
  );
  const costoPorPorcion = costoTotal / (parseFloat(porciones) || 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      nombre,
      categoriaId: categoriaId ? parseInt(categoriaId, 10) : null,
      descripcion,
      porciones: parseFloat(porciones) || 1,
      tiempoMin: parseInt(tiempoMin) || 0,
      urlImagen: urlImagen || null,
      alergenos,
      procedimiento,
      ingredientes: ingredientes
        .filter((ing) => ing.insumoId)
        .map((ing) => ({
          insumoId: parseInt(ing.insumoId, 10),
          cantidad: parseFloat(ing.cantidad) || 0,
        })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Gazpacho andaluz"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria">Categoría</Label>
          <Select value={categoriaId || "none"} onValueChange={(v) => setCategoriaId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="urlImagen">URL Imagen</Label>
          <Input
            id="urlImagen"
            value={urlImagen}
            onChange={(e) => setUrlImagen(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="porciones">Porciones *</Label>
          <Input
            id="porciones"
            type="number"
            min="0.1"
            step="0.1"
            value={porciones}
            onChange={(e) => setPorciones(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tiempoMin">Tiempo (minutos)</Label>
          <Input
            id="tiempoMin"
            type="number"
            min="0"
            value={tiempoMin}
            onChange={(e) => setTiempoMin(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción del plato..."
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Ingredientes</Label>
          <Button type="button" variant="outline" size="sm" onClick={addIngrediente}>
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>

        {ingredientes.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3 bg-slate-50 rounded-lg border border-slate-200">
            No hay ingredientes. Añade uno.
          </p>
        )}

        <div className="space-y-2">
          {ingredientes.map((ing, idx) => {
            const insumo = insumos.find((i) => String(i.id) === ing.insumoId);
            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex-1 min-w-0">
                  <Select
                    value={ing.insumoId}
                    onValueChange={(v) => updateIngrediente(idx, "insumoId", v)}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Seleccionar insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          <span className="flex items-center gap-1.5">
                            {i.productoId != null && (
                              <Package className="h-3 w-3 text-emerald-600" />
                            )}
                            {i.nombre} ({i.unidad})
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
                    onChange={(e) =>
                      updateIngrediente(idx, "cantidad", e.target.value)
                    }
                    placeholder="Cant."
                    className="h-10 text-sm w-24"
                  />
                  {insumo && (
                    <span className="text-xs text-slate-400 w-8 flex-shrink-0">{insumo.unidad}</span>
                  )}
                  <span className="text-xs text-blue-600 font-medium w-16 text-right flex-shrink-0">
                    {formatCurrency(ing.costoCalculado)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngrediente(idx)}
                    className="text-red-500 hover:text-red-600 h-11 w-11 flex-shrink-0"
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
              /Porción: {formatCurrency(costoPorPorcion)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Alérgenos</Label>
        <AlergenosSelector selected={alergenos} onChange={setAlergenos} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="procedimiento">Procedimiento</Label>
        <Textarea
          id="procedimiento"
          value={procedimiento}
          onChange={(e) => setProcedimiento(e.target.value)}
          placeholder="1. Lavar y pelar las verduras...&#10;2. Triturar todos los ingredientes...&#10;3. Sazonar y refrigerar..."
          rows={6}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Guardando...
          </>
        ) : initialData?.id ? (
          "Guardar Cambios"
        ) : (
          "Crear Ficha Técnica"
        )}
      </Button>
    </form>
  );
}

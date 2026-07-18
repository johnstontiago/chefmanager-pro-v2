"use client";

import { useState, useEffect } from "react";
import { Building2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Unidad {
  id: number;
  nombre: string;
  direccion?: string;
}

interface UnitSelectorProps {
  currentUnidadId: number | null;
  currentUnidadNombre: string | null;
  isSuperuser: boolean;
  onClose: () => void;
  onSelect: (unidadId: number, unidadNombre: string) => void;
}

export default function UnitSelector({
  currentUnidadId,
  currentUnidadNombre,
  isSuperuser,
  onClose,
  onSelect,
}: UnitSelectorProps) {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(currentUnidadId);

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      const res = await fetch("/api/unidades");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUnidades(data);
      }
    } catch (error) {
      console.error("Error fetching unidades:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const selected = unidades.find((u) => u.id === selectedId);
    if (selected) {
      onSelect(selected.id, selected.nombre);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Unidad Actual</h2>
              <p className="text-sm text-muted-foreground">Seleccione la unidad de trabajo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : !isSuperuser ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{currentUnidadNombre}</h3>
              <p className="text-muted-foreground mt-2">Esta es su unidad asignada</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unidades.map((unidad) => (
                <button
                  key={unidad.id}
                  onClick={() => setSelectedId(unidad.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    selectedId === unidad.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-border hover:border-input"
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-foreground">{unidad.nombre}</div>
                    {unidad.direccion && (
                      <div className="text-sm text-muted-foreground">{unidad.direccion}</div>
                    )}
                  </div>
                  {selectedId === unidad.id && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {isSuperuser && (
            <Button onClick={handleConfirm} disabled={!selectedId}>
              Confirmar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { Clock, Users, Euro, Eye, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ALERGENOS } from "./alergenos-selector";

interface FichaCardProps {
  ficha: {
    id: number;
    nombre: string;
    descripcion?: string | null;
    porciones: number;
    tiempoMin: number;
    urlImagen?: string | null;
    alergenos: string[];
    costoTotal: number;
    costoPorPorcion: number;
    categoria?: { id: number; nombre: string } | null;
  };
  canEdit: boolean;
  canDelete: boolean;
  onVer: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}

export function FichaCard({
  ficha,
  canEdit,
  canDelete,
  onVer,
  onEditar,
  onEliminar,
}: FichaCardProps) {
  const alergenosLabels = ficha.alergenos
    .map((a) => ALERGENOS.find((al) => al.id === a))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow bg-card">
      <div className="relative h-48 bg-muted">
        {ficha.urlImagen ? (
          <Image
            src={ficha.urlImagen}
            alt={ficha.nombre}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        {ficha.categoria && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-blue-600 text-white text-xs">
              {ficha.categoria.nombre}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground text-base mb-1 line-clamp-1">
          {ficha.nombre}
        </h3>
        {ficha.descripcion && (
          <p className="text-muted-foreground text-xs mb-3 line-clamp-2">
            {ficha.descripcion}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {ficha.porciones} porciones
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {ficha.tiempoMin} min
          </span>
          <span className="flex items-center gap-1 text-blue-600 font-medium">
            <Euro className="h-3 w-3" />
            {ficha.costoPorPorcion.toFixed(2)}/p
          </span>
        </div>

        {alergenosLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {alergenosLabels.map((a) => (
              <span key={a!.id} title={a!.label} className="text-sm">
                {a!.emoji}
              </span>
            ))}
            {ficha.alergenos.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{ficha.alergenos.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onVer}
            className="flex-1 min-h-[44px] text-sm"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Ver
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              onClick={onEditar}
              className="flex-1 min-h-[44px] text-sm"
            >
              <Edit2 className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={onEliminar}
              className="min-h-[44px] w-11 text-red-600 hover:text-red-700 hover:bg-red-50"
              aria-label="Eliminar ficha"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

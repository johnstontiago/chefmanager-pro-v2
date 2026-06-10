"use client";

import { Check } from "lucide-react";

const ALERGENOS = [
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "crustaceos", label: "Crustáceos", emoji: "🦞" },
  { id: "huevos", label: "Huevos", emoji: "🥚" },
  { id: "pescado", label: "Pescado", emoji: "🐟" },
  { id: "cacahuetes", label: "Cacahuetes", emoji: "🥜" },
  { id: "soja", label: "Soja", emoji: "🫘" },
  { id: "lacteos", label: "Lácteos", emoji: "🥛" },
  { id: "frutosSecos", label: "Frutos secos", emoji: "🌰" },
  { id: "apio", label: "Apio", emoji: "🌿" },
  { id: "mostaza", label: "Mostaza", emoji: "🌻" },
  { id: "sesamo", label: "Sésamo", emoji: "⚪" },
  { id: "sulfitos", label: "Sulfitos", emoji: "🍷" },
  { id: "altramuces", label: "Altramuces", emoji: "🟡" },
  { id: "moluscos", label: "Moluscos", emoji: "🐚" },
];

interface AlergenosSelectorProps {
  selected: string[];
  onChange: (alergenos: string[]) => void;
  disabled?: boolean;
}

export function AlergenosSelector({
  selected,
  onChange,
  disabled = false,
}: AlergenosSelectorProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((a) => a !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {ALERGENOS.map((alergeno) => {
        const isSelected = selected.includes(alergeno.id);
        return (
          <button
            key={alergeno.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(alergeno.id)}
            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors text-left w-full ${
              isSelected
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div
              className={`h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${
                isSelected
                  ? "bg-blue-600 border-blue-600"
                  : "border-slate-300"
              }`}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </div>
            <span className="text-xs flex items-center gap-1">
              <span>{alergeno.emoji}</span>
              <span>{alergeno.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { ALERGENOS };

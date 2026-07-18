"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Cada tema muestra sus 3 colores clave como muestra visual.
const THEMES = [
  { id: "actual", label: "Actual", swatch: ["#2563eb", "#ffffff", "#64748b"] },
  { id: "mediterraneo", label: "Mediterráneo", swatch: ["#1e6fa8", "#faf6ee", "#d99a3f"] },
  { id: "night", label: "Night", swatch: ["#0a0f1e", "#fafafa", "#3b82f6"] },
  { id: "mono", label: "Mono", swatch: ["#333333", "#ffffff", "#999999"] },
] as const;

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evita mismatch de hidratación: el tema real solo se conoce en el cliente.
  useEffect(() => setMounted(true), []);

  const activeId = mounted ? theme ?? "actual" : "actual";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Cambiar tema de color"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <Palette className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Tema de color</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="flex -space-x-1">
                {t.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="w-3.5 h-3.5 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              {t.label}
            </span>
            {activeId === t.id && <Check className="w-4 h-4 text-blue-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

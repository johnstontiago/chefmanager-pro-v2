"use client";

import Link from "next/link";
import {
  ChefHat,
  PackagePlus,
  ClipboardCheck,
  Plug,
  PlayCircle,
  ArrowRight,
} from "lucide-react";

interface Acceso {
  href: string;
  titulo: string;
  descripcion: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACCESOS: Acceso[] = [
  {
    href: "/elaboraciones",
    titulo: "Elaboraciones",
    descripcion:
      "Crea producciones propias (pulled pork, salsas, masas). Cada lote cuenta en stock como un producto.",
    icon: ChefHat,
  },
  {
    href: "/recepcion",
    titulo: "Recepción de pedidos",
    descripcion:
      "Recibe mercancía de los pedidos ítem por ítem y crea lotes de stock. Soporta variantes: formato distinto, peso variable o producto sustituto.",
    icon: PackagePlus,
  },
  {
    href: "/inventario/recepciones/nuevo",
    titulo: "Entrada manual de stock",
    descripcion:
      "Alta de lotes sin pedido asociado (ajustes, stock inicial). Soporta peso fijo y peso variable.",
    icon: PackagePlus,
  },
  {
    href: "/inventario",
    titulo: "Inventario",
    descripcion:
      "Stock real por lotes: cantidades, caducidades, stock bajo y valor total. Es el registro único de inventario.",
    icon: ClipboardCheck,
  },
  {
    href: "/configuracion/integracion-tpv",
    titulo: "Integración TPV",
    descripcion:
      "Gestiona la API key, activa/desactiva la conexión y consulta el registro de llamadas.",
    icon: Plug,
  },
  {
    href: "/configuracion/integracion-tpv/simulador",
    titulo: "Simulador de comandas",
    descripcion:
      "Prueba el descuento de stock enviando comandas al endpoint sin necesitar un TPV real.",
    icon: PlayCircle,
  },
];

export default function ModuloStockTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Módulo de Stock</h2>
        <p className="text-sm text-slate-500">
          Accesos directos a los flujos de control de stock por lotes, elaboraciones y TPV.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACCESOS.map((acceso) => (
          <Link
            key={acceso.href}
            href={acceso.href}
            className="group flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <acceso.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-800">{acceso.titulo}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{acceso.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

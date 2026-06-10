"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, Soup, Package, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/fichas", label: "Fichas", icon: ChefHat },
  { href: "/fichas/preparaciones", label: "Preparaciones", icon: Soup },
  { href: "/fichas/insumos", label: "Insumos", icon: Package },
  { href: "/fichas/categorias", label: "Categorías", icon: Tag },
];

export function FichasNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-1 px-1">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/fichas"
            ? pathname === "/fichas"
            : pathname?.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

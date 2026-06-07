"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    ClipboardList,
    UtensilsCrossed,
    Settings,
    LogOut,
    Menu,
    X,
    Building2,
    ChevronDown,
    Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import UnitSelector from "./unit-selector";
import SyncStatus from "@/components/sync-status";

interface DashboardShellProps {
    user: any;
    children: React.ReactNode;
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["superuser", "admin", "recepcion", "cocina", "viewer"] },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart, roles: ["superuser", "admin", "recepcion"] },
  { href: "/recepcion", label: "Recepción", icon: ClipboardList, roles: ["superuser", "admin", "recepcion"] },
  { href: "/inventario", label: "Inventario", icon: Package, roles: ["superuser", "admin", "recepcion", "cocina", "viewer"] },
  { href: "/consumo", label: "Consumo", icon: UtensilsCrossed, roles: ["superuser", "admin", "cocina"] },
  { href: "/admin", label: "Administración", icon: Settings, roles: ["superuser", "admin"] },
  { href: "/superadmin", label: "Panel Admin", icon: Crown, roles: ["superuser"] },
  ].map(item => ({ ...item, href: item.href === "/dashboard" ? "/dashboard" : item.href }));

export default function DashboardShell({ user, children }: DashboardShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [stockBajoCount, setStockBajoCount] = useState(0);
    const pathname = usePathname();
    const { data: session, update } = useSession() ?? {};

  const currentUser = (session?.user as any) || user;

  useEffect(() => {
    if (currentUser?.unidadId) {
      fetch("/api/dashboard/stats")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data?.stockBajo && setStockBajoCount(data.stockBajo))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.unidadId]);
    const filteredMenu = menuItems.filter((item) =>
          item.roles.includes(currentUser?.rol || "viewer")
                                            );

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
        if (sidebarOpen) {
                document.body.classList.add("menu-open");
        } else {
                document.body.classList.remove("menu-open");
        }
        return () => {
                document.body.classList.remove("menu-open");
        };
  }, [sidebarOpen]);

  const handleLogout = async () => {
        await signOut({ redirect: true, callbackUrl: "/login" });
  };

  return (
        <div className="min-h-screen bg-slate-50">
          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
                  <div
                              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                              onClick={() => setSidebarOpen(false)}
                            />
                )}
        
          {/* Sidebar */}
              <aside
                        className={cn(
                                    "fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
                                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                                  )}
                      >
                      <div className="flex flex-col h-full">
                        {/* Logo */}
                                <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
                                            <div className="flex items-center space-x-2">
                                                          <img
                                                            src="/icons/icon-192.png"
                                                            alt="ChefManager logo"
                                                            className="w-8 h-8 rounded-lg object-cover"
                                                          />
                                                          <span className="text-white font-bold">ChefManager</span>
                                                        </div>
                                            <button
                                                            onClick={() => setSidebarOpen(false)}
                                                            className="lg:hidden text-slate-400 hover:text-white"
                                                          >
                                                          <X className="w-5 h-5" />
                                            </button>
                                </div>
                      
                        {/* User Info */}
                                <div className="px-4 py-4 border-b border-slate-800">
                                            <div className="text-sm text-slate-400">Conectado como</div>
                                            <div className="text-white font-medium truncate">{currentUser?.name}</div>
                                            <div className="text-xs text-blue-400 capitalize">{currentUser?.rol}</div>
                                </div>
                      
                        {/* Navigation */}
                                <nav className="flex-1 px-2 py-4 overflow-y-auto">
                                  {filteredMenu.map((item) => {
                                      const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                                      return (
                                                        <Link
                                                                            key={item.href}
                                                                            href={item.href}
                                                                            onClick={() => setSidebarOpen(false)}
                                                                            className={cn(
                                                                                                  "flex items-center px-4 py-3 mb-1 rounded-lg text-sm font-medium transition-colors",
                                                                                                  isActive
                                                                                                    ? "bg-blue-600 text-white"
                                                                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                                                                                )}
                                                                          >
                                                                          <item.icon className="w-5 h-5 mr-3" />
                                                          <span className="flex-1">{item.label}</span>
                                                          {item.href === "/inventario" && stockBajoCount > 0 && (
                                                            <span className="ml-1 min-w-[20px] h-5 text-xs bg-red-500 text-white rounded-full flex items-center justify-center px-1">
                                                              {stockBajoCount > 99 ? "99+" : stockBajoCount}
                                                            </span>
                                                          )}
                                                        </Link>
                                                      );
                      })}
                                </nav>
                      
                        {/* Logout */}
                                <div className="p-4 border-t border-slate-800">
                                            <button
                                                            onClick={handleLogout}
                                                            className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                                          >
                                                          <LogOut className="w-5 h-5 mr-3" />
                                                          Cerrar Sesión
                                            </button>
                                </div>
                      </div>
              </aside>
        
          {/* Main content */}
              <div className="lg:pl-64 min-w-0 overflow-x-hidden">
                {/* Top bar */}
                      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
                                <div className="flex items-center justify-between h-16 px-4">
                                            <button
                                                            onClick={() => setSidebarOpen(true)}
                                                            className="lg:hidden text-slate-600 hover:text-slate-900"
                                                          >
                                                          <Menu className="w-6 h-6" />
                                            </button>
                                
                                  {/* Unit Selector Banner */}
                                            <div className="flex-1 flex justify-center lg:justify-start lg:ml-4 min-w-0">
                                                          <button
                                                                            onClick={() => setShowUnitSelector(true)}
                                                                            className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors max-w-full"
                                                                          >
                                                                          <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                                                          <span className="font-medium text-blue-900 truncate">
                                                                            {currentUser?.unidadNombre || "Sin unidad asignada"}
                                                                          </span>
                                                            {currentUser?.rol === "superuser" && (
                                                                                              <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                                                            )}
                                                          </button>
                                            </div>
                                
                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                          <span className="hidden sm:inline text-sm text-slate-600 truncate max-w-[150px]">
                                                            {currentUser?.email}
                                                          </span>
                                            </div>
                                </div>
                      </header>
              
                {/* Page content */}
                      <main className="p-4 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden">
                        {children}
                      </main>
              </div>
        
          {/* Indicador de estado de conexión / cola offline */}
          <SyncStatus />

          {/* Unit Selector Modal */}
          {showUnitSelector && (
                  <UnitSelector
                              currentUnidadId={currentUser?.unidadId}
                              currentUnidadNombre={currentUser?.unidadNombre}
                              isSuperuser={currentUser?.rol === "superuser"}
                              onClose={() => setShowUnitSelector(false)}
                              onSelect={async (unidadId, unidadNombre) => {
                                            await update?.({ unidadId, unidadNombre });
                                            setShowUnitSelector(false);
                                            window.location.reload();
                              }}
                            />
                )}
        </div>
      );
}

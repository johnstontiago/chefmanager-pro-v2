"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  AlertTriangle,
  Clock,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
  Boxes,
  Building2,
  Receipt,
  UtensilsCrossed,
  Settings,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatDecimal } from "@/lib/utils";
import { hasPermission } from "@/lib/types";
import { motion } from "framer-motion";

interface DashboardContentProps {
  userRole: string;
  unidadNombre: string;
  tieneUnidad: boolean;
}

interface DashboardStats {
  stockBajo: number;
  proximosACaducar: number;
  pedidosPendientes: number;
  pedidosParaRecibir: number;
  valorInventario: number;
  totalProductos: number;
  ultimosMovimientos: any[];
}

export default function DashboardContent({ userRole, unidadNombre, tieneUnidad }: DashboardContentProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tieneUnidad) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [tieneUnidad]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Error cargando estadísticas");
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err?.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const quickAccessItems = [
    { label: "Pedidos", icon: ShoppingCart, href: "/pedidos", permission: "pedidos", color: "bg-blue-500" },
    { label: "Recepción", icon: Receipt, href: "/recepcion", permission: "recepcion", color: "bg-green-500" },
    { label: "Inventario", icon: Boxes, href: "/inventario", permission: "inventario", color: "bg-purple-500" },
    { label: "Consumo", icon: UtensilsCrossed, href: "/consumo", permission: "consumo", color: "bg-orange-500" },
    { label: "Admin", icon: Settings, href: "/admin", permission: "admin", color: "bg-slate-600" },
  ].filter((item) => hasPermission(userRole, item.permission));

  const getMovementIcon = (tipo: string) => {
    switch (tipo) {
      case "entrada":
        return <ArrowDownRight className="w-4 h-4 text-green-500" />;
      case "consumo":
        return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case "merma":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <RotateCcw className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getMovementBadge = (tipo: string) => {
    switch (tipo) {
      case "entrada":
        return <Badge className="bg-green-100 text-green-700">Entrada</Badge>;
      case "consumo":
        return <Badge className="bg-blue-100 text-blue-700">Consumo</Badge>;
      case "merma":
        return <Badge className="bg-red-100 text-red-700">Merma</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // Mostrar mensaje si no tiene unidad asignada
  if (!tieneUnidad) {
    const canManageUnits = hasPermission(userRole, "admin");
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-amber-800">
                Bienvenido a ChefManager Pro
              </h3>
              <p className="text-amber-700 max-w-md">
                Para comenzar a usar el sistema, necesitas tener una unidad de negocio asignada.
                {canManageUnits 
                  ? " Como administrador, puedes crear una nueva unidad desde el panel de administración."
                  : " Contacta al administrador para que te asigne una unidad."}
              </p>
              {canManageUnits && (
                <Button 
                  onClick={() => router.push("/admin")}
                  className="mt-4 bg-amber-600 hover:bg-amber-700"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ir a Administración
                </Button>
              )}
              <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-100 px-4 py-2 rounded-lg mt-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Admin → Unidades → Crear nueva unidad</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Access for Admin */}
        {canManageUnits && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acceso Rápido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  onClick={() => router.push("/admin")}
                >
                  <Settings className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm">Administración</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Error al cargar</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchStats}>Reintentar</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unit Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-card/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{unidadNombre}</h1>
              <p className="text-blue-100">Sistema de Gestión de Inventario</p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-3xl font-bold">{stats?.totalProductos || 0}</div>
            <div className="text-blue-100">Productos activos</div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/inventario?filter=low")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Stock Bajo</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.stockBajo || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">productos</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/inventario?filter=expiring")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Próximos a Caducar</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.proximosACaducar || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">en 7 días</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/pedidos")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pedidos Pendientes</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.pedidosPendientes || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">activos</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Valor Inventario</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats?.valorInventario || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">total estimado</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alert for orders to receive */}
      {(stats?.pedidosParaRecibir || 0) > 0 && hasPermission(userRole, "recepcion") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Tienes {stats?.pedidosParaRecibir} pedido(s) para recibir</p>
                    <p className="text-sm text-green-600">Estado: Enviado - Pendiente de recepción</p>
                  </div>
                </div>
                <Button onClick={() => router.push("/recepcion")} className="bg-green-600 hover:bg-green-700">
                  Ir a Recepción <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Access */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>Accesos Rápidos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickAccessItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-foreground">{item.label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Movements */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-blue-600" />
                  <span>Últimos Movimientos</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push("/consumo?tab=historial")}>
                  Ver todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.ultimosMovimientos && stats.ultimosMovimientos.length > 0 ? (
                <div className="space-y-3">
                  {stats.ultimosMovimientos.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getMovementIcon(mov.tipo)}
                        <div>
                          <p className="font-medium text-foreground">{mov.productoNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDecimal(mov.cantidad)} {mov.unidadMedida} • {mov.usuario}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getMovementBadge(mov.tipo)}
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(mov.fecha)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay movimientos recientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

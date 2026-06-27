"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Tag,
  Calendar,
  TrendingUp,
  BarChart3,
  QrCode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency, formatDate, formatDecimal, toNumber, getDaysUntilExpiry, getExpiryStatus } from "@/lib/utils";

interface InventarioContentProps {
  userRole: string;
}

export default function InventarioContent({ userRole }: InventarioContentProps) {
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get("filter") || "all";

  const [productos, setProductos] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [valorTotalServer, setValorTotalServer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroProveedor, setFiltroProveedor] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState(filterParam);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, invRes, catRes, provRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/inventario/lotes"),
        fetch("/api/categorias"),
        fetch("/api/proveedores"),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data?.productos || []);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setInventario(data?.inventario || []);
        setValorTotalServer(toNumber(data?.valorTotal || 0));
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorias(data?.categorias || []);
      }
      if (provRes.ok) {
        const data = await provRes.json();
        setProveedores(data?.proveedores || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group inventory by product
  const inventarioByProducto: Record<number, any[]> = {};
  inventario.forEach((inv) => {
    if (!inventarioByProducto[inv.productoId]) {
      inventarioByProducto[inv.productoId] = [];
    }
    inventarioByProducto[inv.productoId].push(inv);
  });

  // Calculate stock and status for each product
  const productosConStock = productos.map((prod) => {
    const lotes = inventarioByProducto[prod.id] || [];
    const stockTotal = lotes.reduce((acc, inv) => acc + toNumber(inv.cantidad), 0);
    const stockMinimo = toNumber(prod.stockMinimo);
    const isLowStock = stockTotal < stockMinimo;

    // Check expiry
    const proximoACaducar = lotes.some((inv) => {
      const status = getExpiryStatus(inv.fechaCaducidad);
      return status === "expired" || status === "warning";
    });

    // Unidad de visualización del stock: base (g/ml) si está definida, si no la de compra
    const unidadDisplay = prod.unidadBase ?? prod.contenidoUnidad ?? prod.unidadMedida;

    return {
      ...prod,
      lotes,
      stockTotal,
      isLowStock,
      proximoACaducar,
      unidadDisplay,
    };
  });

  // Apply filters
  const productosFiltrados = productosConStock.filter((prod) => {
    const matchBusqueda = prod.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || "");
    const matchCategoria = filtroCategoria === "all" || prod.categoriaId === parseInt(filtroCategoria);
    const matchProveedor = filtroProveedor === "all" || prod.proveedorId === parseInt(filtroProveedor);

    let matchEstado = true;
    if (filtroEstado === "low") {
      matchEstado = prod.isLowStock;
    } else if (filtroEstado === "expiring") {
      matchEstado = prod.proximoACaducar;
    } else if (filtroEstado === "ok") {
      matchEstado = !prod.isLowStock && !prod.proximoACaducar;
    }

    return matchBusqueda && matchCategoria && matchProveedor && matchEstado && prod.activo;
  });

  // Stats
  const totalProductos = productos.filter((p) => p.activo).length;
  const productosStockBajo = productosConStock.filter((p) => p.isLowStock).length;
  const productosProximosACaducar = productosConStock.filter((p) => p.proximoACaducar).length;
  // El valor total viene calculado del servidor con conversión de unidades correcta
  const valorTotalInventario = valorTotalServer;

  const toggleExpand = (productId: number) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const getStockBadge = (prod: any) => {
    if (prod.isLowStock) {
      return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" /> Stock Bajo</Badge>;
    }
    if (prod.proximoACaducar) {
      return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" /> Por Caducar</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Normal</Badge>;
  };

  const getExpiryBadge = (inv: any) => {
    const status = getExpiryStatus(inv.fechaCaducidad);
    const days = getDaysUntilExpiry(inv.fechaCaducidad);

    if (status === "expired") {
      return <Badge className="bg-red-500 text-white">Caducado</Badge>;
    }
    if (status === "warning") {
      return <Badge className="bg-yellow-500 text-white">Caduca en {days} días</Badge>;
    }
    if (days !== null) {
      return <Badge variant="secondary">{days} días</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Inventario</h1>
        <p className="text-slate-500">Visualiza y gestiona el stock de productos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Productos</p>
                <p className="text-2xl font-bold text-blue-900">{totalProductos}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFiltroEstado("low")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Stock Bajo</p>
                <p className="text-2xl font-bold text-red-900">{productosStockBajo}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFiltroEstado("expiring")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 font-medium">Por Caducar</p>
                <p className="text-2xl font-bold text-yellow-900">{productosProximosACaducar}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Valor Total</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(valorTotalInventario)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroProveedor} onValueChange={setFiltroProveedor}>
              <SelectTrigger>
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {proveedores.map((prov) => (
                  <SelectItem key={prov.id} value={prov.id.toString()}>
                    {prov.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="low">Stock bajo</SelectItem>
                <SelectItem value="expiring">Por caducar</SelectItem>
                <SelectItem value="ok">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Productos en Stock</span>
            </div>
            <span className="text-sm font-normal text-slate-500">
              {productosFiltrados.length} productos
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {productosFiltrados.map((prod) => {
                const isExpanded = expandedProducts.has(prod.id);
                const stockPercent = Math.min((prod.stockTotal / toNumber(prod.stockMinimo)) * 100, 100);

                return (
                  <Collapsible key={prod.id} open={isExpanded} onOpenChange={() => toggleExpand(prod.id)}>
                    <div className={`rounded-lg border ${prod.isLowStock ? "border-red-200 bg-red-50" : prod.proximoACaducar ? "border-yellow-200 bg-yellow-50" : "border-slate-200 bg-slate-50"}`}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-slate-100 transition-colors gap-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1 mb-1">
                                <h4 className="font-semibold text-slate-800 text-sm sm:text-base">{prod.nombre}</h4>
                                {getStockBadge(prod)}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:text-sm text-slate-500">
                                <span>{prod.categoria?.nombre || "-"}</span>
                                <span className="hidden sm:inline">{prod.proveedor?.nombre || "Sin proveedor"}</span>
                                <span>{formatCurrency(prod.precioUnitario)}/{prod.unidadMedida}</span>
                              </div>
                              {(prod.fabricante || prod.formato) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                                  {prod.fabricante && <span>🏭 {prod.fabricante}</span>}
                                  {prod.formato && <span>📦 {prod.formato}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-1">
                            <div className="flex items-baseline gap-1">
                              <span className={`text-lg sm:text-2xl font-bold ${prod.isLowStock ? "text-red-600" : "text-slate-800"}`}>
                                {formatDecimal(prod.stockTotal)}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-500">{prod.unidadDisplay}</span>
                            </div>
                            <div className="w-16 sm:w-24 h-2 bg-slate-200 rounded-full mt-1 sm:mt-2">
                              <div
                                className={`h-2 rounded-full ${prod.isLowStock ? "bg-red-500" : "bg-green-500"}`}
                                style={{ width: `${stockPercent}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">Mín: {formatDecimal(prod.stockMinimo)}</p>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4 pt-3">
                          <h5 className="text-sm font-semibold text-slate-700 mb-3">Lotes en inventario ({prod.lotes.length})</h5>
                          {prod.lotes.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin stock disponible</p>
                          ) : (
                            <div className="grid gap-2">
                              {prod.lotes.map((inv: any) => (
                                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-white rounded-lg border gap-2">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    {inv.lote && (
                                      <span className="flex items-center text-sm">
                                        <Tag className="w-4 h-4 mr-1 text-slate-400" />
                                        {inv.lote}
                                      </span>
                                    )}
                                    {inv.ubicacion && (
                                      <span className="flex items-center text-sm">
                                        <MapPin className="w-4 h-4 mr-1 text-slate-400" />
                                        {inv.ubicacion}
                                      </span>
                                    )}
                                    {inv.codigoUnico && (
                                      <span className="flex items-center text-xs text-slate-400">
                                        <QrCode className="w-3 h-3 mr-1" />
                                        {inv.codigoUnico}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
                                    {inv.fechaCaducidad && (
                                      <span className="flex items-center text-sm">
                                        <Calendar className="w-4 h-4 mr-1 text-slate-400" />
                                        {formatDate(inv.fechaCaducidad)}
                                      </span>
                                    )}
                                    {getExpiryBadge(inv)}
                                    <span className="font-semibold text-slate-800">
                                      {formatDecimal(inv.cantidad)} {prod.unidadDisplay}
                                      {inv.pesoRealKg ? ` (${formatDecimal(inv.pesoRealKg)} kg)` : ""}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

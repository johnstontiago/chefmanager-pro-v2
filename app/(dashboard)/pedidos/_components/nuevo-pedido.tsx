"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Save,
  Send,
  Loader2,
  Package,
  AlertTriangle,
  Building2,
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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDecimal, toNumber } from "@/lib/utils";
import { CartItem } from "@/lib/types";

interface NuevoPedidoProps {
  onPedidoCreated: () => void;
  pedidoEditar?: any | null;
  onCancelarEdicion?: () => void;
}

export default function NuevoPedido({ onPedidoCreated, pedidoEditar, onCancelarEdicion }: NuevoPedidoProps) {
  const { data: session } = useSession() || {};
  const { toast } = useToast();
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroProveedor, setFiltroProveedor] = useState("all");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const user = session?.user as any;
  const tieneUnidad = !!user?.unidadId;

  useEffect(() => {
    fetchData();
  }, []);

  // Modo edición: precarga el carrito con las líneas del borrador
  useEffect(() => {
    if (pedidoEditar) {
      setCarrito(
        (pedidoEditar.items || []).map((item: any) => ({
          productoId: item.productoId,
          producto: item.producto,
          cantidad: toNumber(item.cantidad),
          precioUnitario: toNumber(item.precioUnitario),
        }))
      );
      setNotas(pedidoEditar.notas || "");
    } else {
      setCarrito([]);
      setNotas("");
    }
  }, [pedidoEditar]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, provRes, catRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/proveedores"),
        fetch("/api/categorias"),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data?.productos || []);
      }
      if (provRes.ok) {
        const data = await provRes.json();
        setProveedores(data?.proveedores || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorias(data?.categorias || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda = p.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || "");
    const matchCategoria = filtroCategoria === "all" || p.categoriaId === parseInt(filtroCategoria);
    const matchProveedor = filtroProveedor === "all" || p.proveedorId === parseInt(filtroProveedor);
    return matchBusqueda && matchCategoria && matchProveedor && p.activo;
  });

  const agregarAlCarrito = (producto: any) => {
    const existente = carrito.find((item) => item.productoId === producto.id);
    if (existente) {
      setCarrito(
        carrito.map((item) =>
          item.productoId === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setCarrito([
        ...carrito,
        {
          productoId: producto.id,
          producto: producto,
          cantidad: 1,
          precioUnitario: toNumber(producto.precioUnitario),
        },
      ]);
    }
    toast({ title: `${producto.nombre} agregado al carrito` });
  };

  const actualizarCantidad = (productoId: number, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarDelCarrito(productoId);
      return;
    }
    setCarrito(
      carrito.map((item) =>
        item.productoId === productoId ? { ...item, cantidad } : item
      )
    );
  };

  const eliminarDelCarrito = (productoId: number) => {
    setCarrito(carrito.filter((item) => item.productoId !== productoId));
  };

  const totalPedido = carrito.reduce(
    (acc, item) => acc + item.cantidad * item.precioUnitario,
    0
  );

  const guardarPedido = async (estado: "borrador" | "enviado") => {
    if (carrito.length === 0) {
      toast({ title: "El carrito está vacío", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const items = carrito.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
      }));

      const esEdicion = !!pedidoEditar;
      const res = await apiFetch(
        esEdicion ? `/api/pedidos/${pedidoEditar.id}` : "/api/pedidos",
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            notas,
            estado,
          }),
        }
      );

      if (!res.ok && res.status !== 202) {
        const err = await res.json();
        throw new Error(err?.error || "Error al guardar pedido");
      }

      toast({
        title: esEdicion
          ? estado === "borrador"
            ? `Borrador #${pedidoEditar.id} actualizado`
            : `Pedido #${pedidoEditar.id} actualizado y enviado`
          : estado === "borrador"
            ? "Pedido guardado como borrador"
            : "Pedido enviado",
        description: `${carrito.length} productos en el pedido`,
      });

      setCarrito([]);
      setNotas("");
      if (esEdicion) onCancelarEdicion?.();
      onPedidoCreated();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo guardar el pedido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Mostrar advertencia si no tiene unidad asignada
  if (!tieneUnidad) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-amber-800">
              Sin Unidad Asignada
            </h3>
            <p className="text-amber-700 max-w-md">
              Para crear pedidos, primero necesitas tener una unidad de negocio asignada.
              Contacta al administrador para que te asigne una unidad o crea una desde el panel de administración.
            </p>
            <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-100 px-4 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>Ir a Admin → Unidades para crear una unidad</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pedidoEditar && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-blue-800">
            ✏️ Editando borrador <strong>#{pedidoEditar.id}</strong> — modifica el carrito y guarda
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancelarEdicion?.()}
            className="border-blue-300 text-blue-700"
          >
            Cancelar edición
          </Button>
        </div>
      )}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product List */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Catálogo de Productos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {productosFiltrados.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No se encontraron productos</p>
                </div>
              ) : (
                productosFiltrados.map((producto) => {
                  const enCarrito = carrito.find((c) => c.productoId === producto.id);
                  return (
                    <div
                      key={producto.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {producto.nombre}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-slate-500">
                          <span>{producto.unidadMedida}</span>
                        </div>
                        {(producto.fabricante || producto.formato) && (
                          <p className="text-xs text-slate-400 truncate">
                            {producto.fabricante && <span>🏭 {producto.fabricante}</span>}
                            {producto.fabricante && producto.formato && <span className="mx-1">·</span>}
                            {producto.formato && <span>📦 {producto.formato}</span>}
                          </p>
                        )}
                        {producto.proveedor && (
                          <p className="text-xs text-slate-400 truncate">
                            {producto.proveedor.nombre}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        {enCarrito && (
                          <Badge variant="secondary">{enCarrito.cantidad}</Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => agregarAlCarrito(producto)}
                          className="shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shopping Cart */}
      <div className="space-y-4">
        <Card className="sticky top-24">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span>Carrito</span>
              </div>
              <Badge>{carrito.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {carrito.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Carrito vacío</p>
                <p className="text-sm">Agrega productos del catálogo</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {carrito.map((item) => (
                    <div
                      key={item.productoId}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">
                          {item.producto.nombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.producto.unidadMedida}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => actualizarCantidad(item.productoId, item.cantidad - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarCantidad(item.productoId, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 h-7 text-center text-sm"
                          step="0.01"
                          min="0"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => actualizarCantidad(item.productoId, item.cantidad + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => eliminarDelCarrito(item.productoId)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen */}
                <div className="border-t pt-4 space-y-2">
                  {carrito.map((item) => (
                    <div key={item.productoId} className="flex justify-between text-sm">
                      <span className="text-slate-600 truncate max-w-[70%]">
                        {item.producto.nombre}
                      </span>
                      <span className="font-medium">
                        {formatDecimal(item.cantidad)} {item.producto.unidadMedida}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total Items */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Productos</span>
                    <span className="text-blue-600">{carrito.length} items</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700">Notas (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-lg text-sm resize-none"
                    rows={2}
                    placeholder="Instrucciones especiales..."
                  />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => guardarPedido("borrador")}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {pedidoEditar ? "Guardar cambios" : "Borrador"}
                  </Button>
                  <Button
                    onClick={() => guardarPedido("enviado")}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}

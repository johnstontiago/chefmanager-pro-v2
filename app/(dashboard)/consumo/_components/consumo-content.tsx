"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  UtensilsCrossed,
  Search,
  QrCode,
  Package,
  Loader2,
  Minus,
  AlertTriangle,
  History,
  Tag,
  Printer,
  MapPin,
  Calendar,
  CheckCircle,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDecimal, formatDate, formatDateTime, toNumber, getDaysUntilExpiry, getExpiryStatus } from "@/lib/utils";
import QrScanner from "@/components/qr-scanner";
import EtiquetasTab from "./etiquetas-tab";

interface ConsumoContentProps {
  userRole: string;
}

// Unidad de visualización del stock: base (g/ml) si está definida, si no la de compra
const unidadDe = (producto: any) =>
  producto?.unidadBase ?? producto?.contenidoUnidad ?? producto?.unidadMedida ?? "";

export default function ConsumoContent({ userRole }: ConsumoContentProps) {
  const { toast } = useToast();
  const [inventario, setInventario] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [preparaciones, setPreparaciones] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [codigoQR, setCodigoQR] = useState("");
  const [modoStock, setModoStock] = useState<"productos" | "preparaciones">("productos");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<"consumo" | "merma">("consumo");
  const [cantidad, setCantidad] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, prodRes, movRes, prepRes] = await Promise.all([
        fetch("/api/inventario/lotes"),
        fetch("/api/productos"),
        fetch("/api/movimientos?limit=50"),
        fetch("/api/inventario/elaboraciones"),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInventario(data?.inventario || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data?.productos || []);
      }
      if (movRes.ok) {
        const data = await movRes.json();
        setMovimientos(data?.movimientos || []);
      }
      if (prepRes.ok) {
        const data = await prepRes.json();
        setPreparaciones(data?.elaboraciones || []);
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

  // Products with stock
  const productosConStock = productos.filter(
    (prod) => inventarioByProducto[prod.id] && inventarioByProducto[prod.id].length > 0
  );

  // Filter products
  const productosFiltrados = productosConStock.filter((prod) =>
    prod.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || "")
  );

  // Preparaciones (elaboraciones) con stock + filtro
  const preparacionesFiltradas = preparaciones
    .filter((e) => (e.lotes?.length || 0) > 0)
    .filter((e) => e.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || ""));

  // Lotes de preparación en forma "seleccionable" (mismo shape que un lote de producto)
  const prepLoteToItem = (e: any, l: any) => ({
    id: l.id,
    tipo: "preparacion" as const,
    elaboracionId: e.id,
    cantidad: l.cantidadActual,
    lote: l.numeroLote,
    codigoUnico: l.codigoUnico,
    fechaCaducidad: l.fechaCaducidad,
    producto: { nombre: e.nombre, unidadBase: e.unidadBase },
  });

  const buscarPorCodigo = (codigo: string) => {
    const cod = codigo.toLowerCase().trim();
    // Busca primero en materias primas, luego en preparaciones
    const inv = inventario.find((i) => i.codigoUnico?.toLowerCase() === cod);
    if (inv) {
      setSelectedItem({ ...inv, tipo: "producto" });
      setCantidad("1"); setCodigoQR(""); setShowQrScanner(false);
      return;
    }
    for (const e of preparaciones) {
      const l = (e.lotes || []).find((x: any) => x.codigoUnico?.toLowerCase() === cod);
      if (l) {
        setSelectedItem(prepLoteToItem(e, l));
        setModoStock("preparaciones");
        setCantidad("1"); setCodigoQR(""); setShowQrScanner(false);
        return;
      }
    }
    toast({ title: "Código no encontrado", variant: "destructive" });
  };

  const buscarPorQR = () => {
    if (!codigoQR.trim()) return;
    buscarPorCodigo(codigoQR);
  };

  const seleccionarLote = (inv: any) => {
    setSelectedItem(inv.tipo ? inv : { ...inv, tipo: "producto" });
    setCantidad("1");
    setNotas("");
    setTipoMovimiento("consumo");
  };

  const registrarMovimiento = async () => {
    if (!selectedItem) return;

    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({ title: "Cantidad inválida", variant: "destructive" });
      return;
    }

    if (cantidadNum > toNumber(selectedItem.cantidad)) {
      toast({ title: "Cantidad mayor al stock disponible", variant: "destructive" });
      return;
    }

    if (tipoMovimiento === "merma" && !notas.trim()) {
      toast({ title: "Las notas son obligatorias para mermas", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      const esPreparacion = selectedItem.tipo === "preparacion";
      const res = await apiFetch(
        esPreparacion ? "/api/consumo/preparacion" : "/api/consumo/registrar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            esPreparacion
              ? {
                  loteElaboracionId: selectedItem.id,
                  cantidad: cantidadNum,
                  motivo: tipoMovimiento === "merma" ? "MERMA" : "CONSUMO",
                  notas: notas || null,
                }
              : {
                  loteId: selectedItem.id,
                  cantidad: cantidadNum,
                  motivo: tipoMovimiento === "merma" ? "MERMA" : "CONSUMO",
                  notas: notas || null,
                }
          ),
        }
      );

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al registrar");
      }

      const unidadDisplay =
        selectedItem.producto?.unidadBase ??
        selectedItem.producto?.contenidoUnidad ??
        selectedItem.producto?.unidadMedida;
      toast({
        title: tipoMovimiento === "consumo" ? "Consumo registrado" : "Merma registrada",
        description: `${formatDecimal(cantidadNum)} ${unidadDisplay} de ${selectedItem.producto?.nombre}`,
      });

      setSelectedItem(null);
      setCantidad("");
      setNotas("");
      fetchData();
    } catch (error) {
      toast({ title: "Error al registrar movimiento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getExpiryBadge = (inv: any) => {
    const status = getExpiryStatus(inv.fechaCaducidad);
    const days = getDaysUntilExpiry(inv.fechaCaducidad);

    if (status === "expired") {
      return <Badge className="bg-red-500 text-white">Caducado</Badge>;
    }
    if (status === "warning") {
      return <Badge className="bg-yellow-500 text-white">{days} días</Badge>;
    }
    return null;
  };

  const getMovementIcon = (tipo: string) => {
    switch (tipo) {
      case "consumo":
        return <UtensilsCrossed className="w-4 h-4 text-blue-500" />;
      case "merma":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "entrada":
        return <Package className="w-4 h-4 text-green-500" />;
      default:
        return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const getMovementBadge = (tipo: string) => {
    switch (tipo) {
      case "consumo":
        return <Badge className="bg-blue-100 text-blue-700">Consumo</Badge>;
      case "merma":
        return <Badge className="bg-red-100 text-red-700">Merma</Badge>;
      case "entrada":
        return <Badge className="bg-green-100 text-green-700">Entrada</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
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
        <h1 className="text-2xl font-bold text-slate-800">Consumo y Mermas</h1>
        <p className="text-slate-500">Registra el consumo de productos y mermas</p>
      </div>

      <Tabs defaultValue="registrar">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="registrar" className="flex-1 sm:flex-none flex items-center justify-center gap-2">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Registrar</span>
          </TabsTrigger>
          <TabsTrigger value="etiquetas" className="flex-1 sm:flex-none flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" />
            <span>Etiquetas</span>
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex-1 sm:flex-none flex items-center justify-center gap-2">
            <History className="w-4 h-4" />
            <span>Historial</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrar" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* QR Search — siempre arriba */}
            <Card className="lg:col-span-3 order-1">
              <CardContent className="py-4 space-y-3">

                {/* Título en línea propia — nunca compite con los botones */}
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Búsqueda rápida por código</span>
                </div>

                {/* Input + botones en fila dedicada — siempre cabe en cualquier ancho */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Código QR o único..."
                    value={codigoQR}
                    onChange={(e) => setCodigoQR(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarPorQR()}
                    className="flex-1 min-w-0"
                  />
                  {/* Móvil: solo icono (44px mín.). sm+: icono + texto */}
                  <Button
                    onClick={buscarPorQR}
                    variant="outline"
                    className="flex-shrink-0 min-w-[44px] px-2 sm:px-4"
                    aria-label="Buscar"
                  >
                    <Search className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Buscar</span>
                  </Button>
                  <Button
                    onClick={() => setShowQrScanner((v) => !v)}
                    variant={showQrScanner ? "default" : "outline"}
                    className={`flex-shrink-0 min-w-[44px] px-2 sm:px-4 ${showQrScanner ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    aria-label={showQrScanner ? "Cerrar cámara" : "Escanear código QR"}
                  >
                    <QrCode className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">{showQrScanner ? "Cerrar" : "Escanear"}</span>
                  </Button>
                </div>

                {showQrScanner && (
                  <div className="w-full max-w-xs">
                    <QrScanner
                      onScan={(val) => buscarPorCodigo(val)}
                      onClose={() => setShowQrScanner(false)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Formulario — orden 2 en móvil (justo tras QR), columna derecha en desktop */}
            <div className="order-2 lg:order-3">
              <Card className="lg:sticky top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2">
                    <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                    <span>Registrar Movimiento</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedItem ? (
                    <div className="text-center py-8 text-slate-500">
                      <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Selecciona un producto/lote</p>
                    </div>
                  ) : (
                    <>
                      {/* Selected Item Info */}
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{selectedItem.producto?.nombre}</h4>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setSelectedItem(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          {(selectedItem.producto?.fabricante || selectedItem.producto?.formato) && (
                            <p className="text-xs text-slate-400">
                              {selectedItem.producto?.fabricante && <span>🏭 {selectedItem.producto.fabricante}</span>}
                              {selectedItem.producto?.fabricante && selectedItem.producto?.formato && <span className="mx-1">·</span>}
                              {selectedItem.producto?.formato && <span>📦 {selectedItem.producto.formato}</span>}
                            </p>
                          )}
                          {selectedItem.lote && <p>Lote: {selectedItem.lote}</p>}
                          {selectedItem.ubicacion && <p>Ubicación: {selectedItem.ubicacion}</p>}
                          <p className="font-semibold text-lg text-slate-800">
                            Stock: {formatDecimal(selectedItem.cantidad)} {unidadDe(selectedItem.producto)}
                          </p>
                        </div>
                      </div>

                      {/* Movement Type */}
                      <div>
                        <Label>Tipo de movimiento</Label>
                        <Select value={tipoMovimiento} onValueChange={(v: any) => setTipoMovimiento(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consumo">
                              <div className="flex items-center">
                                <UtensilsCrossed className="w-4 h-4 mr-2 text-blue-500" />
                                Consumo
                              </div>
                            </SelectItem>
                            <SelectItem value="merma">
                              <div className="flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                                Merma
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <Label>Cantidad (decimal permitido)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={toNumber(selectedItem.cantidad)}
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                          placeholder="Ej: 0.5, 1.25, 3"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Máx: {formatDecimal(selectedItem.cantidad)} {unidadDe(selectedItem.producto)}
                        </p>
                      </div>

                      {/* Notes */}
                      <div>
                        <Label>
                          Notas {tipoMovimiento === "merma" && <span className="text-red-500">*</span>}
                        </Label>
                        <textarea
                          value={notas}
                          onChange={(e) => setNotas(e.target.value)}
                          className="w-full p-2 border rounded-lg text-sm resize-none"
                          rows={3}
                          placeholder={tipoMovimiento === "merma" ? "Razón de la merma (obligatorio)" : "Notas opcionales"}
                        />
                      </div>

                      {/* Submit */}
                      <Button
                        onClick={registrarMovimiento}
                        disabled={saving}
                        className={`w-full ${tipoMovimiento === "merma" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : tipoMovimiento === "consumo" ? (
                          <UtensilsCrossed className="w-4 h-4 mr-2" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 mr-2" />
                        )}
                        Registrar {tipoMovimiento === "consumo" ? "Consumo" : "Merma"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lista de productos — orden 3 en móvil, col-span-2 en desktop */}
            <div className="lg:col-span-2 space-y-4 order-3 lg:order-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span>Seleccionar {modoStock === "preparaciones" ? "Preparación" : "Producto"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Toggle materias primas / preparaciones */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setModoStock("productos"); setSelectedItem(null); }}
                      className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                        modoStock === "productos"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Materias primas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setModoStock("preparaciones"); setSelectedItem(null); }}
                      className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                        modoStock === "preparaciones"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Preparaciones
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={modoStock === "preparaciones" ? "Buscar preparación..." : "Buscar producto..."}
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Lista de PREPARACIONES */}
                  {modoStock === "preparaciones" ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                      {preparacionesFiltradas.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No hay preparaciones con stock</p>
                        </div>
                      ) : (
                        preparacionesFiltradas.map((e) => (
                          <div key={e.id} className="border rounded-lg p-3 hover:bg-slate-50">
                            <h4 className="font-semibold text-slate-800">{e.nombre}</h4>
                            <div className="mt-2 space-y-2">
                              {(e.lotes || []).map((l: any) => {
                                const item = prepLoteToItem(e, l);
                                return (
                                  <div
                                    key={l.id}
                                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg cursor-pointer transition-colors gap-1 ${
                                      selectedItem?.tipo === "preparacion" && selectedItem?.id === l.id
                                        ? "bg-amber-100 border-amber-300 border"
                                        : "bg-slate-100 hover:bg-slate-200"
                                    }`}
                                    onClick={() => seleccionarLote(item)}
                                  >
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      {l.numeroLote && (
                                        <span className="flex items-center text-sm">
                                          <Tag className="w-4 h-4 mr-1 text-slate-400" />{l.numeroLote}
                                        </span>
                                      )}
                                      {l.numeroEnvases != null && (
                                        <span className="text-xs text-slate-500">{l.numeroEnvases} envase(s)</span>
                                      )}
                                      {l.fechaCaducidad && (
                                        <span className="flex items-center text-sm">
                                          <Calendar className="w-4 h-4 mr-1 text-slate-400" />{formatDate(l.fechaCaducidad)}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-semibold text-sm sm:text-base">
                                      {formatDecimal(l.cantidadActual)} {e.unidadBase}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {productosFiltrados.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay productos con stock</p>
                      </div>
                    ) : (
                      productosFiltrados.map((prod) => {
                        const lotes = inventarioByProducto[prod.id] || [];
                        return (
                          <div key={prod.id} className="border rounded-lg p-3 hover:bg-slate-50">
                            <h4 className="font-semibold text-slate-800">{prod.nombre}</h4>
                            {(prod.fabricante || prod.formato) && (
                              <p className="text-xs text-slate-400 mb-1">
                                {prod.fabricante && <span>🏭 {prod.fabricante}</span>}
                                {prod.fabricante && prod.formato && <span className="mx-1">·</span>}
                                {prod.formato && <span>📦 {prod.formato}</span>}
                              </p>
                            )}
                            <div className="mt-2 space-y-2">
                              {lotes.map((inv: any) => (
                                <div
                                  key={inv.id}
                                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg cursor-pointer transition-colors gap-1 ${
                                    selectedItem?.id === inv.id
                                      ? "bg-blue-100 border-blue-300 border"
                                      : "bg-slate-100 hover:bg-slate-200"
                                  }`}
                                  onClick={() => seleccionarLote(inv)}
                                >
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
                                    {inv.fechaCaducidad && (
                                      <span className="flex items-center text-sm">
                                        <Calendar className="w-4 h-4 mr-1 text-slate-400" />
                                        {formatDate(inv.fechaCaducidad)}
                                      </span>
                                    )}
                                    {getExpiryBadge(inv)}
                                  </div>
                                  <span className="font-semibold text-sm sm:text-base">
                                    {formatDecimal(inv.cantidad)} {unidadDe(prod)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="etiquetas" className="mt-6">
          <EtiquetasTab inventario={inventario} />
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movimientos.map((mov) => (
                    <div key={mov.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-lg gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">{getMovementIcon(mov.tipo)}</div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{mov.producto?.nombre}</p>
                          <p className="text-sm text-slate-500">
                            {formatDecimal(mov.cantidad)} {mov.producto?.unidadMedida}
                            {mov.lote && ` • Lote: ${mov.lote}`}
                          </p>
                          {mov.notas && <p className="text-xs text-slate-400 mt-1">{mov.notas}</p>}
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-1 pl-7 sm:pl-0 flex-shrink-0">
                        {getMovementBadge(mov.tipo)}
                        <div className="text-right">
                          <p className="text-xs text-slate-600">{formatDateTime(mov.fecha)}</p>
                          <p className="text-xs text-slate-400">{mov.usuario?.nombre}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

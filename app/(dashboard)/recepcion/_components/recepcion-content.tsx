"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Package, Truck, History, Loader2, AlertTriangle,
  CheckCircle, Calendar, ArrowRight, Download, XCircle,
  Printer, Bluetooth,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDecimal, toNumber, generateUniqueCode } from "@/lib/utils";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import ScanEtiqueta from "./scan-etiqueta";

interface RecepcionContentProps {
  userRole: string;
}

interface ItemForm {
  cantidadRecibida: number;
  lote: string;
  fechaCaducidad: string;
  ubicacion: string;
  codigoUnico: string;
  nuevoPrecio: string;
}

type EstadoLinea = "pendiente" | "recibida" | "parcial";

interface ItemState extends ItemForm {
  estado: EstadoLinea;
}

// ---------- localStorage helpers ----------
const storageKey = (pedidoId: number) => `chef_recepcion_${pedidoId}`;

const saveToLocal = (pedidoId: number, states: Record<number, ItemState>) => {
  try { localStorage.setItem(storageKey(pedidoId), JSON.stringify(states)); } catch {}
};

const loadFromLocal = (pedidoId: number): Record<number, ItemState> | null => {
  try {
    const raw = localStorage.getItem(storageKey(pedidoId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearLocal = (pedidoId: number) => {
  try { localStorage.removeItem(storageKey(pedidoId)); } catch {}
};
// ------------------------------------------

export default function RecepcionContent({ userRole }: RecepcionContentProps) {
  const { toast } = useToast();
  const { status: printerStatus, deviceName, isSupported: bluetoothSupported, connect: connectPrinter, printLabel } = useBluetoothPrinter();
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [historialRecepciones, setHistorialRecepciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({});
  const [drawerItem, setDrawerItem] = useState<any>(null);
  const [drawerForm, setDrawerForm] = useState<ItemForm | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showCerrarConfirm, setShowCerrarConfirm] = useState(false);

  // Catálogo de productos (para "producto sustituto")
  const [productos, setProductos] = useState<any[]>([]);

  // Estado de "la mercancía llegó diferente" (variante de recepción)
  const [varianteOpen, setVarianteOpen] = useState(false);
  const [tipoVariante, setTipoVariante] = useState<"formato" | "sustituto">("formato");
  const [formatoModo, setFormatoModo] = useState<"factor" | "piezas">("factor");
  const [factorConv, setFactorConv] = useState("");
  const [varianteNombre, setVarianteNombre] = useState("");
  const [piezasRecep, setPiezasRecep] = useState<{ id: number; pesoKg: string }[]>([
    { id: 1, pesoKg: "" },
  ]);
  const [sustitutoId, setSustitutoId] = useState<number | null>(null);

  const resetVariante = () => {
    setVarianteOpen(false);
    setTipoVariante("formato");
    setFormatoModo("factor");
    setFactorConv("");
    setVarianteNombre("");
    setPiezasRecep([{ id: 1, pesoKg: "" }]);
    setSustitutoId(null);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pedRes, movRes, prodRes] = await Promise.all([
        fetch("/api/pedidos"),
        fetch("/api/movimientos?tipo=entrada&limit=50"),
        fetch("/api/productos"),
      ]);
      if (pedRes.ok) {
        const data = await pedRes.json();
        setPedidosPendientes(
          (data?.pedidos || []).filter((p: any) =>
            p.estado === "enviado" || p.estado === "en_recepcion"
          )
        );
      }
      if (movRes.ok) {
        const data = await movRes.json();
        setHistorialRecepciones(data?.movimientos || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data?.productos || []);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  const iniciarRecepcion = (pedido: any) => {
    setSelectedPedido(pedido);

    // Estado base desde la DB
    const fromDB: Record<number, ItemState> = {};
    pedido.items?.forEach((item: any) => {
      if (item.estadoLinea && item.estadoLinea !== "pendiente") {
        fromDB[item.id] = {
          cantidadRecibida: toNumber(item.cantidadRecibida),
          lote: item.lote || "",
          fechaCaducidad: item.fechaCaducidad
            ? new Date(item.fechaCaducidad).toISOString().slice(0, 10)
            : "",
          ubicacion: "",
          codigoUnico: "",
          nuevoPrecio: "",
          estado: item.estadoLinea as EstadoLinea,
        };
      } else {
        fromDB[item.id] = {
          cantidadRecibida: toNumber(item.cantidad),
          lote: "",
          fechaCaducidad: "",
          ubicacion: "",
          codigoUnico: generateUniqueCode(),
          nuevoPrecio: "",
          estado: "pendiente",
        };
      }
    });

    // localStorage puede tener datos más recientes (guardado inmediatamente al confirmar)
    const fromLocal = loadFromLocal(pedido.id);
    if (fromLocal) {
      // Mezcla: localStorage tiene prioridad sobre DB para ítems que existan
      const merged: Record<number, ItemState> = { ...fromDB };
      for (const [id, state] of Object.entries(fromLocal)) {
        if (merged[Number(id)]) merged[Number(id)] = state;
      }
      setItemStates(merged);
    } else {
      setItemStates(fromDB);
    }
  };

  const abrirDrawerItem = (item: any) => {
    const state = itemStates[item.id];
    resetVariante();
    setDrawerItem(item);
    setDrawerForm({
      cantidadRecibida: state?.cantidadRecibida ?? toNumber(item.cantidad),
      lote: state?.lote ?? "",
      fechaCaducidad: state?.fechaCaducidad ?? "",
      ubicacion: state?.ubicacion ?? "",
      codigoUnico: state?.codigoUnico ?? generateUniqueCode(),
      nuevoPrecio: state?.nuevoPrecio ?? "",
    });
  };

  const archivarPedido = async (estado: "recibido" | "recibido_parcial") => {
    if (!selectedPedido) return;
    try {
      setArchiving(true);
      const res = await apiFetch(`/api/pedidos/${selectedPedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok && res.status !== 202) {
        throw new Error(`Error ${res.status} al actualizar el pedido`);
      }
      clearLocal(selectedPedido.id);
      toast({
        title: estado === "recibido" ? "Pedido completamente recibido" : "Recepción cerrada",
        description: estado === "recibido"
          ? "Todos los ítems han sido registrados en inventario."
          : "Los ítems no recibidos han sido descartados.",
      });
      setSelectedPedido(null);
      setItemStates({});
      fetchData();
    } catch {
      toast({ title: "Error al archivar el pedido", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  // Guarda el ítem en DB inmediatamente; si era el último pendiente, archiva el pedido
  const guardarItemRecibido = async () => {
    if (!drawerItem || !drawerForm || !selectedPedido) return;

    const cantPedida = toNumber(drawerItem.cantidad);

    // Resolver producto destino: sustituto o el del pedido
    const esSustituto = varianteOpen && tipoVariante === "sustituto";
    const productoDestinoId = esSustituto && sustitutoId ? sustitutoId : drawerItem.productoId;
    if (esSustituto && !sustitutoId) {
      toast({ title: "Selecciona el producto sustituto", variant: "destructive" });
      return;
    }

    // Modo piezas (peso variable) solo si variante formato + piezas
    const esPiezas =
      varianteOpen && tipoVariante === "formato" && formatoModo === "piezas";
    const factor =
      varianteOpen && tipoVariante === "formato" && formatoModo === "factor"
        ? parseFloat(factorConv) || 1
        : 1;

    // El estado de la línea se calcula igual que en el servidor (informativo en UI)
    const estadoLinea: EstadoLinea =
      esSustituto || esPiezas || drawerForm.cantidadRecibida >= cantPedida
        ? "recibida"
        : "parcial";

    try {
      setSavingItem(true);

      const payload: any = {
        pedidoItemId: drawerItem.id,
        productoId: productoDestinoId,
        cantidadPedida: cantPedida,
        lote: drawerForm.lote || null,
        fechaCaducidad: drawerForm.fechaCaducidad || null,
        ubicacion: drawerForm.ubicacion || null,
        codigoUnico: drawerForm.codigoUnico || null,
        nuevoPrecio: drawerForm.nuevoPrecio ? parseFloat(drawerForm.nuevoPrecio) : null,
        esSustituto,
        notaSustituto: esSustituto
          ? `Pedido: ${drawerItem.producto?.nombre}`
          : undefined,
      };

      if (esPiezas) {
        payload.modo = "piezas";
        payload.piezas = piezasRecep
          .map((p) => parseFloat(p.pesoKg))
          .filter((n) => n > 0);
      } else {
        payload.modo = "normal";
        payload.cantidad = drawerForm.cantidadRecibida;
        payload.factorConversion = factor;
        if (varianteNombre.trim()) payload.varianteNombre = varianteNombre.trim();
      }

      const res = await apiFetch("/api/recepcion/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al registrar");
      }

      // Marcar el pedido como en recepción para que permanezca en la lista
      await apiFetch(`/api/pedidos/${selectedPedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "en_recepcion" }),
      });

      const newItemStates: Record<number, ItemState> = {
        ...itemStates,
        [drawerItem.id]: { ...drawerForm, estado: estadoLinea },
      };

      // localStorage primero — sobrevive reload inmediatamente
      saveToLocal(selectedPedido.id, newItemStates);
      setItemStates(newItemStates);

      if (printerStatus === "connected") {
        try {
          await printLabel({
            nombre:      drawerItem.producto?.nombre ?? "",
            fabricante:  drawerItem.producto?.fabricante ?? "",
            lote:        drawerForm.lote,
            cadEmbalaje: drawerForm.fechaCaducidad,
            codigoUnico: drawerForm.codigoUnico,
            cantidad:    drawerForm.cantidadRecibida,
          });
          toast({ title: `${drawerItem.producto?.nombre} registrado · Etiqueta impresa` });
        } catch (printErr) {
          const msg = printErr instanceof Error ? printErr.message : "Error desconocido";
          toast({ title: `${drawerItem.producto?.nombre} registrado`, description: `Etiqueta: ${msg}`, variant: "destructive" });
        }
      } else {
        toast({ title: `${drawerItem.producto?.nombre} registrado en inventario` });
      }
      setDrawerItem(null);
      setDrawerForm(null);

      // Si todos los ítems están procesados, archivar automáticamente
      const todosRecibidos = selectedPedido.items?.every(
        (item: any) => newItemStates[item.id]?.estado !== "pendiente"
      );
      if (todosRecibidos) {
        await archivarPedido("recibido");
      }
    } catch {
      toast({ title: "Error al registrar el ítem", variant: "destructive" });
    } finally {
      setSavingItem(false);
    }
  };

  const descargarCSV = () => {
    if (!selectedPedido) return;
    const filas = selectedPedido.items?.map((item: any) => {
      const s = itemStates[item.id];
      if (!s || s.estado === "pendiente") return null;
      return [
        selectedPedido.id,
        item.producto?.nombre ?? "",
        item.producto?.unidadMedida ?? "",
        formatDecimal(item.cantidad),
        formatDecimal(s.cantidadRecibida),
        s.lote ?? "",
        s.fechaCaducidad ?? "",
        s.ubicacion ?? "",
        s.codigoUnico ?? "",
        s.estado,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    }).filter(Boolean) ?? [];

    if (filas.length === 0) {
      toast({ title: "No hay ítems recibidos para exportar", variant: "destructive" });
      return;
    }

    const cabecera = ["Pedido#", "Producto", "Unidad", "Cant.Pedida", "Cant.Recibida", "Lote", "Fecha Caducidad", "Ubicación", "Código Único", "Estado"].join(",");
    const csv = [cabecera, ...filas].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recepcion-pedido-${selectedPedido.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const itemsPendientesCount = selectedPedido?.items?.filter(
    (i: any) => itemStates[i.id]?.estado === "pendiente"
  ).length ?? 0;

  const itemsRecibidosCount = selectedPedido?.items?.filter(
    (i: any) => itemStates[i.id]?.estado !== "pendiente"
  ).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Recepción de Mercancía</h1>
        <p className="text-slate-500">Recibe y registra la mercancía de los pedidos</p>
      </div>

      {!selectedPedido ? (
        <Tabs defaultValue="pendientes">
          <TabsList>
            <TabsTrigger value="pendientes" className="flex items-center space-x-2">
              <Truck className="w-4 h-4" />
              <span>Pendientes ({pedidosPendientes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center space-x-2">
              <History className="w-4 h-4" />
              <span>Historial</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes" className="mt-6">
            {pedidosPendientes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-slate-800">Todo al día</h3>
                  <p className="text-slate-500">No hay pedidos pendientes de recibir</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pedidosPendientes.map((pedido) => (
                  <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-bold text-xl">Pedido #{pedido.id}</span>
                            {pedido.estado === "en_recepcion" ? (
                              <Badge className="bg-orange-100 text-orange-700">En recepción</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-700">Enviado</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(pedido.fechaPedido)}
                            </span>
                            <span className="flex items-center">
                              <Package className="w-4 h-4 mr-1" />
                              {pedido.items?.length || 0} productos
                            </span>
                            <span className="font-semibold">{formatCurrency(pedido.total)}</span>
                          </div>
                          {pedido.notas && (
                            <p className="text-sm text-slate-500 mt-2">{pedido.notas}</p>
                          )}
                        </div>
                        <Button
                          onClick={() => iniciarRecepcion(pedido)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Recibir Mercancía
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historial" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Recepciones</CardTitle>
              </CardHeader>
              <CardContent>
                {historialRecepciones.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No hay recepciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historialRecepciones.map((mov) => (
                      <div key={mov.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{mov.producto?.nombre}</p>
                            <p className="text-sm text-slate-500">
                              {formatDecimal(mov.cantidad)} {mov.producto?.unidadMedida} • Lote: {mov.lote || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-600">{formatDate(mov.fecha)}</p>
                          <p className="text-xs text-slate-400">{mov.usuario?.nombre}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* Vista de recepción ítem por ítem */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Pedido #{selectedPedido.id}</h2>
              <p className="text-sm text-slate-500">
                {itemsRecibidosCount} de {selectedPedido.items?.length} ítems registrados
              </p>
            </div>
            <div className="flex items-center gap-2">
              {bluetoothSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connectPrinter}
                  disabled={printerStatus === "connecting" || printerStatus === "printing"}
                  className={printerStatus === "connected" ? "border-green-500 text-green-600" : ""}
                >
                  {printerStatus === "connecting" || printerStatus === "printing" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : printerStatus === "connected" ? (
                    <Bluetooth className="w-4 h-4 mr-1" />
                  ) : (
                    <Printer className="w-4 h-4 mr-1" />
                  )}
                  {printerStatus === "connected" ? (deviceName ?? "Conectado") : "Impresora"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500"
                onClick={() => { setSelectedPedido(null); setItemStates({}); }}
              >
                Volver
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            Cada ítem que confirmes se <strong>registra inmediatamente</strong> en el inventario. Cuando el último ítem sea recibido, el pedido se archivará automáticamente.
          </div>

          {/* Lista de ítems */}
          <div className="space-y-3">
            {selectedPedido.items?.map((item: any) => {
              const state = itemStates[item.id];
              const recibido = state?.estado === "recibida" || state?.estado === "parcial";
              const parcial = state?.estado === "parcial";

              return (
                <Card
                  key={item.id}
                  className={
                    recibido
                      ? parcial
                        ? "border-yellow-300 bg-yellow-50"
                        : "border-green-300 bg-green-50"
                      : ""
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${recibido ? "line-through opacity-50" : ""}`}>
                          {item.producto?.nombre}
                        </p>
                        {(item.producto?.fabricante || item.producto?.formato) && (
                          <p className="text-xs text-slate-400">
                            {item.producto?.fabricante && <span>🏭 {item.producto.fabricante}</span>}
                            {item.producto?.fabricante && item.producto?.formato && <span className="mx-1">·</span>}
                            {item.producto?.formato && <span>📦 {item.producto.formato}</span>}
                          </p>
                        )}
                        <p className="text-sm text-slate-500">
                          Pedido: {formatDecimal(item.cantidad)} {item.producto?.unidadMedida}
                          {recibido && (
                            <span className="ml-2 text-slate-600">
                              → Recibido: {formatDecimal(state.cantidadRecibida)}
                              {state.lote && ` • Lote: ${state.lote}`}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {recibido ? (
                          <Badge className={parcial ? "bg-yellow-500" : "bg-green-500"}>
                            {parcial ? (
                              <><AlertTriangle className="w-3 h-3 mr-1" />Parcial</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" />Recibido</>
                            )}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => abrirDrawerItem(item)}
                          >
                            Confirmar recepción
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Acciones al pie de la lista */}
          <div className="space-y-2 pt-2">
            {itemsRecibidosCount > 0 && (
              <Button variant="outline" className="w-full" onClick={descargarCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV ({itemsRecibidosCount} ítem{itemsRecibidosCount !== 1 ? "s" : ""} recibido{itemsRecibidosCount !== 1 ? "s" : ""})
              </Button>
            )}

            {itemsPendientesCount === 0 && itemsRecibidosCount > 0 && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                disabled={archiving}
                onClick={() => archivarPedido("recibido")}
              >
                {archiving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Finalizar recepción del pedido
              </Button>
            )}

            {itemsPendientesCount > 0 && (
              <Button
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50"
                disabled={archiving}
                onClick={() => setShowCerrarConfirm(true)}
              >
                {archiving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Cerrar recepción del pedido
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Drawer de recepción por ítem */}
      <Drawer
        open={!!drawerItem}
        onOpenChange={(open) => { if (!open && !savingItem) { setDrawerItem(null); setDrawerForm(null); } }}
      >
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              {drawerItem?.producto?.nombre}
            </DrawerTitle>
            <p className="text-sm text-slate-500 mt-1">
              Cantidad pedida: {formatDecimal(drawerItem?.cantidad)} {drawerItem?.producto?.unidadMedida}
            </p>
          </DrawerHeader>

          {drawerForm && (
            <div className="flex-1 min-h-0 px-4 pb-6 space-y-4 overflow-y-auto">
              {/* ¿La mercancía llegó como se pidió? */}
              <div className="rounded-lg border p-3 space-y-3 bg-slate-50">
                <p className="text-sm font-medium text-slate-700">
                  ¿La mercancía llegó como se pidió?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={resetVariante}
                    className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                      !varianteOpen
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Sí, recepción normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setVarianteOpen(true)}
                    className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                      varianteOpen
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Llegó diferente
                  </button>
                </div>

                {varianteOpen && (
                  <div className="space-y-3 pt-1">
                    {/* Tipo de variante */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoVariante("formato")}
                        className={`py-1.5 px-2 rounded text-xs font-medium border ${
                          tipoVariante === "formato"
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        Formato distinto
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoVariante("sustituto")}
                        className={`py-1.5 px-2 rounded text-xs font-medium border ${
                          tipoVariante === "sustituto"
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        Otro producto (sustituto)
                      </button>
                    </div>

                    {/* Formato distinto */}
                    {tipoVariante === "formato" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormatoModo("factor")}
                            className={`py-1.5 px-2 rounded text-xs border ${
                              formatoModo === "factor"
                                ? "bg-white text-slate-800 border-blue-300 ring-1 ring-blue-200"
                                : "bg-white text-slate-500 border-slate-200"
                            }`}
                          >
                            Cantidad × factor
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormatoModo("piezas")}
                            className={`py-1.5 px-2 rounded text-xs border ${
                              formatoModo === "piezas"
                                ? "bg-white text-slate-800 border-blue-300 ring-1 ring-blue-200"
                                : "bg-white text-slate-500 border-slate-200"
                            }`}
                          >
                            Piezas (peso variable)
                          </button>
                        </div>

                        {formatoModo === "factor" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">
                                Factor ({drawerItem?.producto?.unidadMedida}/unidad)
                              </Label>
                              <Input
                                type="number"
                                step="any"
                                min="0.001"
                                placeholder="Ej: 2"
                                value={factorConv}
                                onChange={(e) => setFactorConv(e.target.value)}
                                className="mt-1 bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Guardar variante (opcional)</Label>
                              <Input
                                placeholder="Ej: Caja 2kg"
                                value={varianteNombre}
                                onChange={(e) => setVarianteNombre(e.target.value)}
                                className="mt-1 bg-white"
                              />
                            </div>
                          </div>
                        )}

                        {formatoModo === "piezas" && (
                          <div className="space-y-2">
                            <Label className="text-xs">Piezas recibidas (kg c/u)</Label>
                            <div className="rounded border bg-white divide-y">
                              {piezasRecep.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5">
                                  <span className="text-xs text-slate-400 w-12">#{i + 1}</span>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    placeholder="kg"
                                    value={p.pesoKg}
                                    onChange={(e) =>
                                      setPiezasRecep((prev) =>
                                        prev.map((x) =>
                                          x.id === p.id ? { ...x, pesoKg: e.target.value } : x
                                        )
                                      )
                                    }
                                    className="h-8 w-28"
                                  />
                                  {piezasRecep.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPiezasRecep((prev) => prev.filter((x) => x.id !== p.id))
                                      }
                                      className="ml-auto text-xs text-red-500 hover:underline"
                                    >
                                      Quitar
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPiezasRecep((prev) => [...prev, { id: Date.now(), pesoKg: "" }])
                              }
                              className="text-xs text-blue-600 hover:underline"
                            >
                              + Añadir pieza
                            </button>
                            <p className="text-xs text-slate-500">
                              Total:{" "}
                              {piezasRecep
                                .reduce((s, x) => s + (parseFloat(x.pesoKg) || 0), 0)
                                .toFixed(3)}{" "}
                              kg
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Producto sustituto */}
                    {tipoVariante === "sustituto" && (
                      <div>
                        <Label className="text-xs">Producto realmente recibido</Label>
                        <Select
                          value={sustitutoId?.toString() ?? ""}
                          onValueChange={(v) => setSustitutoId(parseInt(v, 10))}
                        >
                          <SelectTrigger className="mt-1 bg-white">
                            <SelectValue placeholder="Selecciona el producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {productos.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 mt-1">
                          El stock se sumará a este producto, no al pedido original.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cantidad recibida (oculta en modo piezas) */}
              {!(varianteOpen && tipoVariante === "formato" && formatoModo === "piezas") && (
                <div>
                  <Label htmlFor="cant-recibida">
                    Cantidad recibida *
                    {varianteOpen && tipoVariante === "formato" && formatoModo === "factor" && (
                      <span className="text-xs text-slate-400 ml-1">(nº de unidades del formato)</span>
                    )}
                  </Label>
                  <Input
                    id="cant-recibida"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={drawerForm.cantidadRecibida}
                    onChange={(e) =>
                      setDrawerForm((f) => f ? { ...f, cantidadRecibida: parseFloat(e.target.value) || 0 } : f)
                    }
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="precio-input">
                  Precio de llegada (€/unidad) — opcional
                </Label>
                <Input
                  id="precio-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder={`Actual: ${formatCurrency(drawerItem?.precioUnitario)}`}
                  value={drawerForm.nuevoPrecio}
                  onChange={(e) =>
                    setDrawerForm((f) => f ? { ...f, nuevoPrecio: e.target.value } : f)
                  }
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Vacío = mantiene el precio actual. Con valor = actualiza este lote y el precio del producto.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lote y caducidad</p>
                <ScanEtiqueta
                  disabled={savingItem}
                  onScan={(result) =>
                    setDrawerForm((f) =>
                      f
                        ? {
                            ...f,
                            lote: result.lote ?? f.lote,
                            fechaCaducidad: result.fechaCaducidad ?? f.fechaCaducidad,
                          }
                        : f
                    )
                  }
                />
                <div>
                  <Label htmlFor="lote-input">Lote</Label>
                  <Input
                    id="lote-input"
                    placeholder="LOT-XXXX"
                    value={drawerForm.lote}
                    onChange={(e) => setDrawerForm((f) => f ? { ...f, lote: e.target.value } : f)}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="cad-input">Fecha de caducidad</Label>
                  <Input
                    id="cad-input"
                    type="date"
                    value={drawerForm.fechaCaducidad}
                    onChange={(e) => setDrawerForm((f) => f ? { ...f, fechaCaducidad: e.target.value } : f)}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ubicacion-input">Localización</Label>
                <Input
                  id="ubicacion-input"
                  placeholder="Ej: Almacén A, Estante 3"
                  value={drawerForm.ubicacion}
                  onChange={(e) => setDrawerForm((f) => f ? { ...f, ubicacion: e.target.value } : f)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="codigo-input">Código Único</Label>
                <Input
                  id="codigo-input"
                  value={drawerForm.codigoUnico}
                  onChange={(e) => setDrawerForm((f) => f ? { ...f, codigoUnico: e.target.value } : f)}
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-base mt-2"
                onClick={guardarItemRecibido}
                disabled={
                  savingItem ||
                  (varianteOpen && tipoVariante === "formato" && formatoModo === "piezas"
                    ? piezasRecep.every((p) => !(parseFloat(p.pesoKg) > 0))
                    : !drawerForm.cantidadRecibida)
                }
              >
                {savingItem ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                {savingItem ? "Registrando..." : "Guardar en stock"}
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Confirmación de cerrar recepción con ítems pendientes */}
      <AlertDialog open={showCerrarConfirm} onOpenChange={setShowCerrarConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar recepción del pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedan <strong>{itemsPendientesCount} ítem{itemsPendientesCount !== 1 ? "s" : ""}</strong> sin recibir.
              Al cerrar, esos ítems serán descartados y el pedido quedará marcado como recibido parcialmente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { setShowCerrarConfirm(false); archivarPedido("recibido_parcial"); }}
            >
              Cerrar y descartar pendientes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

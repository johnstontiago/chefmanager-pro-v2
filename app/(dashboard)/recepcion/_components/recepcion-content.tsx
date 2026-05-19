"use client";

import { useState, useEffect } from "react";
import {
  Package, Truck, History, Loader2, AlertTriangle,
  CheckCircle, Calendar, ArrowRight, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDecimal, toNumber, generateUniqueCode } from "@/lib/utils";

interface RecepcionContentProps {
  userRole: string;
}

interface ItemForm {
  cantidadRecibida: number;
  lote: string;
  fechaCaducidad: string;
  ubicacion: string;
  codigoUnico: string;
}

type EstadoLinea = "pendiente" | "recibida" | "parcial";

interface ItemState extends ItemForm {
  estado: EstadoLinea;
}

export default function RecepcionContent({ userRole }: RecepcionContentProps) {
  const { toast } = useToast();
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [historialRecepciones, setHistorialRecepciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({});
  const [drawerItem, setDrawerItem] = useState<any>(null);
  const [drawerForm, setDrawerForm] = useState<ItemForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [showResumen, setShowResumen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pedRes, movRes] = await Promise.all([
        fetch("/api/pedidos"),
        fetch("/api/movimientos?tipo=entrada&limit=50"),
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
    } catch {
      // silencioso — toast solo en acciones del usuario
    } finally {
      setLoading(false);
    }
  };

  const iniciarRecepcion = (pedido: any) => {
    setSelectedPedido(pedido);
    const initial: Record<number, ItemState> = {};
    pedido.items?.forEach((item: any) => {
      initial[item.id] = {
        cantidadRecibida: toNumber(item.cantidad),
        lote: "",
        fechaCaducidad: "",
        ubicacion: "",
        codigoUnico: generateUniqueCode(),
        estado: "pendiente",
      };
    });
    setItemStates(initial);
  };

  const abrirDrawerItem = (item: any) => {
    const state = itemStates[item.id];
    setDrawerItem(item);
    setDrawerForm({
      cantidadRecibida: state?.cantidadRecibida ?? toNumber(item.cantidad),
      lote: state?.lote ?? "",
      fechaCaducidad: state?.fechaCaducidad ?? "",
      ubicacion: state?.ubicacion ?? "",
      codigoUnico: state?.codigoUnico ?? generateUniqueCode(),
    });
  };

  const guardarItemRecibido = () => {
    if (!drawerItem || !drawerForm) return;
    const cantPedida = toNumber(drawerItem.cantidad);
    const estadoLinea: EstadoLinea =
      drawerForm.cantidadRecibida >= cantPedida ? "recibida" : "parcial";
    setItemStates((prev) => ({
      ...prev,
      [drawerItem.id]: { ...drawerForm, estado: estadoLinea },
    }));
    setDrawerItem(null);
    setDrawerForm(null);
  };

  const todosProcessados = () => {
    if (!selectedPedido) return false;
    return selectedPedido.items?.every(
      (item: any) => itemStates[item.id]?.estado !== "pendiente"
    );
  };

  const descargarCSV = (pedido: any, states: Record<number, ItemState>) => {
    const filas = pedido.items?.map((item: any) => {
      const s = states[item.id];
      return [
        pedido.id,
        item.producto?.nombre ?? "",
        item.producto?.unidadMedida ?? "",
        formatDecimal(item.cantidad),
        s ? formatDecimal(s.cantidadRecibida) : "0",
        s?.lote ?? "",
        s?.fechaCaducidad ?? "",
        s?.ubicacion ?? "",
        s?.codigoUnico ?? "",
        s?.estado ?? "pendiente",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    }) ?? [];

    const cabecera = ["Pedido#","Producto","Unidad","Cant.Pedida","Cant.Recibida","Lote","Fecha Caducidad","Ubicación","Código Único","Estado"].join(",");
    const csv = [cabecera, ...filas].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recepcion-pedido-${pedido.id}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmarRecepcion = async (generarPedidoPendiente: boolean) => {
    if (!selectedPedido) return;
    const itemsRecibidos = selectedPedido.items?.filter(
      (item: any) => itemStates[item.id]?.estado !== "pendiente"
    );
    if (itemsRecibidos.length === 0) {
      toast({ title: "Marca al menos un producto como recibido", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      for (const item of itemsRecibidos) {
        const form = itemStates[item.id];

        await fetch("/api/inventario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productoId: item.productoId,
            cantidad: form.cantidadRecibida,
            lote: form.lote || null,
            fechaCaducidad: form.fechaCaducidad || null,
            ubicacion: form.ubicacion || null,
            codigoUnico: form.codigoUnico,
          }),
        });

        await fetch("/api/movimientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productoId: item.productoId,
            tipo: "entrada",
            cantidad: form.cantidadRecibida,
            lote: form.lote || null,
            notas: `Recepción pedido #${selectedPedido.id}`,
            pedidoItemId: item.id,
          }),
        });
      }

      const hayParciales = selectedPedido.items?.some(
        (item: any) => itemStates[item.id]?.estado === "parcial" || itemStates[item.id]?.estado === "pendiente"
      );
      const nuevoEstado = hayParciales ? "recibido_parcial" : "recibido";

      await fetch(`/api/pedidos/${selectedPedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (generarPedidoPendiente && hayParciales) {
        const itemsFaltantes = selectedPedido.items
          ?.filter((item: any) => {
            const s = itemStates[item.id];
            if (!s || s.estado === "pendiente") return true;
            if (s.estado === "parcial") return true;
            return false;
          })
          .map((item: any) => {
            const s = itemStates[item.id];
            const cantFaltante = s
              ? toNumber(item.cantidad) - s.cantidadRecibida
              : toNumber(item.cantidad);
            return {
              productoId: item.productoId,
              cantidad: cantFaltante > 0 ? cantFaltante : toNumber(item.cantidad),
              precioUnitario: toNumber(item.precioUnitario),
            };
          })
          .filter((i: any) => i.cantidad > 0);

        if (itemsFaltantes.length > 0) {
          await fetch("/api/pedidos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: itemsFaltantes,
              notas: `Pedido complementario del pedido #${selectedPedido.id}`,
              estado: "pendiente",
              proveedorId: selectedPedido.proveedorId ?? null,
              parentPedidoId: selectedPedido.id,
            }),
          });
        }
      }

      toast({
        title: "Recepción completada",
        description: `${itemsRecibidos.length} producto(s) registrado(s). Estado: ${nuevoEstado.replace("_", " ")}.`,
      });

      descargarCSV(selectedPedido, itemStates);
      setSelectedPedido(null);
      setItemStates({});
      setShowResumen(false);
      fetchData();
    } catch {
      toast({ title: "Error al procesar recepción", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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

  const itemsParcialesCount = selectedPedido?.items?.filter(
    (i: any) => itemStates[i.id]?.estado === "parcial"
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
                            <Badge className="bg-blue-100 text-blue-700">Enviado</Badge>
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
                {selectedPedido.items?.length} ítems •{" "}
                {selectedPedido.items?.length - itemsPendientesCount} procesados
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedPedido(null); setItemStates({}); }}>
              Cancelar
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            Pulsa <strong>Confirmar recepción</strong> en cada ítem para registrar lo que llegó.
          </div>

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
                        <p
                          className={`font-semibold truncate ${recibido ? "line-through opacity-60" : ""}`}
                        >
                          {item.producto?.nombre}
                        </p>
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
                              <><AlertTriangle className="w-3 h-3 mr-1" /> Parcial</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Recibido</>
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

          {/* Botón finalizar */}
          <div className="sticky bottom-4 pt-4">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
              disabled={saving || itemsPendientesCount === selectedPedido.items?.length}
              onClick={() => {
                if (itemsPendientesCount > 0 || itemsParcialesCount > 0) {
                  setShowResumen(true);
                } else {
                  confirmarRecepcion(false);
                }
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Finalizar recepción
            </Button>
          </div>
        </div>
      )}

      {/* Drawer de recepción por ítem */}
      <Drawer open={!!drawerItem} onOpenChange={(open) => { if (!open) { setDrawerItem(null); setDrawerForm(null); } }}>
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
              <>
                <div>
                  <Label htmlFor="cant-recibida">Cantidad recibida *</Label>
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

                <div>
                  <Label htmlFor="lote-input">Lote</Label>
                  <Input
                    id="lote-input"
                    placeholder="LOT-XXXX"
                    value={drawerForm.lote}
                    onChange={(e) => setDrawerForm((f) => f ? { ...f, lote: e.target.value } : f)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cad-input">Fecha de caducidad</Label>
                  <Input
                    id="cad-input"
                    type="date"
                    value={drawerForm.fechaCaducidad}
                    onChange={(e) => setDrawerForm((f) => f ? { ...f, fechaCaducidad: e.target.value } : f)}
                    className="mt-1"
                  />
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
                  disabled={!drawerForm.cantidadRecibida}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Guardar recepción
                </Button>
              </>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Dialog resumen / pedido pendiente */}
      <Dialog open={showResumen} onOpenChange={setShowResumen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resumen de recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              {selectedPedido?.items?.map((item: any) => {
                const s = itemStates[item.id];
                return (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="truncate flex-1">{item.producto?.nombre}</span>
                    <Badge
                      className={
                        !s || s.estado === "pendiente"
                          ? "bg-slate-200 text-slate-700"
                          : s.estado === "parcial"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }
                    >
                      {!s || s.estado === "pendiente"
                        ? "No recibido"
                        : s.estado === "parcial"
                        ? `Parcial (${formatDecimal(s.cantidadRecibida)}/${formatDecimal(item.cantidad)})`
                        : "Completo"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {(itemsPendientesCount > 0 || itemsParcialesCount > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Hay {itemsPendientesCount + itemsParcialesCount} ítem(s) con cantidades incompletas.
                ¿Deseas crear un nuevo pedido pendiente con lo que faltó?
              </div>
            )}

            <div className="flex flex-col gap-2">
              {(itemsPendientesCount > 0 || itemsParcialesCount > 0) && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => confirmarRecepcion(true)}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar y crear pedido pendiente
                </Button>
              )}
              <Button
                variant={itemsPendientesCount > 0 ? "outline" : "default"}
                className={itemsPendientesCount === 0 ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => confirmarRecepcion(false)}
                disabled={saving}
              >
                Confirmar sin pedido pendiente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

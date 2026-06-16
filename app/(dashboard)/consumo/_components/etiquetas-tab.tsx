"use client";

import { useState } from "react";
import {
  Printer,
  Bluetooth,
  BluetoothConnected,
  QrCode,
  Search,
  Tag,
  Calendar,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import QrScanner from "@/components/qr-scanner";

interface EtiquetasTabProps {
  inventario: any[];
}

type Modo = "item" | "blanco";

const MAX_COPIAS = 50;

export default function EtiquetasTab({ inventario }: EtiquetasTabProps) {
  const { toast } = useToast();
  const {
    status,
    deviceName,
    isSupported,
    connect,
    printLabel,
    disconnect,
  } = useBluetoothPrinter();

  const [modo, setModo] = useState<Modo>("item");
  const [codigo, setCodigo] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [copias, setCopias] = useState("1");
  const [printing, setPrinting] = useState(false);

  const buscarPorCodigo = (valor: string) => {
    const item = inventario.find(
      (inv) => inv.codigoUnico?.toLowerCase() === valor.toLowerCase().trim()
    );
    if (item) {
      setSelectedItem(item);
      setCodigo("");
      setShowScanner(false);
    } else {
      toast({ title: "Código no encontrado en inventario", variant: "destructive" });
    }
  };

  const buscarManual = () => {
    if (!codigo.trim()) return;
    buscarPorCodigo(codigo);
  };

  const imprimir = async () => {
    if (status !== "connected") {
      toast({ title: "Conecta la impresora primero", variant: "destructive" });
      return;
    }

    const copiasNum = Math.round(Number(copias));
    if (!Number.isFinite(copiasNum) || copiasNum < 1) {
      toast({ title: "Cantidad de copias inválida", variant: "destructive" });
      return;
    }
    if (copiasNum > MAX_COPIAS) {
      toast({ title: `Máximo ${MAX_COPIAS} copias por impresión`, variant: "destructive" });
      return;
    }

    if (modo === "item" && !selectedItem) {
      toast({ title: "Selecciona un ítem o cambia a etiqueta en blanco", variant: "destructive" });
      return;
    }

    try {
      setPrinting(true);
      await printLabel({
        nombre:      modo === "item" ? selectedItem.producto?.nombre ?? "" : "",
        fabricante:  "",
        lote:        modo === "item" ? selectedItem.lote ?? "" : "",
        cadEmbalaje: modo === "item" && selectedItem.fechaCaducidad
          ? formatDate(selectedItem.fechaCaducidad)
          : "",
        codigoUnico: modo === "item" ? selectedItem.codigoUnico ?? "" : "",
        cantidad:    copiasNum,
        variant:     "consumo",
      });
      toast({
        title: "Etiqueta enviada a la impresora",
        description: `${copiasNum} ${copiasNum === 1 ? "copia" : "copias"}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast({ title: "No se pudo imprimir", description: msg, variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  const conectado = status === "connected";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Impresora */}
      <Card className="lg:col-span-3">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              {conectado ? (
                <BluetoothConnected className="w-5 h-5 text-green-600" />
              ) : (
                <Bluetooth className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {conectado ? deviceName ?? "Impresora conectada" : "Impresora no conectada"}
                </p>
                <p className="text-xs text-slate-500">
                  {status === "connecting"
                    ? "Conectando..."
                    : status === "error"
                    ? "Error de conexión — reintenta"
                    : conectado
                    ? "Lista para imprimir"
                    : "Conecta la impresora térmica por Bluetooth"}
                </p>
              </div>
            </div>

            {!isSupported ? (
              <Badge variant="secondary" className="self-start">Bluetooth no soportado</Badge>
            ) : conectado ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                Desconectar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={connect}
                disabled={status === "connecting"}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {status === "connecting" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bluetooth className="w-4 h-4 mr-2" />
                )}
                Conectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Origen de la etiqueta */}
      <Card className="lg:col-span-2 order-2 lg:order-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-5 h-5 text-blue-600" />
            Contenido de la etiqueta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de modo */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={modo === "item" ? "default" : "outline"}
              className={modo === "item" ? "bg-blue-600 hover:bg-blue-700" : ""}
              onClick={() => setModo("item")}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Desde ítem
            </Button>
            <Button
              type="button"
              variant={modo === "blanco" ? "default" : "outline"}
              className={modo === "blanco" ? "bg-blue-600 hover:bg-blue-700" : ""}
              onClick={() => { setModo("blanco"); setShowScanner(false); }}
            >
              <FileText className="w-4 h-4 mr-2" />
              En blanco
            </Button>
          </div>

          {modo === "item" ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Código único o QR..."
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarManual()}
                  className="flex-1 min-w-0"
                />
                <Button
                  onClick={buscarManual}
                  variant="outline"
                  className="flex-shrink-0 min-w-[44px] px-2 sm:px-4"
                  aria-label="Buscar"
                >
                  <Search className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
                <Button
                  onClick={() => setShowScanner((v) => !v)}
                  variant={showScanner ? "default" : "outline"}
                  className={`flex-shrink-0 min-w-[44px] px-2 sm:px-4 ${showScanner ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  aria-label="Escanear código QR"
                >
                  <QrCode className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{showScanner ? "Cerrar" : "Escanear"}</span>
                </Button>
              </div>

              {showScanner && (
                <div className="w-full max-w-xs">
                  <QrScanner
                    onScan={(val) => buscarPorCodigo(val)}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              )}

              {selectedItem ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-800">{selectedItem.producto?.nombre}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Quitar selección"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {selectedItem.codigoUnico ?? "Sin código"}
                  </p>
                  {selectedItem.fechaCaducidad && (
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Cad. original: {formatDate(selectedItem.fechaCaducidad)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Escanea el QR de la etiqueta o busca el código único del inventario.
                  Se rellenarán solos el nombre, el código y la caducidad original.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Se imprimirá una etiqueta con todos los campos vacíos para rellenar a mano:
              nombre, código, caducidad, fecha de apertura, caducidad tras apertura y peso/porción.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Impresión */}
      <Card className="order-1 lg:order-2 lg:sticky lg:top-24 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="w-5 h-5 text-blue-600" />
            Imprimir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="copias">Cantidad de copias</Label>
            <Input
              id="copias"
              type="number"
              min={1}
              max={MAX_COPIAS}
              value={copias}
              onChange={(e) => setCopias(e.target.value)}
            />
            <p className="text-xs text-slate-500">Etiquetas idénticas a imprimir (máx. {MAX_COPIAS}).</p>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={imprimir}
            disabled={printing || !conectado || (modo === "item" && !selectedItem)}
          >
            {printing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Printer className="w-4 h-4 mr-2" />
            )}
            {printing ? "Imprimiendo..." : "Imprimir etiqueta"}
          </Button>

          {!conectado && (
            <p className="text-xs text-amber-600 text-center">
              Conecta la impresora para poder imprimir.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

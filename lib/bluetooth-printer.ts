// UUIDs estándar para impresoras térmicas BLE (VAVUPO P1 y similares).
// Si la impresora no conecta, descubre los UUIDs reales con la DevTools de Chrome:
// chrome://bluetooth-internals → inspecciona el dispositivo emparejado.
const SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID    = "00002af1-0000-1000-8000-00805f9b34fb";

export type PrinterStatus = "disconnected" | "connecting" | "connected" | "printing" | "error";

export interface LabelData {
  nombre:      string;
  lote:        string;
  cadEmbalaje: string;  // fecha caducidad del embalaje (Inventario.fechaCaducidad)
  codigoUnico: string;
  cantidad:    number;  // número de etiquetas a imprimir
}

export class CPCLPrinter {
  private device:         BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<string> {
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });

    const server  = await this.device.gatt!.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    this.characteristic = await service.getCharacteristic(CHAR_UUID);

    return this.device.name ?? "Impresora";
  }

  async printLabel(data: LabelData): Promise<void> {
    if (!this.characteristic) throw new Error("Impresora no conectada");

    const cpcl  = buildCPCL(data);
    const bytes = new TextEncoder().encode(cpcl);

    // BLE tiene MTU de ~20 bytes para writeValueWithoutResponse
    for (let i = 0; i < bytes.length; i += 20) {
      await this.characteristic.writeValueWithoutResponse(bytes.slice(i, i + 20));
    }
  }

  get isConnected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }
}

// Etiqueta 50×60mm a 200 DPI → 394×472 dots
// Diseño basado en la etiqueta de referencia del cliente.
function buildCPCL({ nombre, lote, cadEmbalaje, codigoUnico, cantidad }: LabelData): string {
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const copias  = Math.max(1, Math.round(cantidad));

  return [
    `! 0 200 200 472 ${copias}`,
    "ON-FEED IGNORE",
    `TEXT 4 0 5 15 Producto: ${nombre}`,
    `TEXT 4 0 5 50 Lote: ${loteStr}`,
    `TEXT 4 0 5 85 Cad. Emb.: ${cadStr}`,
    "TEXT 4 0 5 120 Fecha Apertura:",
    "TEXT 4 0 5 155 Consumir hasta.......... dias.",
    "TEXT 4 0 5 195 Fecha Cad.:",
    "TEXT 4 0 5 235 Mermas:",
    "BOX 115 227 250 263 2",
    "TEXT 4 0 5 280 Cod. Unico:",
    `TEXT 3 0 5 305 ${codigoUnico}`,
    `BARCODE QR 240 215 M 6 U 7`,
    `MA,${codigoUnico}`,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

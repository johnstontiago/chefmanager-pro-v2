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

// Etiqueta 43×53mm a 200 DPI → 338×417 dots
// 43mm × (200/25.4) ≈ 338 dots ancho
// 53mm × (200/25.4) ≈ 417 dots alto
function buildCPCL({ nombre, lote, cadEmbalaje, codigoUnico, cantidad }: LabelData): string {
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const copias  = Math.max(1, Math.round(cantidad));

  return [
    // 43mm × 53mm = 338 × 417 dots a 200 DPI
    `! 0 200 200 417 ${copias}`,
    "ON-FEED IGNORE",
    // ── Título con espacio generoso ──────────────────────────────────────
    "CENTER",
    "TEXT 4 0 0 10 CHEFMANAGER PRO",
    "LEFT",
    "LINE 15 40 323 40 2",   // separador a 30 dots bajo el título
    // ── Campos de datos — espaciado 38 dots por línea ────────────────────
    `TEXT 4 0 15 55 Producto: ${nombre}`,
    `TEXT 4 0 15 93 Lote: ${loteStr}`,
    `TEXT 4 0 15 131 Cad. Emb.: ${cadStr}`,
    "TEXT 4 0 15 169 Fecha Apertura:",
    "TEXT 4 0 15 207 Consumir en:",       // sustituye "Consumir hasta... dias."
    "TEXT 4 0 15 245 Fecha Cad.:",
    "TEXT 4 0 15 283 Mermas:",
    "BOX 125 275 198 310 2",              // cuadro Mermas (x=125..198)
    "TEXT 4 0 15 325 Cod. Unico:",
    `TEXT 3 0 15 350 ${codigoUnico}`,
    // ── QR más abajo, al lado de Mermas/Cod.Unico ────────────────────────
    // x=205: 205 + 111 dots (QR V3 M=3 con quiet zone) = 316 ✓ dentro de 338
    // y=270: QR queda junto a Mermas y Cod.Unico, termina en y=381 ✓
    "BARCODE QR 205 270 M 3 U 7",
    `MA,${codigoUnico}`,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

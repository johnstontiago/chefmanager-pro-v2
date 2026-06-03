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

export interface LabelConfig {
  titulo:    string;   // texto del título
  altoLabel: number;   // altura en dots (53mm = 417)
  xMargen:   number;   // margen izquierdo del texto
  espaciado: number;   // dots entre líneas de contenido
  fuente:    number;   // font CPCL 0-7
  xQR:       number;   // posición X del QR
  yQR:       number;   // posición Y del QR
  tamanoQR:  number;   // magnification M del QR (1-7)
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  titulo:    "CHEFMANAGER PRO",
  altoLabel: 417,
  xMargen:   15,
  espaciado: 38,
  fuente:    4,
  xQR:       205,
  yQR:       300,
  tamanoQR:  3,
};

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

  async printLabel(data: LabelData, config: LabelConfig = DEFAULT_LABEL_CONFIG): Promise<void> {
    if (!this.characteristic) throw new Error("Impresora no conectada");

    const cpcl  = buildCPCL(data, config);
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

// Etiqueta 43×53mm a 200 DPI → 338 dots ancho × 417 dots alto.
// Todos los parámetros vienen de LabelConfig para que el panel admin los controle.
function buildCPCL(
  { nombre, lote, cadEmbalaje, codigoUnico, cantidad }: LabelData,
  cfg: LabelConfig,
): string {
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const copias  = Math.max(1, Math.round(cantidad));
  const f = cfg.fuente;
  const x = cfg.xMargen;
  const s = cfg.espaciado;

  // Centrado manual del título (font 4 ≈ 11 dots/carácter en VAVUPO P1)
  const xTitulo = Math.max(0, Math.floor((338 - cfg.titulo.length * 11) / 2));

  // Posiciones Y de las líneas de contenido, calculadas desde y0=57
  const y0          = 57;
  const yProducto   = y0;
  const yLote       = y0 +   s;
  const yCad        = y0 + 2*s;
  const yApertura   = y0 + 3*s;
  const yConsumir   = y0 + 4*s;
  const yFechaCad   = y0 + 5*s;
  const yMermas     = y0 + 6*s;
  const yCodUnico   = yMermas + s;
  const yCodValor   = yCodUnico + 28;

  // Cuadro Mermas: a la derecha del texto, dentro del ancho de la etiqueta
  const boxX1 = x + 110;
  const boxY1 = yMermas - 8;
  const boxX2 = Math.min(boxX1 + 75, 200);
  const boxY2 = boxY1 + 36;

  return [
    `! 0 200 200 ${cfg.altoLabel} ${copias}`,
    "ON-FEED IGNORE",
    `TEXT ${f} 0 ${xTitulo} 12 ${cfg.titulo}`,
    "LINE 15 43 323 43 2",
    `TEXT ${f} 0 ${x} ${yProducto} Producto: ${nombre}`,
    `TEXT ${f} 0 ${x} ${yLote} Lote: ${loteStr}`,
    `TEXT ${f} 0 ${x} ${yCad} Cad. Emb.: ${cadStr}`,
    `TEXT ${f} 0 ${x} ${yApertura} Fecha Apertura:`,
    `TEXT ${f} 0 ${x} ${yConsumir} Consumir en:`,
    `TEXT ${f} 0 ${x} ${yFechaCad} Fecha Cad.:`,
    `TEXT ${f} 0 ${x} ${yMermas} Mermas:`,
    `BOX ${boxX1} ${boxY1} ${boxX2} ${boxY2} 2`,
    `TEXT ${f} 0 ${x} ${yCodUnico} Cod. Unico:`,
    `TEXT 3 0 ${x} ${yCodValor} ${codigoUnico}`,
    // QR: M = dots por módulo (1=pequeño … 7=grande). Sin U, el intérprete elige versión automática.
    `BARCODE QR ${cfg.xQR} ${cfg.yQR} M ${cfg.tamanoQR}`,
    `MA,${codigoUnico}`,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

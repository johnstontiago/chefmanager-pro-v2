// UUIDs estándar para impresoras térmicas BLE (VAVUPO P1 y similares).
// Si la impresora no conecta, descubre los UUIDs reales con la DevTools de Chrome:
// chrome://bluetooth-internals → inspecciona el dispositivo emparejado.
const SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID    = "00002af1-0000-1000-8000-00805f9b34fb";

export type PrinterStatus = "disconnected" | "connecting" | "connected" | "printing" | "error";

export interface LabelData {
  nombre:      string;
  fabricante:  string;  // marca del producto (sin label en la etiqueta)
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

// Dimensiones físicas de la etiqueta (50mm × 60mm a 200 DPI)
const LABEL_W = 394;   // 50mm ancho
const QR_DOTS = 135;   // U=7 → versión 7 (45 módulos × M 3 = 135 dots)

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  titulo:    "CHEFMANAGER PRO",
  altoLabel: 472,   // 60mm × 200 DPI / 25.4
  xMargen:   15,
  espaciado: 45,    // mayor espaciado para usar toda la etiqueta
  fuente:    4,
  xQR:       249,   // derecha: 394 − 135 − 10
  yQR:       327,   // abajo: 472 − 135 − 10
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
    console.log("[CPCL]", cpcl);
    const bytes = new TextEncoder().encode(cpcl);

    // Usar writeValueWithResponse si la característica lo soporta (ACK garantiza orden).
    // Si no, writeValueWithoutResponse + delay para que la impresora bufferice antes de procesar.
    const useAck = this.characteristic.properties.write;
    for (let i = 0; i < bytes.length; i += 20) {
      const chunk = bytes.slice(i, i + 20);
      if (useAck) {
        await this.characteristic.writeValueWithResponse(chunk);
      } else {
        await this.characteristic.writeValueWithoutResponse(chunk);
        await new Promise<void>((r) => setTimeout(r, 10));
      }
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

export function buildCPCL(
  { nombre, fabricante, lote, cadEmbalaje, codigoUnico, cantidad }: LabelData,
  cfg: LabelConfig,
): string {
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const copias  = Math.max(1, Math.round(cantidad));
  const f = cfg.fuente;
  const x = cfg.xMargen;
  const s = cfg.espaciado;

  // Centrado manual del título — ancho real 50mm = 394 dots (font 4 ≈ 11 dots/carácter)
  const xTitulo = Math.max(0, Math.floor((394 - cfg.titulo.length * 11) / 2));

  // Posiciones Y de las líneas de contenido, calculadas desde y0=57
  const y0          = 57;
  const yNombre     = y0;
  const yFabricante = y0 +   s;
  const yLote       = y0 + 2*s;
  const yCad        = y0 + 3*s;
  const yApertura   = y0 + 4*s;
  const yFechaCad   = y0 + 5*s;
  const yMermas     = y0 + 6*s;
  const yCodUnico   = yMermas + s;
  const yCodValor   = yCodUnico + 28;

  // Cuadro Mermas: a la derecha del texto (etiqueta 50mm = 394 dots, cabe sin cap)
  const boxX1 = x + 110;
  const boxY1 = yMermas - 8;
  const boxX2 = boxX1 + 75;
  const boxY2 = boxY1 + 36;

  // QR: esquina inferior derecha de la etiqueta (alineado a márgenes)
  const xQR = LABEL_W - QR_DOTS - 10;              // = 249 (394-135-10)
  const yQR = cfg.altoLabel - QR_DOTS - 10;        // = 327 para 472 dots

  return [
    `! 0 200 200 ${cfg.altoLabel} ${copias}`,
    "ON-FEED IGNORE",
    `TEXT ${f} 0 ${xTitulo} 12 ${cfg.titulo}`,
    "LINE 15 43 374 43 2",
    `TEXT ${f} 0 ${x} ${yNombre} ${nombre}`,
    ...(fabricante ? [`TEXT ${f} 0 ${x} ${yFabricante} ${fabricante}`] : []),
    `TEXT ${f} 0 ${x} ${yLote} Lote: ${loteStr}`,
    `TEXT ${f} 0 ${x} ${yCad} Cad. Emb.: ${cadStr}`,
    `TEXT ${f} 0 ${x} ${yApertura} Fecha Apertura:`,
    `TEXT ${f} 0 ${x} ${yFechaCad} Fecha Cad.:`,
    `TEXT ${f} 0 ${x} ${yMermas} Mermas:`,
    `BOX ${boxX1} ${boxY1} ${boxX2} ${boxY2} 2`,
    `TEXT ${f} 0 ${x} ${yCodUnico} Cod. Unico:`,
    `TEXT 3 0 ${x} ${yCodValor} ${codigoUnico}`,
    // U 7 = versión 7 (45 módulos × M 3 = 135 dots). Único valor confirmado en VAVUPO P1.
    `BARCODE QR ${xQR} ${yQR} M 3 U 7`,
    codigoUnico,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

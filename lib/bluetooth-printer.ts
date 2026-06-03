const SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID    = "00002af1-0000-1000-8000-00805f9b34fb";

export type PrinterStatus = "disconnected" | "connecting" | "connected" | "printing" | "error";

export interface LabelData {
  nombre:      string;
  fabricante:  string;
  lote:        string;
  cadEmbalaje: string;
  codigoUnico: string;
  cantidad:    number;
}

export interface LabelConfig {
  titulo:    string;
  altoLabel: number;
  xMargen:   number;
  espaciado: number;
  fuente:    number;
  xQR:       number;
  yQR:       number;
  tamanoQR:  number;
}

const LABEL_W = 394;

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  titulo:    "CHEFMANAGER PRO",
  altoLabel: 472,
  xMargen:   15,
  espaciado: 45,
  fuente:    4,
  xQR:       249,
  yQR:       327,
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

    // QR generado como comandos LINE de CPCL — no depende del firmware de la impresora
    const cpcl   = await buildCPCLFull(data, config);
    const bytes  = new TextEncoder().encode(cpcl);
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

// Comandos CPCL de texto/líneas/cajas (sin QR ni PRINT)
function buildLabelCommands(
  { nombre, fabricante, lote, cadEmbalaje, codigoUnico, cantidad }: LabelData,
  cfg: LabelConfig,
): string[] {
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const copias  = Math.max(1, Math.round(cantidad));
  const f = cfg.fuente;
  const x = cfg.xMargen;
  const s = cfg.espaciado;
  const xTitulo   = Math.max(0, Math.floor((394 - cfg.titulo.length * 11) / 2));
  const y0        = 57;
  const yFab      = y0 +   s;
  const yLote     = y0 + 2*s;
  const yCad      = y0 + 3*s;
  const yApertura = y0 + 4*s;
  const yFechaCad = y0 + 5*s;
  const yMermas   = y0 + 6*s;
  const yCodUnico = yMermas + s;
  const yCodValor = yCodUnico + 28;
  const boxX1 = x + 110;
  const boxY1 = yMermas - 8;
  const boxX2 = boxX1 + 75;
  const boxY2 = boxY1 + 36;

  return [
    `! 0 200 200 ${cfg.altoLabel} ${copias}`,
    "ON-FEED IGNORE",
    `TEXT ${f} 0 ${xTitulo} 12 ${cfg.titulo}`,
    "LINE 15 43 374 43 2",
    `TEXT ${f} 0 ${x} ${y0} ${nombre}`,
    ...(fabricante ? [`TEXT ${f} 0 ${x} ${yFab} ${fabricante}`] : []),
    `TEXT ${f} 0 ${x} ${yLote} Lote: ${loteStr}`,
    `TEXT ${f} 0 ${x} ${yCad} Cad. Emb.: ${cadStr}`,
    `TEXT ${f} 0 ${x} ${yApertura} Fecha Apertura:`,
    `TEXT ${f} 0 ${x} ${yFechaCad} Fecha Cad.:`,
    `TEXT ${f} 0 ${x} ${yMermas} Mermas:`,
    `BOX ${boxX1} ${boxY1} ${boxX2} ${boxY2} 2`,
    `TEXT ${f} 0 ${x} ${yCodUnico} Cod. Unico:`,
    `TEXT 3 0 ${x} ${yCodValor} ${codigoUnico}`,
  ];
}

// QR como comandos LINE de CPCL usando la matriz de módulos de qrcode.
// Cada fila de módulos oscuros contiguos → 1 comando LINE (RLE horizontal).
async function buildQRLines(
  text: string,
  M: number,      // dots por módulo (3 = cada módulo ocupa 3×3 dots)
  labelW: number,
  labelH: number,
): Promise<string[]> {
  const { default: QRCode } = await import("qrcode");
  // create() devuelve la matriz de módulos sin necesitar canvas ni DOM
  const qr   = (QRCode as unknown as { create: (t: string, o: object) => unknown })
                 .create(text, { errorCorrectionLevel: "L" });
  const nMod = (qr as { modules: { size: number; data: Uint8ClampedArray } }).modules.size;
  const bits = (qr as { modules: { size: number; data: Uint8ClampedArray } }).modules.data;

  // QR posicionado en la esquina inferior derecha con margen de 10 dots
  const x0 = labelW - nMod * M - 10;
  const y0 = labelH - nMod * M - 10;

  const cmds: string[] = [];
  for (let row = 0; row < nMod; row++) {
    let start = -1;
    for (let col = 0; col <= nMod; col++) {
      const dark = col < nMod && bits[row * nMod + col] === 1;
      if (dark && start === -1) {
        start = col;
      } else if (!dark && start !== -1) {
        const x1 = x0 + start * M;
        const x2 = x0 + col * M - 1;
        const y  = y0 + row * M + (M >> 1); // centro vertical del módulo
        cmds.push(`LINE ${x1} ${y} ${x2} ${y} ${M}`);
        start = -1;
      }
    }
  }
  return cmds;
}

// CPCL completo para impresión (texto + QR como LINE commands)
async function buildCPCLFull(data: LabelData, cfg: LabelConfig): Promise<string> {
  const cmds   = buildLabelCommands(data, cfg);
  const qrCmds = await buildQRLines(data.codigoUnico, 3, LABEL_W, cfg.altoLabel);
  return [...cmds, ...qrCmds, "PRINT", ""].join("\r\n");
}

// Preview de texto para el panel debug (BARCODE QR como referencia visual)
export function buildCPCL(data: LabelData, cfg: LabelConfig): string {
  const cmds = buildLabelCommands(data, cfg);
  const M    = 3;
  const nModApprox = 21; // versión 1 QR (típica para códigos cortos)
  const sz   = nModApprox * M;
  const xQR  = LABEL_W - sz - 10;
  const yQR  = cfg.altoLabel - sz - 10;
  return [
    ...cmds,
    `BARCODE QR ${xQR} ${yQR} M ${M} U 7`,
    data.codigoUnico,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

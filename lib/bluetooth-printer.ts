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
const QR_DOTS = 135;

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

    // QR generado en canvas del navegador → bitmap 1-bit → comando EG de CPCL.
    // Evita depender del comando BARCODE QR del firmware de la impresora.
    const bytes  = await buildCPCLBytes(data, config);
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

// Comandos CPCL comunes a ambos modos (sin QR, sin PRINT)
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

// Preview de texto para el panel debug (muestra BARCODE QR como referencia)
export function buildCPCL(data: LabelData, cfg: LabelConfig): string {
  const cmds = buildLabelCommands(data, cfg);
  const xQR  = LABEL_W - QR_DOTS - 10;
  const yQR  = cfg.altoLabel - QR_DOTS - 10;
  return [
    ...cmds,
    `BARCODE QR ${xQR} ${yQR} M 3 U 7`,
    data.codigoUnico,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

// Convierte el QR en un bitmap de 1 bit por píxel usando canvas del navegador.
// Devuelve ceil(QR_DOTS/8) × QR_DOTS bytes, MSB = píxel izquierdo, 1 = negro.
async function qrBitmap(text: string): Promise<Uint8Array> {
  const { default: QRCode } = await import("qrcode");
  const canvas  = document.createElement("canvas");
  canvas.width  = QR_DOTS;
  canvas.height = QR_DOTS;
  await QRCode.toCanvas(canvas, text, { width: QR_DOTS, margin: 0 });
  const ctx  = canvas.getContext("2d")!;
  const px   = ctx.getImageData(0, 0, QR_DOTS, QR_DOTS).data;
  const wB   = Math.ceil(QR_DOTS / 8);          // 17 bytes por fila
  const bits = new Uint8Array(wB * QR_DOTS);
  for (let r = 0; r < QR_DOTS; r++) {
    for (let c = 0; c < QR_DOTS; c++) {
      if (px[(r * QR_DOTS + c) * 4] < 128) {   // canal R < 128 → píxel negro
        bits[r * wB + (c >> 3)] |= 0x80 >> (c & 7);
      }
    }
  }
  return bits;
}

// Payload real de impresión: comandos CPCL de texto + QR como bitmap EG.
// EG = comando gráfico CPCL que inserta un bitmap raw en la etiqueta.
async function buildCPCLBytes(data: LabelData, cfg: LabelConfig): Promise<Uint8Array> {
  const cmds   = buildLabelCommands(data, cfg);
  const bitmap = await qrBitmap(data.codigoUnico);
  const xQR    = LABEL_W - QR_DOTS - 10;
  const yQR    = cfg.altoLabel - QR_DOTS - 10;
  const wB     = Math.ceil(QR_DOTS / 8);
  const enc    = new TextEncoder();

  // Comandos de texto + encabezado EG (el bitmap va inline sin separador)
  const textPart   = [...cmds, `EG ${wB} ${QR_DOTS} ${xQR} ${yQR}`].join("\r\n") + "\r\n";
  const printPart  = "PRINT\r\n\r\n";
  const textBytes  = enc.encode(textPart);
  const printBytes = enc.encode(printPart);

  // Layout del payload: [texto CPCL][bitmap raw][PRINT]
  const result = new Uint8Array(textBytes.length + bitmap.length + printBytes.length);
  result.set(textBytes,  0);
  result.set(bitmap,     textBytes.length);
  result.set(printBytes, textBytes.length + bitmap.length);
  return result;
}

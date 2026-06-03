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

    const cpcl  = buildCPCLForPrint(data, config);
    const bytes = new TextEncoder().encode(cpcl);

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

// Para impresión real: prefijo MA, tal como lo requiere el firmware de la VAVUPO P1
function buildCPCLForPrint(data: LabelData, cfg: LabelConfig): string {
  const cmds = buildLabelCommands(data, cfg);
  return [
    ...cmds,
    `BARCODE QR ${cfg.xQR} ${cfg.yQR} M ${cfg.tamanoQR} U 7`,
    `MA,${data.codigoUnico}`,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

// Para el panel debug (preview de texto)
export function buildCPCL(data: LabelData, cfg: LabelConfig): string {
  const cmds = buildLabelCommands(data, cfg);
  return [
    ...cmds,
    `BARCODE QR ${cfg.xQR} ${cfg.yQR} M ${cfg.tamanoQR} U 7`,
    `MA,${data.codigoUnico}`,
    "ENDQR",
    "PRINT",
    "",
  ].join("\r\n");
}

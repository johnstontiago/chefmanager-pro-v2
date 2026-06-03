import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { create as qrCreate } from "qrcode";
import type { LabelData, LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

const LABEL_W = 394;

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

function buildQRLines(text: string, M: number, labelH: number): string[] {
  const qr   = qrCreate(text, { errorCorrectionLevel: "L" });
  const nMod = qr.modules.size;
  const bits = qr.modules.data;

  const x0 = LABEL_W - nMod * M - 10;
  const y0 = labelH  - nMod * M - 10;

  const cmds: string[] = [];
  for (let row = 0; row < nMod; row++) {
    let start = -1;
    for (let col = 0; col <= nMod; col++) {
      const dark = col < nMod && bits[row * nMod + col] !== 0;
      if (dark && start === -1) {
        start = col;
      } else if (!dark && start !== -1) {
        const x1 = x0 + start * M;
        const x2 = x0 + col   * M - 1;
        const y  = y0 + row   * M + (M >> 1);
        cmds.push(`LINE ${x1} ${y} ${x2} ${y} ${M}`);
        start = -1;
      }
    }
  }
  return cmds;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body              = await req.json();
  const data: LabelData   = body.data;
  const config: LabelConfig = body.config ?? DEFAULT_LABEL_CONFIG;

  const cmds   = buildLabelCommands(data, config);
  const qrCmds = buildQRLines(data.codigoUnico, 3, config.altoLabel);
  const cpcl   = [...cmds, ...qrCmds, "PRINT", ""].join("\r\n");

  return NextResponse.json({ cpcl });
}

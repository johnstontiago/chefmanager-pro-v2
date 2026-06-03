import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { create as qrCreate } from "qrcode";
import { deflateSync } from "zlib";
import type { LabelData, LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

const QR_M = 3; // dots por módulo QR

// Genera el bitmap 1-bit del QR (sin librerías externas)
function buildQrBitmap(text: string): { buf: Buffer; w: number; h: number } {
  const qr     = qrCreate(text, { errorCorrectionLevel: "L" });
  const nMod   = qr.modules.size;
  const qrPx   = nMod * QR_M;
  const rowBytes = Math.ceil(qrPx / 8);
  const buf    = Buffer.alloc(rowBytes * qrPx, 0);

  for (let r = 0; r < nMod; r++) {
    for (let c = 0; c < nMod; c++) {
      if (!qr.modules.data[r * nMod + c]) continue;
      for (let dy = 0; dy < QR_M; dy++) {
        for (let dx = 0; dx < QR_M; dx++) {
          const bx = c * QR_M + dx;
          const by = r * QR_M + dy;
          buf[by * rowBytes + (bx >> 3)] |= 0x80 >> (bx & 7);
        }
      }
    }
  }

  return { buf, w: qrPx, h: qrPx };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const data: LabelData   = body.data;
  const cfg:  LabelConfig = body.config ?? DEFAULT_LABEL_CONFIG;
  const copies = Math.max(1, Math.round(data.cantidad));

  const { nombre, fabricante, lote, cadEmbalaje, codigoUnico } = data;
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";

  // TSC/TSPL usa parámetros con coma: TEXT x,y,"font",rotation,xmul,ymul,"text"
  const f  = String(cfg.fuente);
  const xm = cfg.xMargen;
  const s  = cfg.espaciado;

  const xTitulo   = Math.max(0, Math.floor((394 - cfg.titulo.length * 11) / 2));
  const y0        = 57;
  const yFab      = y0 + s;
  const yLote     = y0 + 2 * s;
  const yCad      = y0 + 3 * s;
  const yApertura = y0 + 4 * s;
  const yFechaCad = y0 + 5 * s;
  const yMermas   = y0 + 6 * s;
  const yCodUnico = yMermas + s;
  const yCodValor = yCodUnico + 28;
  const boxX1 = xm + 110;
  const boxY1 = yMermas - 8;
  const boxX2 = boxX1 + 75;
  const boxY2 = boxY1 + 36;

  const t = (x: number, y: number, fnt: string, txt: string) =>
    `TEXT ${x},${y},"${fnt}",0,1,1,"${txt}"`;

  // Texto e instrucciones gráficas como texto plano (sin binario)
  const textLines = [
    `SIZE 50 mm,60 mm`,
    `SPEED 4`,
    `DENSITY 8`,
    `CLS`,
    `DIRECTION 0`,
    t(xTitulo, 12, f, cfg.titulo),
    `LINE 15,43,374,43,2`,
    t(xm, y0, f, nombre),
    ...(fabricante ? [t(xm, yFab, f, fabricante)] : []),
    t(xm, yLote, f, `Lote: ${loteStr}`),
    t(xm, yCad, f, `Cad. Emb.: ${cadStr}`),
    t(xm, yApertura, f, "Fecha Apertura:"),
    t(xm, yFechaCad, f, "Fecha Cad.:"),
    t(xm, yMermas, f, "Mermas:"),
    `BOX ${boxX1},${boxY1},${boxX2},${boxY2},2`,
    t(xm, yCodUnico, f, "Cod. Unico:"),
    t(xm, yCodValor, "3", codigoUnico),
  ];
  const textPart = textLines.join("\r\n") + "\r\n";

  // QR como bitmap 1-bit comprimido con zlib (modo 3)
  const { buf: qrBuf, w: qrW, h: qrH } = buildQrBitmap(codigoUnico);
  const qrRowBytes = Math.ceil(qrW / 8);
  const qrX = 394 - qrW - 10;
  const qrY = 472 - qrH - 10;
  const comp = deflateSync(qrBuf);

  // Comando BITMAP con datos binarios embebidos + terminador PRINT
  const tspl = Buffer.concat([
    Buffer.from(textPart),
    Buffer.from(`BITMAP ${qrX},${qrY},${qrRowBytes},${qrH},3,${comp.length},`),
    comp,
    Buffer.from(`\r\nPRINT 1,${copies}\r\n`),
  ]);

  return NextResponse.json({ tspl: tspl.toString("base64") });
}

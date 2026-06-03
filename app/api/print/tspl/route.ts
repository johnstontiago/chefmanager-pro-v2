import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { LabelData, LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

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

  // cell_width: 2 = muy pequeño, 3 = pequeño, 4 = normal — se mapea desde tamanoQR (1-5)
  const qrCell = Math.max(2, Math.min(4, cfg.tamanoQR));

  const lines = [
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
    t(xm, yCad,  f, `Cad. Emb.: ${cadStr}`),
    t(xm, yApertura, f, "Fecha Apertura:"),
    t(xm, yFechaCad, f, "Fecha Cad.:"),
    t(xm, yMermas,   f, "Mermas:"),
    `BOX ${boxX1},${boxY1},${boxX2},${boxY2},2`,
    t(xm, yCodUnico, f, "Cod. Unico:"),
    t(xm, yCodValor, "3", codigoUnico),
    `QRCODE ${cfg.xQR},${cfg.yQR},L,${qrCell},A,0,"${codigoUnico}"`,
    `PRINT 1,${copies}`,
    ``,
  ];

  const tspl = lines.join("\r\n");
  return NextResponse.json({ tspl: Buffer.from(tspl).toString("base64") });
}

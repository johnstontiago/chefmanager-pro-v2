import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { create as qrCreate } from "qrcode";
import { authOptions } from "@/lib/auth-options";
import type { LabelData, LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

// La VAVUPO P1 no soporta el comando TSPL nativo "QRCODE" (aborta el trabajo).
// Dibujamos el QR como bitmap con comandos BAR (rectángulos negros), que sí
// soporta. Cada fila se agrupa en tramos de módulos oscuros contiguos.
function buildQRBars(text: string, x0: number, y0: number, cell: number): string[] {
  const qr = qrCreate(text, { errorCorrectionLevel: "L" });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const bars: string[] = [];

  for (let row = 0; row < n; row++) {
    let start = -1;
    for (let col = 0; col <= n; col++) {
      const dark = col < n && bits[row * n + col] !== 0;
      if (dark && start === -1) {
        start = col;
      } else if (!dark && start !== -1) {
        const x = x0 + start * cell;
        const y = y0 + row * cell;
        const w = (col - start) * cell;
        bars.push(`BAR ${x},${y},${w},${cell}`);
        start = -1;
      }
    }
  }
  return bars;
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

  // Variante de etiqueta: consumo muestra "Porcion:" en lugar de "Mermas:".
  const variant       = data.variant ?? "recepcion";
  const esConsumo     = variant === "consumo";
  const etiquetaSexta = esConsumo ? "Porcion:" : "Mermas:";
  // Etiqueta "en blanco": sin código no se imprime QR ni la línea del código.
  const tieneCodigo   = Boolean(codigoUnico && codigoUnico.trim());

  const f  = String(cfg.fuente);
  // En consumo se separa el texto del borde izquierdo (la margen base queda muy justa).
  const xm = cfg.xMargen + (esConsumo ? 15 : 0);
  const s  = cfg.espaciado;

  const xTitulo   = Math.max(0, Math.floor((394 - cfg.titulo.length * 11) / 2));
  // En consumo se baja el encabezado (título, línea separadora y nombre)
  // para dar más aire arriba.
  const yTit      = esConsumo ? 30 : 12;
  const yRule     = esConsumo ? 58 : 43;
  const y0        = esConsumo ? 72 : 57;
  const yFab      = y0 + s;
  // En consumo no hay fabricante: los campos arrancan justo bajo el nombre
  // (+s), eliminando la línea vacía. En recepción se mantiene el hueco (+2s).
  const yLote     = y0 + (esConsumo ? s : 2 * s);
  const yCad      = yLote + s;
  const yApertura = yCad + s;
  // Línea en blanco debajo de "Fecha Apertura" y debajo de "Fecha Cad."
  // (hueco para escribir a mano en la etiqueta física).
  const yFechaCad = yApertura + 2 * s;
  const yMermas   = yFechaCad + 2 * s;
  const yCodUnico = yMermas + s;
  const yCodValor = yCodUnico + 28;
  const boxX1 = xm + 110;
  const boxY1 = yMermas - 8;
  const boxX2 = boxX1 + 75;
  const boxY2 = boxY1 + 36;

  const t = (x: number, y: number, fnt: string, txt: string) =>
    `TEXT ${x},${y},"${fnt}",0,1,1,"${txt}"`;

  // cell_width: dots por módulo QR (5 = ~105 dots para versión 1, legible con cámara)
  const qrCell = Math.max(5, Math.min(8, cfg.tamanoQR));

  const lines = [
    `SIZE 50 mm,70 mm`,
    `GAP 2 mm,0`,
    `SPEED 4`,
    `DENSITY 8`,
    `CLS`,
    `DIRECTION 0`,
    t(xTitulo, yTit, f, cfg.titulo),
    `LINE 15,${yRule},374,${yRule},2`,
    t(xm, y0, f, nombre),
    ...(fabricante ? [t(xm, yFab, f, fabricante)] : []),
    t(xm, yLote, f, `Lote: ${loteStr}`),
    t(xm, yCad,  f, `Cad. Emb.: ${cadStr}`),
    t(xm, yApertura, f, "Fecha Apertura:"),
    t(xm, yFechaCad, f, "Fecha Cad.:"),
    t(xm, yMermas,   f, etiquetaSexta),
    // El recuadro de Mermas no aplica en la etiqueta de consumo.
    ...(esConsumo ? [] : [`BOX ${boxX1},${boxY1},${boxX2},${boxY2},2`]),
    t(xm, yCodUnico, f, "Cod. Unico:"),
    ...(tieneCodigo
      ? [
          t(xm, yCodValor, "3", codigoUnico),
          ...buildQRBars(codigoUnico, cfg.xQR, cfg.yQR, qrCell),
        ]
      : []),
    `PRINT 1,${copies}`,
    ``,
  ];

  const tspl = lines.join("\r\n");
  return NextResponse.json({ tspl: Buffer.from(tspl).toString("base64") });
}

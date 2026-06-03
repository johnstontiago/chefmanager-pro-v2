import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { create as qrCreate } from "qrcode";
import sharp from "sharp";
import { deflateSync } from "zlib";
import type { LabelData, LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

// 50 mm × 60 mm a 200 dpi (8 dots/mm)
const W = 400;
const H = 480;
const QR_M = 3; // dots por módulo QR

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(data: LabelData, cfg: LabelConfig): string {
  const { nombre, fabricante, lote, cadEmbalaje, codigoUnico } = data;
  const loteStr = lote        || "---";
  const cadStr  = cadEmbalaje || "---";
  const s  = cfg.espaciado;
  const xm = cfg.xMargen;

  // Mismo cálculo de layout que el CPCL original
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

  // En SVG, y es la línea base del texto. Usamos y + fs*0.8 para alinear con la top-coordinate del CPCL.
  const t = (x: number, y: number, txt: string, fs = 20, bold = false) =>
    `<text x="${x}" y="${Math.round(y + fs * 0.82)}" font-size="${fs}" font-family="sans-serif"${bold ? ' font-weight="bold"' : ""}>${esc(txt)}</text>`;

  const lines = [
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${W}" height="${H}" fill="white"/>`,
    t(xTitulo, 2, cfg.titulo, 22, true),
    `<line x1="15" y1="43" x2="374" y2="43" stroke="black" stroke-width="2"/>`,
    t(xm, y0, nombre),
    fabricante ? t(xm, yFab, fabricante) : "",
    t(xm, yLote, `Lote: ${loteStr}`),
    t(xm, yCad, `Cad. Emb.: ${cadStr}`),
    t(xm, yApertura, "Fecha Apertura:"),
    t(xm, yFechaCad, "Fecha Cad.:"),
    t(xm, yMermas, "Mermas:"),
    `<rect x="${boxX1}" y="${boxY1}" width="${boxX2 - boxX1}" height="${boxY2 - boxY1}" fill="none" stroke="black" stroke-width="2"/>`,
    t(xm, yCodUnico, "Cod. Unico:"),
    t(xm, yCodValor, codigoUnico, 18, true),
    `</svg>`,
  ];

  return lines.filter(Boolean).join("\n");
}

async function buildBitmap(data: LabelData, cfg: LabelConfig): Promise<Buffer> {
  // Renderiza el SVG de etiqueta (sin QR) a píxeles en escala de grises
  const svgBuf = Buffer.from(buildSvg(data, cfg));
  const { data: gray, info } = await sharp(svgBuf)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const iw = info.width;
  const ih = info.height;
  const rowBytes = Math.ceil(iw / 8);
  const bits = Buffer.alloc(rowBytes * ih, 0);

  // Umbral 128: pixel oscuro → bit 1
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      if (gray[y * iw + x] < 128) {
        bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  // Dibuja el QR directamente en el bitmap 1-bit (esquina inferior-derecha)
  const qr   = qrCreate(data.codigoUnico, { errorCorrectionLevel: "L" });
  const nMod = qr.modules.size;
  const qrPx = nMod * QR_M;
  const qrX0 = 394 - qrPx - 10;
  const qrY0 = 472 - qrPx - 10;

  for (let r = 0; r < nMod; r++) {
    for (let c = 0; c < nMod; c++) {
      if (!qr.modules.data[r * nMod + c]) continue;
      for (let dy = 0; dy < QR_M; dy++) {
        for (let dx = 0; dx < QR_M; dx++) {
          const bx = qrX0 + c * QR_M + dx;
          const by = qrY0 + r * QR_M + dy;
          if (bx >= 0 && bx < iw && by >= 0 && by < ih) {
            bits[by * rowBytes + (bx >> 3)] |= 0x80 >> (bx & 7);
          }
        }
      }
    }
  }

  return bits;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body  = await req.json();
  const data: LabelData   = body.data;
  const cfg:  LabelConfig = body.config ?? DEFAULT_LABEL_CONFIG;
  const copies = Math.max(1, Math.round(data.cantidad));

  const bitmap   = await buildBitmap(data, cfg);
  const rowBytes = Math.ceil(W / 8); // 50 bytes/fila
  const comp     = deflateSync(bitmap);

  // Comando TSC/TSPL: SIZE → SPEED → DENSITY → CLS → DIRECTION → BITMAP (zlib) → PRINT
  const header = Buffer.from(
    `SIZE 50 mm,60 mm\r\nSPEED 4\r\nDENSITY 8\r\nCLS\r\nDIRECTION 0\r\nBITMAP 0,0,${rowBytes},${H},3,${comp.length},`
  );
  const footer = Buffer.from(`\r\nPRINT 1,${copies}\r\n`);
  const tspl   = Buffer.concat([header, comp, footer]);

  return NextResponse.json({ tspl: tspl.toString("base64") });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber, formatCurrency, formatDate, formatDecimal, getDaysUntilExpiry } from "@/lib/utils";
import { htmlToPdf } from "@/lib/pdf-generator";

import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

/** Protege contra CSV injection: valores que Excel/Sheets interpretan como fórmulas */
function sanitizeCSVValue(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  // Escapa comillas dobles y envuelve si tiene comas o saltos
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCSV(headers: string[], rows: string[][]): string {
  const sanitize = (v: string) => sanitizeCSVValue(String(v ?? ""));
  return [
    headers.map(sanitize).join(","),
    ...rows.map((row) => row.map(sanitize).join(",")),
  ].join("\n");
}

async function generatePDF(htmlContent: string): Promise<Buffer | null> {
  try {
    return await htmlToPdf(htmlContent, {
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
    });
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: { tipo: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    const unidadId = getActiveUnidadId(user);
    const tenantId = getActiveTenantId(user);
    if (!unidadId) return NextResponse.json({ error: "Sin unidad" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const tipo = params.tipo;

    let content: string = "";
    let filename = `reporte_${tipo}_${new Date().toISOString().split("T")[0]}`;

    if (tipo === "inventario") {
      const inventario = await prisma.inventario.findMany({
        where: { unidadId, tenantId, estado: "disponible" },
        include: { producto: { include: { categoria: true, proveedor: true } } },
        orderBy: { producto: { nombre: "asc" } },
      });

      if (format === "csv") {
        const headers = ["Producto", "Categor\u00eda", "Proveedor", "Cantidad", "Unidad", "Lote", "Caducidad", "Ubicaci\u00f3n", "C\u00f3digo"];
        const rows = inventario.map((inv: any) => [
          inv.producto?.nombre || "",
          inv.producto?.categoria?.nombre || "",
          inv.producto?.proveedor?.nombre || "",
          formatDecimal(inv.cantidad),
          inv.producto?.unidadMedida || "",
          inv.lote || "",
          inv.fechaCaducidad ? formatDate(inv.fechaCaducidad) : "",
          inv.ubicacion || "",
          inv.codigoUnico || "",
        ]);
        content = generateCSV(headers, rows);
      } else {
        const rows = inventario.map((inv: any) => `
          <tr>
            <td>${inv.producto?.nombre}</td>
            <td>${inv.producto?.categoria?.nombre || "-"}</td>
            <td style="text-align:center;">${formatDecimal(inv.cantidad)} ${inv.producto?.unidadMedida}</td>
            <td>${inv.lote || "-"}</td>
            <td>${inv.fechaCaducidad ? formatDate(inv.fechaCaducidad) : "-"}</td>
            <td>${inv.ubicacion || "-"}</td>
          </tr>
        `).join("");

        content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1e40af; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style></head><body>
          <h1>Reporte de Inventario</h1>
          <p>Fecha: ${new Date().toLocaleDateString("es-ES")} | Total items: ${inventario.length}</p>
          <table>
            <thead><tr><th>Producto</th><th>Categor\u00eda</th><th>Cantidad</th><th>Lote</th><th>Caducidad</th><th>Ubicaci\u00f3n</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">ChefManager Pro - Generado autom\u00e1ticamente</div>
        </body></html>`;
      }
    } else if (tipo === "pedidos") {
      const pedidos = await prisma.pedido.findMany({
        where: { unidadId, tenantId },
        include: { items: { include: { producto: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      if (format === "csv") {
        const headers = ["ID", "Fecha", "Estado", "Items", "Total"];
        const rows = pedidos.map((p: any) => [
          p.id.toString(),
          formatDate(p.createdAt),
          p.estado,
          p.items.length.toString(),
          toNumber(p.total).toFixed(2),
        ]);
        content = generateCSV(headers, rows);
      } else {
        const rows = pedidos.map((p: any) => `
          <tr>
            <td>#${p.id}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td><span class="badge ${p.estado}">${p.estado}</span></td>
            <td style="text-align:center;">${p.items.length}</td>
            <td style="text-align:right;">${formatCurrency(p.total)}</td>
          </tr>
        `).join("");

        content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #059669; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .borrador { background: #e2e8f0; } .enviado { background: #bfdbfe; color: #1e40af; }
          .recibido { background: #bbf7d0; color: #166534; } .cancelado { background: #fecaca; color: #991b1b; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style></head><body>
          <h1>Reporte de Pedidos</h1>
          <p>Fecha: ${new Date().toLocaleDateString("es-ES")} | Total: ${pedidos.length} pedidos</p>
          <table>
            <thead><tr><th>ID</th><th>Fecha</th><th>Estado</th><th>Items</th><th style="text-align:right;">Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">ChefManager Pro - Generado autom\u00e1ticamente</div>
        </body></html>`;
      }
    } else if (tipo === "consumos") {
      const movimientos = await prisma.movimiento.findMany({
        where: { unidadId, tenantId, tipo: { in: ["consumo", "merma"] } },
        include: { producto: true, usuario: { select: { nombre: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      if (format === "csv") {
        const headers = ["Fecha", "Producto", "Tipo", "Cantidad", "Lote", "Usuario", "Notas"];
        const rows = movimientos.map((m: any) => [
          formatDate(m.createdAt),
          m.producto?.nombre || "",
          m.tipo,
          formatDecimal(m.cantidad),
          m.lote || "",
          m.usuario?.nombre || "",
          m.notas || "",
        ]);
        content = generateCSV(headers, rows);
      } else {
        const rows = movimientos.map((m: any) => `
          <tr>
            <td>${formatDate(m.createdAt)}</td>
            <td>${m.producto?.nombre}</td>
            <td><span class="badge ${m.tipo}">${m.tipo}</span></td>
            <td style="text-align:center;">${formatDecimal(m.cantidad)} ${m.producto?.unidadMedida}</td>
            <td>${m.lote || "-"}</td>
            <td>${m.usuario?.nombre || "-"}</td>
          </tr>
        `).join("");

        content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #ea580c; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .consumo { background: #bfdbfe; color: #1e40af; } .merma { background: #fecaca; color: #991b1b; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style></head><body>
          <h1>Reporte de Consumos y Mermas</h1>
          <p>Fecha: ${new Date().toLocaleDateString("es-ES")} | Total movimientos: ${movimientos.length}</p>
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Lote</th><th>Usuario</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">ChefManager Pro - Generado autom\u00e1ticamente</div>
        </body></html>`;
      }
    } else if (tipo === "consumo-diario") {
      // Consumo real por comandas (TPV) y producción, agrupado por día +
      // insumo + motivo. A diferencia de "consumos" (que solo cubre
      // consumo/merma manual vía Movimiento), esto lee ConsumoLote y
      // ConsumoLoteElaboracion — donde queda registrada toda venta de ficha
      // técnica y toda producción de elaboración.
      const desdeParam = searchParams.get("desde");
      const hastaParam = searchParams.get("hasta");
      const hasta = hastaParam ? new Date(hastaParam) : new Date();
      const desde = desdeParam
        ? new Date(desdeParam)
        : new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);
      hasta.setHours(23, 59, 59, 999);

      const [consumosProducto, consumosElaboracion] = await Promise.all([
        prisma.consumoLote.findMany({
          where: { tenantId, createdAt: { gte: desde, lte: hasta } },
          include: { lote: { include: { producto: { select: { nombre: true, unidadBase: true, contenidoUnidad: true, unidadMedida: true } } } } },
        }),
        prisma.consumoLoteElaboracion.findMany({
          where: { tenantId, createdAt: { gte: desde, lte: hasta } },
          include: { loteElaboracion: { include: { elaboracion: { select: { nombre: true, unidadBase: true } } } } },
        }),
      ]);

      type Fila = { fecha: string; insumo: string; unidad: string; motivo: string; cantidad: number };
      const porClave = new Map<string, Fila>();
      const acumular = (fecha: string, insumo: string, unidad: string, motivo: string, cantidad: number) => {
        const clave = `${fecha}|${insumo}|${motivo}`;
        const existente = porClave.get(clave);
        if (existente) existente.cantidad += cantidad;
        else porClave.set(clave, { fecha, insumo, unidad, motivo, cantidad });
      };

      for (const c of consumosProducto) {
        const prod = c.lote.producto;
        const unidad = prod.unidadBase ?? prod.contenidoUnidad ?? prod.unidadMedida;
        acumular(c.createdAt.toISOString().slice(0, 10), prod.nombre, unidad, c.motivo, c.cantidad);
      }
      for (const c of consumosElaboracion) {
        const elab = c.loteElaboracion.elaboracion;
        acumular(c.createdAt.toISOString().slice(0, 10), elab.nombre, elab.unidadBase, c.motivo, c.cantidad);
      }

      const filas = Array.from(porClave.values()).sort((a, b) =>
        b.fecha === a.fecha ? a.insumo.localeCompare(b.insumo) : b.fecha.localeCompare(a.fecha)
      );

      if (format === "csv") {
        const headers = ["Fecha", "Insumo", "Motivo", "Cantidad", "Unidad"];
        const rows = filas.map((f) => [f.fecha, f.insumo, f.motivo, formatDecimal(f.cantidad), f.unidad]);
        content = generateCSV(headers, rows);
      } else {
        const rows = filas.map((f) => `
          <tr>
            <td>${f.fecha}</td>
            <td>${f.insumo}</td>
            <td><span class="badge ${f.motivo}">${f.motivo}</span></td>
            <td style="text-align:right;">${formatDecimal(f.cantidad)} ${f.unidad}</td>
          </tr>
        `).join("");

        content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #7c3aed; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #ede9fe; color: #5b21b6; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style></head><body>
          <h1>Consumo diario por insumo</h1>
          <p>Del ${formatDate(desde)} al ${formatDate(hasta)} | ${filas.length} filas</p>
          <table>
            <thead><tr><th>Fecha</th><th>Insumo</th><th>Motivo</th><th style="text-align:right;">Cantidad</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">ChefManager Pro - Generado automáticamente</div>
        </body></html>`;
      }
    } else if (tipo === "caducidades") {
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const inventario = await prisma.inventario.findMany({
        where: {
          unidadId,
          tenantId,
          estado: "disponible",
          fechaCaducidad: { lte: in30Days },
        },
        include: { producto: { include: { categoria: true } } },
        orderBy: { fechaCaducidad: "asc" },
      });

      if (format === "csv") {
        const headers = ["Producto", "Categor\u00eda", "Cantidad", "Lote", "Caducidad", "D\u00edas restantes", "Ubicaci\u00f3n"];
        const rows = inventario.map((inv: any) => [
          inv.producto?.nombre || "",
          inv.producto?.categoria?.nombre || "",
          formatDecimal(inv.cantidad),
          inv.lote || "",
          inv.fechaCaducidad ? formatDate(inv.fechaCaducidad) : "",
          (getDaysUntilExpiry(inv.fechaCaducidad) ?? "").toString(),
          inv.ubicacion || "",
        ]);
        content = generateCSV(headers, rows);
      } else {
        const rows = inventario.map((inv: any) => {
          const days = getDaysUntilExpiry(inv.fechaCaducidad);
          const color = (days ?? 0) < 0 ? "#dc2626" : (days ?? 0) <= 7 ? "#f59e0b" : "#64748b";
          return `
            <tr>
              <td>${inv.producto?.nombre}</td>
              <td>${inv.producto?.categoria?.nombre || "-"}</td>
              <td style="text-align:center;">${formatDecimal(inv.cantidad)} ${inv.producto?.unidadMedida}</td>
              <td>${inv.lote || "-"}</td>
              <td>${formatDate(inv.fechaCaducidad)}</td>
              <td style="text-align:center; color: ${color}; font-weight: bold;">${days} d\u00edas</td>
              <td>${inv.ubicacion || "-"}</td>
            </tr>
          `;
        }).join("");

        content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #dc2626; color: white; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #fef2f2; }
          .footer { margin-top: 30px; text-align: center; color: #64748b; font-size: 12px; }
        </style></head><body>
          <h1>Reporte de Caducidades</h1>
          <p>Fecha: ${new Date().toLocaleDateString("es-ES")} | Productos pr\u00f3ximos a caducar: ${inventario.length}</p>
          <table>
            <thead><tr><th>Producto</th><th>Categor\u00eda</th><th>Cantidad</th><th>Lote</th><th>Caducidad</th><th>D\u00edas</th><th>Ubicaci\u00f3n</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">ChefManager Pro - Generado autom\u00e1ticamente</div>
        </body></html>`;
      }
    } else {
      return NextResponse.json({ error: "Tipo de reporte no v\u00e1lido" }, { status: 400 });
    }

    if (format === "csv") {
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    } else {
      const pdfBuffer = await generatePDF(content);
      if (!pdfBuffer) {
        return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
      }
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber, formatCurrency, formatDate, formatDecimal } from "@/lib/utils";
import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";
import archiver from "archiver";
import { htmlToPdf } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";

function generatePDFHtml(
  pedido: any,
  items: any[],
  titulo: string,
  subtitulo?: string
): string {
  const totalItems = items.length;

  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.producto?.nombre || ""}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${formatDecimal(item.cantidad)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.producto?.unidadMedida || ""}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.producto?.proveedor?.nombre || "-"}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; }
        .header p { margin: 0; opacity: 0.9; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
        .info-box label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-box p { font-size: 16px; font-weight: 600; margin: 5px 0 0 0; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; }
        th:nth-child(2), th:nth-child(3) { text-align: center; }
        .total-row { background: #f8fafc; }
        .total-row td { padding: 15px 10px; font-size: 18px; font-weight: 700; }
        .total-amount { color: #2563eb; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
        .notes { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px; border-radius: 4px; }
        .notes h4 { margin: 0 0 5px 0; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${titulo}</h1>
        <p>${subtitulo || "PANZZONI - Cantina e Pizza"}</p>
      </div>
      
      <div class="info-grid">
        <div class="info-box">
          <label>Número de Pedido</label>
          <p>#${pedido.id}</p>
        </div>
        <div class="info-box">
          <label>Fecha</label>
          <p>${formatDate(pedido.createdAt)}</p>
        </div>
        <div class="info-box">
          <label>Estado</label>
          <p>${pedido.estado?.toUpperCase()}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Unidad</th>
            <th>Proveedor</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="3" style="text-align: right; padding-right: 20px;">TOTAL PRODUCTOS:</td>
            <td class="total-amount">${totalItems} items</td>
          </tr>
        </tbody>
      </table>
      
      ${pedido.notas ? `<div class="notes"><h4>Notas:</h4><p>${pedido.notas}</p></div>` : ""}
      
      <div class="footer">
        <p>Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <p>PANZZONI - Cantina e Pizza &copy; ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;
}

async function generatePDF(html: string, _filename: string): Promise<Buffer | null> {
  try {
    return await htmlToPdf(html, {
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const { pedidoId, tipo } = await request.json();

    if (!pedidoId || !tipo) {
      return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findFirst({
      where: { id: pedidoId, tenantId: getActiveTenantId(user), unidadId: getActiveUnidadId(user) ?? undefined },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        items: {
          include: {
            producto: {
              include: {
                categoria: { select: { id: true, nombre: true } },
                proveedor: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const items = pedido.items.map((i: any) => ({
      ...i,
      cantidad: toNumber(i.cantidad),
      precioUnitario: toNumber(i.precioUnitario),
      producto: {
        ...i.producto,
        precioUnitario: toNumber(i.producto.precioUnitario),
      },
    }));

    let pdfBuffer: Buffer | null = null;
    let filename = `pedido_${pedido.id}.pdf`;

    if (tipo === "completo") {
      const html = generatePDFHtml(
        pedido,
        items,
        `Pedido #${pedido.id}`,
        "Pedido Completo"
      );
      pdfBuffer = await generatePDF(html, filename);
    } else if (tipo === "por_proveedor") {
      const byProveedor: Record<string, any[]> = {};
      for (const item of items) {
        const provNombre = item.producto?.proveedor?.nombre || "Sin Proveedor";
        if (!byProveedor[provNombre]) byProveedor[provNombre] = [];
        byProveedor[provNombre].push(item);
      }

      const proveedores = Object.keys(byProveedor);
      const fechaStr = new Date(pedido.createdAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit", 
        year: "numeric"
      }).replace(/\//g, "-");

      const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "").replace(/\s+/g, "_").substring(0, 30);

      const generateProveedorHtml = (provNombre: string, provItems: any[]) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
            .header h1 { margin: 0 0 10px 0; font-size: 28px; }
            .header p { margin: 0; opacity: 0.9; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; }
            .info-box label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-box p { font-size: 16px; font-weight: 600; margin: 5px 0 0 0; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; }
            th:nth-child(2), th:nth-child(3) { text-align: center; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-row { background: #f8fafc; }
            .total-row td { padding: 15px 10px; font-size: 18px; font-weight: 700; }
            .total-amount { color: #10b981; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${provNombre}</h1>
            <p>Pedido #${pedido.id} - PANZZONI - Cantina e Pizza</p>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <label>Número de Pedido</label>
              <p>#${pedido.id}</p>
            </div>
            <div class="info-box">
              <label>Fecha</label>
              <p>${formatDate(pedido.createdAt)}</p>
            </div>
            <div class="info-box">
              <label>Estado</label>
              <p>${pedido.estado?.toUpperCase()}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Unidad</th>
              </tr>
            </thead>
            <tbody>
              ${provItems.map((item) => `
                <tr>
                  <td>${item.producto?.nombre || ""}</td>
                  <td style="text-align: center;">${formatDecimal(item.cantidad)}</td>
                  <td style="text-align: center;">${item.producto?.unidadMedida || ""}</td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="2" style="text-align: right; padding-right: 20px;">TOTAL PRODUCTOS:</td>
                <td class="total-amount">${provItems.length} items</td>
              </tr>
            </tbody>
          </table>
          
          ${pedido.notas ? `<div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px; border-radius: 4px;"><h4 style="margin: 0 0 5px 0; color: #92400e;">Notas:</h4><p style="margin: 0;">${pedido.notas}</p></div>` : ""}
          
          <div class="footer">
            <p>Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            <p>ChefManager Pro © ${new Date().getFullYear()}</p>
          </div>
        </body>
        </html>
      `;

      if (proveedores.length === 1) {
        const provNombre = proveedores[0];
        const provItems = byProveedor[provNombre];
        const html = generateProveedorHtml(provNombre, provItems);
        filename = `${sanitizeName(provNombre)}_${fechaStr}_Pedido${pedido.id}.pdf`;
        pdfBuffer = await generatePDF(html, filename);
      } else {
        const pdfFiles: { name: string; buffer: Buffer }[] = [];
        
        for (const provNombre of proveedores) {
          const provItems = byProveedor[provNombre];
          const html = generateProveedorHtml(provNombre, provItems);
          const pdfName = `${sanitizeName(provNombre)}_${fechaStr}_Pedido${pedido.id}.pdf`;
          const pdf = await generatePDF(html, pdfName);
          if (pdf) {
            pdfFiles.push({ name: pdfName, buffer: pdf });
          }
        }

        if (pdfFiles.length === 0) {
          return NextResponse.json({ error: "Error generando PDFs" }, { status: 500 });
        }

        const chunks: Buffer[] = [];
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        
        const archivePromise = new Promise<Buffer>((resolve, reject) => {
          archive.on("end", () => resolve(Buffer.concat(chunks)));
          archive.on("error", reject);
        });

        for (const file of pdfFiles) {
          archive.append(file.buffer, { name: file.name });
        }

        await archive.finalize();
        const zipBuffer = await archivePromise;

        return new NextResponse(new Uint8Array(zipBuffer), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="Pedido${pedido.id}_${fechaStr}_por_proveedor.zip"`,
          },
        });
      }
    } else if (tipo === "por_categoria") {
      const byCategoria: Record<string, any[]> = {};
      for (const item of items) {
        const catNombre = item.producto?.categoria?.nombre || "Sin Categoría";
        if (!byCategoria[catNombre]) byCategoria[catNombre] = [];
        byCategoria[catNombre].push(item);
      }

      let combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
            .page-break { page-break-before: always; }
            .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
            .header h1 { margin: 0 0 10px 0; font-size: 28px; }
            .header p { margin: 0; opacity: 0.9; }
            .section { margin-bottom: 40px; }
            .section-title { background: #f59e0b; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            .section-title h2 { margin: 0; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-weight: 600; color: #475569; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total { text-align: right; font-size: 18px; font-weight: 700; color: #7c3aed; margin-top: 10px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Pedido #${pedido.id} - Por Categoría</h1>
            <p>Fecha: ${formatDate(pedido.createdAt)}</p>
          </div>
      `;

      const categorias = Object.keys(byCategoria);
      categorias.forEach((cat, idx) => {
        const catItems = byCategoria[cat];
        const totalProductos = catItems.length;

        combinedHtml += `
          ${idx > 0 ? '<div class="page-break"></div>' : ""}
          <div class="section">
            <div class="section-title">
              <h2>Categoría: ${cat}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th style="text-align: center;">Cantidad</th>
                  <th style="text-align: center;">Unidad</th>
                </tr>
              </thead>
              <tbody>
                ${catItems
                  .map(
                    (item) => `
                  <tr>
                    <td>${item.producto?.nombre || ""}</td>
                    <td>${item.producto?.proveedor?.nombre || "-"}</td>
                    <td style="text-align: center;">${formatDecimal(item.cantidad)}</td>
                    <td style="text-align: center;">${item.producto?.unidadMedida || ""}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="total">Total productos: ${totalProductos} items</div>
          </div>
        `;
      });

      combinedHtml += `
          <div class="footer">
            <p>Generado el ${new Date().toLocaleDateString("es-ES")}</p>
          </div>
        </body>
        </html>
      `;

      filename = `pedido_${pedido.id}_por_categoria.pdf`;
      pdfBuffer = await generatePDF(combinedHtml, filename);
    }

    if (!pdfBuffer) {
      return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

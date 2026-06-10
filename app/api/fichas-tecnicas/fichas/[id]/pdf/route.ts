import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFichasContext } from "@/lib/fichas/permissions";
import { getLiveCostMaps, decorateFicha } from "@/lib/fichas/costing";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getFichasContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const [fichaRaw, maps] = await Promise.all([
      prisma.fichaTecnica.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          categoria: true,
          ingredientes: { include: { insumo: true } },
          creadoPor: { select: { nombre: true } },
        },
      }),
      getLiveCostMaps(ctx.tenantId),
    ]);

    if (!fichaRaw) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const ficha = decorateFicha(fichaRaw, maps);

    const alergenosLabels: Record<string, string> = {
      gluten: "Gluten",
      crustaceos: "Crustáceos",
      huevos: "Huevos",
      pescado: "Pescado",
      cacahuetes: "Cacahuetes",
      soja: "Soja",
      lacteos: "Lácteos",
      frutosSecos: "Frutos secos",
      apio: "Apio",
      mostaza: "Mostaza",
      sesamo: "Sésamo",
      sulfitos: "Sulfitos",
      altramuces: "Altramuces",
      moluscos: "Moluscos",
    };

    const ingredientesRows = ficha.ingredientes
      .map(
        (ing) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(ing.insumo.nombre)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${ing.cantidad} ${escapeHtml(ing.insumo.unidad)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${ing.costoCalculado.toFixed(2)} €</td>
        </tr>`
      )
      .join("");

    const procedimientoHTML = ficha.procedimiento
      ? ficha.procedimiento
          .split("\n")
          .filter((l) => l.trim())
          .map((linea) => `<li style="margin-bottom:8px;">${escapeHtml(linea.replace(/^\d+\.\s*/, "") || linea)}</li>`)
          .join("")
      : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ficha Técnica - ${escapeHtml(ficha.nombre)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
    .header-left h1 { font-size: 24px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
    .header-left .categoria { font-size: 13px; color: #64748b; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 9999px; display: inline-block; }
    .logo { font-size: 12px; color: #64748b; text-align: right; }
    .logo strong { display: block; font-size: 14px; color: #2563eb; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .meta-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .meta-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
    .meta-item .value { font-size: 16px; font-weight: bold; color: #0f172a; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #bfdbfe; padding-bottom: 6px; margin-bottom: 12px; }
    .descripcion { color: #475569; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #eff6ff; }
    thead th { padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
    .alergenos { display: flex; flex-wrap: wrap; gap: 6px; }
    .alergeno-tag { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 2px 8px; border-radius: 9999px; font-size: 12px; }
    .procedimiento ol { padding-left: 20px; line-height: 1.8; color: #475569; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print" style="text-align:center;margin-bottom:20px;">
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;">Imprimir / Guardar PDF</button>
    </div>

    <div class="header">
      <div class="header-left">
        <h1>${escapeHtml(ficha.nombre)}</h1>
        ${ficha.categoria ? `<span class="categoria">${escapeHtml(ficha.categoria.nombre)}</span>` : ""}
      </div>
      <div class="logo">
        <strong>ChefManager Pro</strong>
        Fichas Técnicas
      </div>
    </div>

    <div class="meta">
      <div class="meta-item">
        <div class="label">Porciones</div>
        <div class="value">${ficha.porciones}</div>
      </div>
      <div class="meta-item">
        <div class="label">Tiempo</div>
        <div class="value">${ficha.tiempoMin} min</div>
      </div>
      <div class="meta-item">
        <div class="label">Costo Total</div>
        <div class="value">${ficha.costoTotal.toFixed(2)} €</div>
      </div>
      <div class="meta-item">
        <div class="label">Costo/Porción</div>
        <div class="value">${ficha.costoPorPorcion.toFixed(2)} €</div>
      </div>
    </div>

    ${
      ficha.descripcion
        ? `<div class="section">
        <div class="section-title">Descripción</div>
        <p class="descripcion">${escapeHtml(ficha.descripcion)}</p>
      </div>`
        : ""
    }

    ${
      ficha.ingredientes.length > 0
        ? `<div class="section">
        <div class="section-title">Ingredientes</div>
        <table>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th style="text-align:center;">Cantidad</th>
              <th style="text-align:right;">Costo</th>
            </tr>
          </thead>
          <tbody>
            ${ingredientesRows}
          </tbody>
        </table>
      </div>`
        : ""
    }

    ${
      ficha.alergenos.length > 0
        ? `<div class="section">
        <div class="section-title">Alérgenos</div>
        <div class="alergenos">
          ${ficha.alergenos.map((a) => `<span class="alergeno-tag">${escapeHtml(alergenosLabels[a] || a)}</span>`).join("")}
        </div>
      </div>`
        : ""
    }

    ${
      ficha.procedimiento
        ? `<div class="section procedimiento">
        <div class="section-title">Procedimiento</div>
        <ol>${procedimientoHTML}</ol>
      </div>`
        : ""
    }

    <div class="footer">
      <span>Creado por: ${escapeHtml(ficha.creadoPor?.nombre || "Sistema")}</span>
      <span>Generado: ${new Date().toLocaleDateString("es-ES")}</span>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating ficha PDF:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

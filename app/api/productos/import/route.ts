import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;
const CONTENIDO_UNIDADES = new Set(["g", "ml", "un"]);

// Normaliza un nombre para comparar sin distinguir mayúsculas ni espacios.
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Convierte una celda a número aceptando coma decimal (formato es-ES).
function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Toma el primer valor no vacío entre varias posibles cabeceras de columna.
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const tenantId = getActiveTenantId(user);
    const body = await request.json();
    const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene filas" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Máximo ${MAX_ROWS} filas por importación` }, { status: 400 });
    }

    // Cachés en memoria para no duplicar categorías/proveedores ni repetir queries.
    const [cats, provs] = await Promise.all([
      prisma.categoria.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
      prisma.proveedor.findMany({ where: { tenantId }, select: { id: true, nombre: true } }),
    ]);
    const catCache = new Map<string, number>(cats.map((c) => [normalize(c.nombre), c.id]));
    const provCache = new Map<string, number>(provs.map((p) => [normalize(p.nombre), p.id]));

    let categoriasCreadas = 0;
    let proveedoresCreados = 0;

    const resolveCategoria = async (nombre: string): Promise<number> => {
      const key = normalize(nombre);
      const cached = catCache.get(key);
      if (cached) return cached;
      const created = await prisma.categoria.create({ data: { nombre: nombre.trim(), activo: true, tenantId } });
      catCache.set(key, created.id);
      categoriasCreadas++;
      return created.id;
    };

    const resolveProveedor = async (nombre: string): Promise<number> => {
      const key = normalize(nombre);
      const cached = provCache.get(key);
      if (cached) return cached;
      const created = await prisma.proveedor.create({ data: { nombre: nombre.trim(), activo: true, tenantId } });
      provCache.set(key, created.id);
      proveedoresCreados++;
      return created.id;
    };

    const errores: { fila: number; motivo: string }[] = [];
    let creados = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filaNum = i + 2; // +1 por la cabecera, +1 por base-1 (coincide con Excel)
      try {
        const nombre = pick(row, "nombre", "Nombre", "producto", "Producto");
        if (!nombre) {
          errores.push({ fila: filaNum, motivo: "Falta el nombre del producto" });
          continue;
        }

        const categoriaNombre = pick(row, "categoria", "categoría", "Categoria", "Categoría") || "Sin categoría";
        const proveedorNombre = pick(row, "proveedor", "Proveedor");
        const fabricante = pick(row, "fabricante", "Fabricante") || null;
        const formato = pick(row, "formato", "Formato") || null;
        const unidad = pick(row, "unidad_medida", "unidad", "Unidad", "unidad de medida") || "kg";
        const precio = parseNumber(pick(row, "precio_unitario", "precio", "Precio")) ?? 0;
        const stock = parseNumber(pick(row, "stock_minimo", "stock", "Stock")) ?? 0;
        const contenidoNeto = parseNumber(pick(row, "contenido_neto", "contenido"));
        const contenidoUnidadRaw = normalize(pick(row, "contenido_unidad", "unidad_contenido"));
        const contenidoUnidad = CONTENIDO_UNIDADES.has(contenidoUnidadRaw) ? contenidoUnidadRaw : null;

        const categoriaId = await resolveCategoria(categoriaNombre);
        const proveedorId = proveedorNombre ? await resolveProveedor(proveedorNombre) : null;

        const tieneContenido = contenidoNeto != null && contenidoNeto > 0;

        await prisma.producto.create({
          data: {
            nombre,
            fabricante,
            formato,
            categoriaId,
            proveedorId,
            unidadMedida: unidad,
            precioUnitario: new Decimal(precio < 0 ? 0 : precio),
            stockMinimo: new Decimal(stock < 0 ? 0 : stock),
            contenidoNeto: tieneContenido ? new Decimal(contenidoNeto!) : null,
            contenidoUnidad: tieneContenido ? contenidoUnidad : null,
            activo: true,
            tenantId,
          },
        });
        creados++;
      } catch (e) {
        console.error(`Error importando fila ${filaNum}:`, e);
        errores.push({ fila: filaNum, motivo: "No se pudo crear el producto" });
      }
    }

    return NextResponse.json({ total: rows.length, creados, categoriasCreadas, proveedoresCreados, errores });
  } catch (error) {
    console.error("Error importando productos:", error);
    return NextResponse.json({ error: "Error al importar" }, { status: 500 });
  }
}

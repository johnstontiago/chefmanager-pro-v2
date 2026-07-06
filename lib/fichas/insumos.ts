import prisma from "@/lib/db";
import {
  getLiveCostMaps,
  decorateInsumo,
  syncProductosAsInsumos,
  syncElaboracionesAsInsumos,
} from "@/lib/fichas/costing";

/**
 * Catálogo completo de insumos disponibles para un tenant, con coste en vivo:
 * productos, elaboraciones (sincronizados como insumo) y preparaciones/manuales.
 * Reutilizado por el endpoint de insumos y por los formularios que necesitan
 * elegir un ingrediente (fichas, preparaciones, elaboraciones).
 */
export async function getCatalogoInsumos(tenantId: number) {
  await syncProductosAsInsumos(tenantId);
  await syncElaboracionesAsInsumos(tenantId);

  const [insumos, maps] = await Promise.all([
    prisma.insumo.findMany({
      where: { tenantId },
      orderBy: { nombre: "asc" },
      include: {
        preparacion: { select: { id: true, nombre: true } },
        producto: { select: { id: true, nombre: true, activo: true } },
        elaboracion: { select: { id: true, nombre: true } },
      },
    }),
    getLiveCostMaps(tenantId),
  ]);

  return insumos.map((i) => decorateInsumo(i, maps));
}

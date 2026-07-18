import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getActiveTenantId } from "@/lib/get-active-tenant";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { convertirHaciaElaboracion } from "@/lib/fichas/costing";
import { FichasNav } from "../_components/fichas-nav";
import PreparacionesManager from "./_components/preparaciones-manager";

export const dynamic = "force-dynamic";

export default async function FichasPreparacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const tenantId = getActiveTenantId(session.user as any);
  const rol = (session.user as any).rol || "viewer";

  const [elaboraciones, producciones] = await Promise.all([
    prisma.elaboracion.findMany({
      where: { tenantId, activa: true },
      orderBy: { nombre: "asc" },
      include: {
        ingredientes: {
          include: {
            producto: { select: { id: true, nombre: true } },
            insumo: {
              select: {
                id: true, nombre: true,
                elaboracion: { select: { unidadBase: true, contenidoNeto: true, contenidoUnidad: true } },
              },
            },
          },
        },
      },
    }),
    prisma.loteElaboracion.findMany({
      where: { tenantId },
      orderBy: { fechaProduccion: "desc" },
      take: 30,
      include: { elaboracion: { select: { nombre: true, unidadBase: true } } },
    }),
  ]);

  // Para ingredientes que son otra elaboración (ej. Biga dentro de Bola Masa),
  // precalcula el equivalente en la unidad de stock de esa elaboración (ej.
  // "unidad") para que la vista previa no muestre solo gramos y parezca
  // inconsistente con cómo se produce esa elaboración.
  const elaboracionesData = elaboraciones.map((e) => ({
    ...e,
    ingredientes: e.ingredientes.map((ing) => {
      const elabRef = ing.insumo?.elaboracion;
      if (!elabRef) return { ...ing, cantidadEnUnidadInsumo: null, unidadInsumo: null };
      const cantidadEnUnidadInsumo = convertirHaciaElaboracion(ing.cantidad, ing.unidad, elabRef);
      const mostrarEquivalencia = elabRef.unidadBase.trim().toLowerCase() !== ing.unidad.trim().toLowerCase();
      return {
        ...ing,
        cantidadEnUnidadInsumo: mostrarEquivalencia ? cantidadEnUnidadInsumo : null,
        unidadInsumo: mostrarEquivalencia ? elabRef.unidadBase : null,
      };
    }),
  }));

  const produccionesData = producciones.map((p) => ({
    id: p.id,
    elaboracionNombre: p.elaboracion.nombre,
    unidadBase: p.elaboracion.unidadBase,
    cantidadInicial: p.cantidadInicial,
    cantidadActual: p.cantidadActual,
    numeroLote: p.numeroLote,
    numeroEnvases: p.numeroEnvases,
    codigoUnico: p.codigoUnico,
    fechaProduccion: p.fechaProduccion.toISOString(),
    fechaCaducidad: p.fechaCaducidad ? p.fechaCaducidad.toISOString() : null,
    agotado: p.agotado,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Preparaciones</h1>
        <p className="text-muted-foreground text-sm">
          Producir una elaboración: entra al stock como lote e imprime etiquetas
        </p>
      </div>
      <FichasNav />
      <PreparacionesManager
        elaboraciones={elaboracionesData}
        producciones={produccionesData}
        rol={rol}
      />
    </div>
  );
}

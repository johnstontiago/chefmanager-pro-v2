import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getActiveTenantId } from "@/lib/get-active-tenant";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getCatalogoInsumos } from "@/lib/fichas/insumos";
import { FichasNav } from "../_components/fichas-nav";
import ElaboracionesManager from "./_components/elaboraciones-manager";

export const dynamic = "force-dynamic";

export default async function FichasElaboracionesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const tenantId = getActiveTenantId(session.user as any);
  const rol = (session.user as any).rol || "viewer";

  const [elaboraciones, insumos] = await Promise.all([
    prisma.elaboracion.findMany({
      where: { tenantId, activa: true },
      orderBy: { nombre: "asc" },
      include: {
        ingredientes: {
          include: {
            producto: {
              select: {
                id: true, nombre: true, unidadMedida: true,
                unidadBase: true, contenidoUnidad: true,
              },
            },
            insumo: { select: { id: true, nombre: true, unidad: true } },
          },
        },
        lotes: {
          where: { agotado: false },
          select: { cantidadActual: true },
        },
      },
    }),
    getCatalogoInsumos(tenantId),
  ]);

  const data = elaboraciones.map((e) => ({
    ...e,
    stockActual: e.lotes.reduce((s, l) => s + l.cantidadActual, 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Elaboraciones</h1>
        <p className="text-slate-500 text-sm">
          Recetas base: ingredientes, cantidades y paso a paso
        </p>
      </div>
      <FichasNav />
      <ElaboracionesManager elaboraciones={data} insumos={insumos} rol={rol} />
    </div>
  );
}

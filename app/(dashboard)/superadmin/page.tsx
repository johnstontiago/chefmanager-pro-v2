import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Users, CheckCircle2, XCircle, AlertCircle, Crown } from "lucide-react";

export const dynamic = "force-dynamic";

function planBadge(plan: string) {
  const map: Record<string, { label: string; className: string }> = {
    basico:       { label: "Básico",       className: "bg-slate-100 text-slate-700 border-slate-200" },
    profesional:  { label: "Profesional",  className: "bg-blue-100 text-blue-700 border-blue-200" },
    enterprise:   { label: "Enterprise",   className: "bg-purple-100 text-purple-700 border-purple-200" },
  };
  const cfg = map[plan] ?? map.basico;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

function estadoBadge(activo: boolean, fechaVencimiento: Date | null) {
  if (!activo) return <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Suspendido</Badge>;
  if (fechaVencimiento) {
    const diasRestantes = Math.ceil((fechaVencimiento.getTime() - Date.now()) / 86400000);
    if (diasRestantes < 0) return <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Vencido</Badge>;
    if (diasRestantes <= 7) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200" variant="outline">Vence en {diasRestantes}d</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">Activo</Badge>;
}

export default async function SuperadminPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.rol !== "superuser") redirect("/dashboard");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { usuarios: true, unidades: true } } },
  });

  const total     = tenants.length;
  const activos   = tenants.filter((t) => t.activo).length;
  const vencidos  = tenants.filter((t) => {
    if (!t.activo) return false;
    return t.fechaVencimiento && t.fechaVencimiento < new Date();
  }).length;
  const proximos  = tenants.filter((t) => {
    if (!t.activo || !t.fechaVencimiento) return false;
    const dias = Math.ceil((t.fechaVencimiento.getTime() - Date.now()) / 86400000);
    return dias >= 0 && dias <= 7;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Crown className="w-6 h-6 text-purple-600" />
            Panel de Administración
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de negocios clientes</p>
        </div>
        <Link href="/superadmin/tenants/nuevo">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Negocio
          </Button>
        </Link>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-800">{total}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <Building2 className="w-3.5 h-3.5" /> Total negocios
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{activos}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Activos
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-500">{proximos}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" /> Vencen pronto
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">{total - activos + vencidos}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <XCircle className="w-3.5 h-3.5" /> Suspendidos/Vencidos
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos los negocios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenants.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aún no hay negocios registrados</p>
              <p className="text-sm mt-1">Crea el primero con "Nuevo Negocio"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Negocio</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Vencimiento</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Usuarios</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{tenant.nombre}</div>
                        <div className="text-xs text-slate-400">{tenant.email}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{planBadge(tenant.plan)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                        {tenant.fechaVencimiento
                          ? new Date(tenant.fechaVencimiento).toLocaleDateString("es-ES")
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Users className="w-3.5 h-3.5" />
                          {tenant._count.usuarios}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {estadoBadge(tenant.activo, tenant.fechaVencimiento)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/superadmin/tenants/${tenant.id}`}>
                          <Button variant="outline" size="sm">Ver</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

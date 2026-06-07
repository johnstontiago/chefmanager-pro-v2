import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import DashboardShell from "./_components/dashboard-shell";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as any;

  let sudoTenant: { id: number; nombre: string; unidadId: number | null; unidadNombre: string | null } | null = null;

  if (user.rol === "superuser") {
    const raw = cookies().get("superadmin_sudo")?.value;
    if (raw) {
      try {
        const ctx = JSON.parse(raw);
        if (ctx.tenantId) {
          const t = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { id: true, nombre: true },
          });
          if (t) {
            sudoTenant = {
              id: t.id,
              nombre: t.nombre,
              unidadId: ctx.unidadId ?? null,
              unidadNombre: ctx.unidadNombre ?? null,
            };
          }
        }
      } catch {
        // Cookie en formato legacy (solo tenantId como número)
        const id = parseInt(raw, 10);
        if (!isNaN(id)) {
          const t = await prisma.tenant.findUnique({
            where: { id },
            select: { id: true, nombre: true },
          });
          if (t) sudoTenant = { id: t.id, nombre: t.nombre, unidadId: null, unidadNombre: null };
        }
      }
    }
  }

  return (
    <DashboardShell user={user} sudoTenant={sudoTenant}>
      {children}
    </DashboardShell>
  );
}

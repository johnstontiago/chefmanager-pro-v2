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

  let sudoTenant: { id: number; nombre: string } | null = null;
  if (user.rol === "superuser") {
    const sudo = cookies().get("superadmin_sudo")?.value;
    if (sudo) {
      const id = parseInt(sudo, 10);
      if (!isNaN(id)) {
        const t = await prisma.tenant.findUnique({
          where: { id },
          select: { id: true, nombre: true },
        });
        if (t) sudoTenant = t;
      }
    }
  }

  return (
    <DashboardShell user={user} sudoTenant={sudoTenant}>
      {children}
    </DashboardShell>
  );
}

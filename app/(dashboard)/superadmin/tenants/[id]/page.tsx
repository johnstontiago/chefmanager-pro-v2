import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import TenantDetailClient from "./_components/tenant-detail-client";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.rol !== "superuser") redirect("/dashboard");

  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      unidades: { orderBy: { nombre: "asc" } },
      usuarios: {
        orderBy: { nombre: "asc" },
        select: { id: true, email: true, nombre: true, rol: true, activo: true, unidadId: true },
      },
      _count: { select: { usuarios: true, unidades: true, pedidos: true } },
    },
  });

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/superadmin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Panel Admin
          </Button>
        </Link>
      </div>
      <TenantDetailClient tenant={JSON.parse(JSON.stringify(tenant))} />
    </div>
  );
}

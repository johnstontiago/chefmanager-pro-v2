import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { TenantCreateSchema } from "@/lib/schemas";
import { seedInsumosPorDefecto } from "@/lib/tenants/seedInsumosPorDefecto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { usuarios: true, unidades: true } },
      },
    });

    return NextResponse.json({ tenants });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const body = await request.json();
    const parsed = TenantCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { nombre, cif, email, regionUE, plan, fechaVencimiento, notasInternas } = parsed.data;

    if (cif) {
      const exists = await prisma.tenant.findUnique({ where: { cif } });
      if (exists) return NextResponse.json({ error: "CIF ya registrado" }, { status: 400 });
    }

    const tenant = await prisma.tenant.create({
      data: {
        nombre,
        cif: cif || null,
        email,
        regionUE: regionUE ?? true,
        plan: plan || "basico",
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        notasInternas: notasInternas || null,
        activo: true,
      },
    });

    await seedInsumosPorDefecto(tenant.id);

    return NextResponse.json({ tenant }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

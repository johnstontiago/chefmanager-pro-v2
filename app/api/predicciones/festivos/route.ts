import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const tenantId = getActiveTenantId(session.user as any);

    const festivos = await prisma.festivo.findMany({
      where: { tenantId, fecha: { gte: new Date() } },
      orderBy: { fecha: "asc" },
      take: 30,
    });
    return NextResponse.json(
      festivos.map((f) => ({
        id: f.id,
        fecha: f.fecha.toISOString().slice(0, 10),
        nombre: f.nombre,
        factor: f.factor,
      }))
    );
  } catch (error) {
    console.error("Error fetching festivos:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["superuser", "admin"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    const tenantId = getActiveTenantId(user);

    const { fecha, nombre, factor } = await req.json();
    if (!fecha || !nombre) {
      return NextResponse.json({ error: "Fecha y nombre son requeridos" }, { status: 400 });
    }
    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const factorNum = factor !== undefined && factor !== null && factor !== ""
      ? parseFloat(String(factor))
      : 1.25;
    if (isNaN(factorNum) || factorNum < 1 || factorNum > 5) {
      return NextResponse.json(
        { error: "El factor debe estar entre 1 y 5" },
        { status: 400 }
      );
    }

    const festivo = await prisma.festivo.create({
      data: { fecha: fechaDate, nombre, factor: factorNum, tenantId },
    });
    return NextResponse.json(festivo, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe ese festivo en esa fecha" }, { status: 400 });
    }
    console.error("Error creating festivo:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

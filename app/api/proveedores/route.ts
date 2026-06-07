import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { ProveedorCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Proveedores son globales - compartidos entre todas las unidades
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId as number;
    const proveedores = await prisma.proveedor.findMany({
      where: { activo: true, tenantId },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ proveedores });
  } catch (error) {
    console.error("Error fetching proveedores:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    // Solo admin o superuser pueden crear proveedores
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ProveedorCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { nombre, contacto, telefono, email } = parsed.data;

    const proveedor = await prisma.proveedor.create({
      data: {
        nombre,
        contacto: contacto || null,
        telefono: telefono || null,
        email: email || null,
        activo: true,
        tenantId: user.tenantId as number,
      },
    });

    return NextResponse.json({ proveedor, message: "Proveedor creado" });
  } catch (error) {
    console.error("Error creating proveedor:", error);
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { TenantUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

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

    if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

    return NextResponse.json({ tenant });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    // Elimina en cascada: usuarios, unidades, productos, pedidos, etc.
    await prisma.$transaction([
      prisma.movimiento.deleteMany({ where: { tenantId: id } }),
      prisma.inventario.deleteMany({ where: { tenantId: id } }),
      prisma.pedidoItem.deleteMany({ where: { pedido: { tenantId: id } } }),
      prisma.pedido.deleteMany({ where: { tenantId: id } }),
      prisma.producto.deleteMany({ where: { tenantId: id } }),
      prisma.categoria.deleteMany({ where: { tenantId: id } }),
      prisma.proveedor.deleteMany({ where: { tenantId: id } }),
      prisma.usuario.deleteMany({ where: { tenantId: id } }),
      prisma.unidad.deleteMany({ where: { tenantId: id } }),
      prisma.tenant.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[superadmin] DELETE tenant:", error);
    return NextResponse.json({ error: "Error al eliminar el negocio" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await request.json();
    const parsed = TenantUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { nombre, cif, email, regionUE, plan, fechaVencimiento, notasInternas, activo } = parsed.data;

    if (cif) {
      const conflict = await prisma.tenant.findFirst({ where: { cif, NOT: { id } } });
      if (conflict) return NextResponse.json({ error: "CIF ya registrado en otro negocio" }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(cif !== undefined && { cif: cif || null }),
        ...(email !== undefined && { email }),
        ...(regionUE !== undefined && { regionUE }),
        ...(plan !== undefined && { plan }),
        ...(fechaVencimiento !== undefined && { fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null }),
        ...(notasInternas !== undefined && { notasInternas: notasInternas || null }),
        ...(activo !== undefined && { activo }),
      },
    });

    return NextResponse.json({ tenant });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

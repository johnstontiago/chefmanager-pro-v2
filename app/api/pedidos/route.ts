import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";
import { PedidoCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const unidadId = user.unidadId;

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const pedidos = await prisma.pedido.findMany({
      where: { unidadId },
      orderBy: { createdAt: "desc" },
      include: {
        proveedor: { select: { nombre: true } },
        items: {
          include: {
            producto: {
              include: {
                categoria: { select: { id: true, nombre: true } },
                proveedor: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    const pedidosFormateados = pedidos.map((p: any) => ({
      ...p,
      total: toNumber(p.total),
      items: p.items.map((i: any) => ({
        ...i,
        cantidad: toNumber(i.cantidad),
        precioUnitario: toNumber(i.precioUnitario),
        cantidadRecibida: toNumber(i.cantidadRecibida),
        producto: {
          ...i.producto,
          precioUnitario: toNumber(i.producto.precioUnitario),
          stockMinimo: toNumber(i.producto.stockMinimo),
        },
      })),
    }));

    return NextResponse.json({ pedidos: pedidosFormateados });
  } catch (error) {
    console.error("Error fetching pedidos:", error);
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
    const unidadId = parseInt(String(user.unidadId));
    const usuarioId = parseInt(String(user.id));

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = PedidoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { items, notas, estado = "borrador", proveedorId } = parsed.data;

    let total = 0;
    for (const item of items) {
      total += item.cantidad * item.precioUnitario;
    }

    const pedido = await prisma.pedido.create({
      data: {
        unidadId,
        usuarioId,
        proveedorId: proveedorId ?? null,
        estado: estado || "borrador",
        total: new Decimal(total),
        notas: notas || null,
        items: {
          create: items.map((item: any) => ({
            productoId: item.productoId,
            cantidad: new Decimal(item.cantidad),
            precioUnitario: new Decimal(item.precioUnitario),
          })),
        },
      },
      include: {
        items: { include: { producto: true } },
      },
    });

    return NextResponse.json({ pedido, message: "Pedido creado" });
  } catch (error) {
    console.error("Error creating pedido:", error);
    return NextResponse.json({ error: "Error al crear pedido" }, { status: 500 });
  }
}

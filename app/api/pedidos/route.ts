import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";

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
    const unidadId = user.unidadId;

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const { items, notas, estado = "borrador" } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items requeridos" }, { status: 400 });
    }

    let total = 0;
    for (const item of items) {
      total += parseFloat(item.cantidad) * parseFloat(item.precioUnitario);
    }

    const pedido = await prisma.pedido.create({
      data: {
        unidadId,
        usuarioId: user.id,
        estado,
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

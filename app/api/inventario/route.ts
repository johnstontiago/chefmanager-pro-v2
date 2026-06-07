import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";
import { InventarioCreateSchema } from "@/lib/schemas";

import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as any;
    const unidadId = getActiveUnidadId(user);

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const productoId = searchParams.get("productoId");

    const tenantId = getActiveTenantId(user);
    const where: any = { unidadId, tenantId, estado: "disponible" };
    if (productoId) {
      where.productoId = parseInt(productoId);
    }

    const inventario = await prisma.inventario.findMany({
      where,
      orderBy: [{ fechaCaducidad: "asc" }, { createdAt: "asc" }],
      include: {
        producto: {
          include: {
            categoria: { select: { id: true, nombre: true } },
            proveedor: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    const inventarioFormateado = inventario.map((i: any) => ({
      ...i,
      cantidad: toNumber(i.cantidad),
      producto: {
        ...i.producto,
        precioUnitario: toNumber(i.producto.precioUnitario),
        stockMinimo: toNumber(i.producto.stockMinimo),
      },
    }));

    return NextResponse.json({ inventario: inventarioFormateado });
  } catch (error) {
    console.error("Error fetching inventario:", error);
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
    const unidadId = getActiveUnidadId(user);

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = InventarioCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { productoId, cantidad, lote, fechaCaducidad, ubicacion, codigoUnico } = parsed.data;

    // Productos son globales
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto || !producto.activo) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const inventario = await prisma.inventario.create({
      data: {
        productoId,
        cantidad: new Decimal(cantidad),
        lote: lote || null,
        fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null,
        ubicacion: ubicacion || null,
        codigoUnico: codigoUnico || null,
        estado: "disponible",
        unidadId,
        tenantId: getActiveTenantId(user),
      },
      include: { producto: true },
    });

    return NextResponse.json({
      inventario: { ...inventario, cantidad: toNumber(inventario.cantidad) },
      message: "Inventario creado",
    });
  } catch (error) {
    console.error("Error creating inventario:", error);
    return NextResponse.json({ error: "Error al crear inventario" }, { status: 500 });
  }
}

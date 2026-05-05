import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";
import { MovimientoCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = { unidadId };
    if (tipo) {
      where.tipo = tipo;
    }

    const movimientos = await prisma.movimiento.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        producto: {
          select: { id: true, nombre: true, unidadMedida: true },
        },
        usuario: {
          select: { nombre: true },
        },
      },
    });

    const movimientosFormateados = movimientos.map((m: any) => ({
      ...m,
      cantidad: toNumber(m.cantidad),
    }));

    return NextResponse.json({ movimientos: movimientosFormateados });
  } catch (error) {
    console.error("Error fetching movimientos:", error);
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
    const userId = parseInt(user.id);

    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = MovimientoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { productoId, tipo, cantidad, lote, notas, inventarioId } = parsed.data;

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto || !producto.activo) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const movimiento = await prisma.movimiento.create({
      data: {
        productoId,
        tipo,
        cantidad: new Decimal(cantidad),
        usuarioId: userId,
        lote: lote || null,
        notas: notas || null,
        unidadId,
      },
      include: {
        producto: true,
        usuario: { select: { nombre: true } },
      },
    });

    if ((tipo === "consumo" || tipo === "merma") && inventarioId) {
      const inventario = await prisma.inventario.findUnique({
        where: { id: inventarioId },
      });

      if (inventario) {
        const nuevaCantidad = toNumber(inventario.cantidad) - cantidad;
        if (nuevaCantidad <= 0) {
          await prisma.inventario.update({
            where: { id: inventarioId },
            data: { cantidad: 0, estado: "consumido" },
          });
        } else {
          await prisma.inventario.update({
            where: { id: inventarioId },
            data: { cantidad: new Decimal(nuevaCantidad) },
          });
        }
      }
    }

    return NextResponse.json({
      movimiento: { ...movimiento, cantidad: toNumber(movimiento.cantidad) },
      message: "Movimiento registrado",
    });
  } catch (error) {
    console.error("Error creating movimiento:", error);
    return NextResponse.json({ error: "Error al registrar movimiento" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";
import { ProductoCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

// Productos son globales - compartidos entre todas las unidades
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: {
        categoria: { select: { id: true, nombre: true } },
        proveedor: { select: { id: true, nombre: true } },
      },
    });

    const productosFormateados = productos.map((p: any) => ({
      ...p,
      precioUnitario: toNumber(p.precioUnitario),
      stockMinimo: toNumber(p.stockMinimo),
    }));

    return NextResponse.json({ productos: productosFormateados });
  } catch (error) {
    console.error("Error fetching productos:", error);
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
    // Solo admin o superuser pueden crear productos
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ProductoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { nombre, fabricante, formato, categoriaId, proveedorId, unidadMedida, precioUnitario, stockMinimo } = parsed.data;

    const producto = await prisma.producto.create({
      data: {
        nombre,
        fabricante: fabricante || null,
        formato: formato || null,
        categoriaId,
        proveedorId: proveedorId || null,
        unidadMedida: unidadMedida || "kg",
        precioUnitario: new Decimal(precioUnitario),
        stockMinimo: new Decimal(stockMinimo),
        activo: true,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
        proveedor: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({
      producto: {
        ...producto,
        precioUnitario: toNumber(producto.precioUnitario),
        stockMinimo: toNumber(producto.stockMinimo),
      },
      message: "Producto creado",
    });
  } catch (error) {
    console.error("Error creating producto:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}

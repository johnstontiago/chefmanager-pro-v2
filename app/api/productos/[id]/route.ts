import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { toNumber } from "@/lib/utils";

import { getActiveTenantId } from "@/lib/get-active-tenant";

export const dynamic = "force-dynamic";

// Productos son globales - compartidos entre todas las unidades
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    
    const tenantId = getActiveTenantId(session.user as any);
    const producto = await prisma.producto.findFirst({
      where: { id: parseInt(id), tenantId },
      include: { categoria: true, proveedor: true },
    });

    if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json({ producto: { ...producto, precioUnitario: toNumber(producto.precioUnitario), stockMinimo: toNumber(producto.stockMinimo) } });
  } catch (error) {
    console.error("Error getting producto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden editar productos
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const { nombre, fabricante, formato, categoriaId, proveedorId, unidadMedida, precioUnitario, stockMinimo, activo, contenidoNeto, contenidoUnidad } = await request.json();

    const tenantId = getActiveTenantId(user);
    const existing = await prisma.producto.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const contenidoNetoNum =
      contenidoNeto !== undefined && contenidoNeto !== null && contenidoNeto !== ""
        ? parseFloat(String(contenidoNeto))
        : null;
    const contenidoUnidadValida = ["g", "ml", "un"].includes(contenidoUnidad)
      ? contenidoUnidad
      : null;

    const producto = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        fabricante: fabricante !== undefined ? (fabricante || null) : existing.fabricante,
        formato: formato !== undefined ? (formato || null) : existing.formato,
        categoriaId,
        proveedorId: proveedorId || null,
        unidadMedida,
        precioUnitario: new Decimal(precioUnitario),
        stockMinimo: new Decimal(stockMinimo),
        contenidoNeto:
          contenidoNeto !== undefined
            ? contenidoNetoNum && contenidoNetoNum > 0
              ? new Decimal(contenidoNetoNum)
              : null
            : existing.contenidoNeto,
        contenidoUnidad:
          contenidoNeto !== undefined
            ? contenidoNetoNum && contenidoNetoNum > 0
              ? contenidoUnidadValida
              : null
            : existing.contenidoUnidad,
        activo: activo !== undefined ? activo : existing.activo,
      },
    });

    return NextResponse.json({ producto: { ...producto, precioUnitario: toNumber(producto.precioUnitario), stockMinimo: toNumber(producto.stockMinimo) } });
  } catch (error) {
    console.error("Error updating producto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const user = session.user as any;
    // Solo admin o superuser pueden eliminar productos
    if (!["admin", "superuser"].includes(user.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const tenantId = getActiveTenantId(user);
    const existing = await prisma.producto.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Soft delete
    await prisma.producto.update({ where: { id: parseInt(id) }, data: { activo: false } });

    return NextResponse.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("Error deleting producto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

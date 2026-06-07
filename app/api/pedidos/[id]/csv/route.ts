import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  const { id } = await params;
  const pedidoId = parseInt(id);

  const whereClause: any = {
    id: pedidoId,
    tenantId: user.tenantId as number,
    estado: { in: ["recibido", "recibido_parcial"] },
  };
  if (user.rol !== "superuser" && user.unidadId) {
    whereClause.unidadId = user.unidadId;
  }

  const pedido = await prisma.pedido.findFirst({
    where: whereClause,
    include: {
      items: {
        include: {
          producto: { select: { nombre: true, qrcode: true } },
        },
      },
    },
  });

  if (!pedido) {
    return NextResponse.json({ error: "Pedido no encontrado o no recibido" }, { status: 404 });
  }

  const lineasRecibidas = pedido.items.filter(
    (item) => item.estadoLinea === "recibida" || item.estadoLinea === "parcial"
  );

  const encabezado = ["Nombre producto", "Fecha caducidad", "Lote", "qrcode", "Cantidad"];

  const filas = lineasRecibidas.map((item) => [
    item.producto.nombre,
    item.fechaCaducidad ? format(new Date(item.fechaCaducidad), "dd/MM/yyyy") : "",
    item.lote ?? "",
    item.producto.qrcode ?? "",
    toNumber(item.cantidadRecibida).toString(),
  ]);

  const escaparCampo = (valor: string): string => {
    if (valor.includes(";") || valor.includes('"') || valor.includes("\n")) {
      return `"${valor.replace(/"/g, '""')}"`;
    }
    return valor;
  };

  const csvLineas = [encabezado, ...filas].map((fila) =>
    fila.map(escaparCampo).join(";")
  );
  const csvTexto = "﻿" + csvLineas.join("\r\n");

  const fechaHoy = format(new Date(), "yyyy-MM-dd");
  const nombreArchivo = `pedido-${pedidoId}-${fechaHoy}.csv`;

  return new NextResponse(csvTexto, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}

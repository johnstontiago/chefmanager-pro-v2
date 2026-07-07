import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { getActiveTenantId, getActiveUnidadId } from "@/lib/get-active-tenant";
import { convertir } from "@/lib/stock/convertir";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Registra la recepción de una línea de pedido creando uno o más LoteInventario
// (el stock real del módulo nuevo). Soporta:
//   modo "normal"   → cantidad en la unidad de compra (× factor opcional)
//   modo "piezas"   → varias piezas de peso variable (kg c/u)
// y producto sustituto (productoId distinto al pedido).
//
// Además crea un Movimiento (entrada) para el historial y actualiza el estado
// de la línea del pedido. NO escribe en la tabla Inventario antigua.

interface Body {
  pedidoItemId: number;
  productoId: number;          // producto a ingresar (pedido o sustituto)
  cantidadPedida: number;      // para decidir recibida/parcial
  modo: "normal" | "piezas";
  cantidad?: number;           // modo normal
  factorConversion?: number;   // formato distinto (default 1)
  varianteNombre?: string;     // si se quiere guardar la variante
  piezas?: number[];           // modo piezas (kg)
  lote?: string | null;
  fechaCaducidad?: string | null;
  ubicacion?: string | null;
  codigoUnico?: string | null;
  esSustituto?: boolean;
  notaSustituto?: string;
  nuevoPrecio?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const user = session.user as any;
    const tenantId = getActiveTenantId(user);
    const unidadId = getActiveUnidadId(user);
    if (!unidadId) {
      return NextResponse.json({ error: "Sin unidad activa" }, { status: 400 });
    }

    const body = (await req.json()) as Body;
    const {
      pedidoItemId, productoId, cantidadPedida, modo,
      cantidad, factorConversion: factorConversionInput, varianteNombre,
      piezas, lote, fechaCaducidad, ubicacion, codigoUnico, esSustituto, notaSustituto,
      nuevoPrecio,
    } = body;

    if (!productoId || !pedidoItemId) {
      return NextResponse.json({ error: "Faltan productoId o pedidoItemId" }, { status: 400 });
    }

    // Tenant scoping: el producto debe pertenecer al tenant del usuario
    const producto = await prisma.producto.findFirst({
      where: { id: productoId, tenantId },
    });
    if (!producto || !producto.activo) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Tenant scoping: la línea de pedido debe pertenecer al tenant del usuario
    const pedidoItem = await prisma.pedidoItem.findFirst({
      where: { id: pedidoItemId, pedido: { tenantId } },
    });
    if (!pedidoItem) {
      return NextResponse.json({ error: "Línea de pedido no encontrada" }, { status: 404 });
    }

    const unidadDestino =
      producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida;
    const caducidad = fechaCaducidad ? new Date(fechaCaducidad) : null;

    // Por defecto, el factor es el "contenido por unidad de compra" ya
    // declarado en el producto (ej. 1 Un de "Caputo 25kg" = 25000 g). Un
    // factor explícito en la petición (formato distinto al habitual) lo
    // sobreescribe — un valor de 1 nunca es un factor real (equivale a "sin
    // conversión"), así que se trata igual que si no se hubiera enviado.
    const contenidoNeto = toNumber(producto.contenidoNeto as any);
    const factorConversion =
      factorConversionInput && factorConversionInput > 1
        ? factorConversionInput
        : contenidoNeto > 0
          ? contenidoNeto
          : 1;

    const resultado = await prisma.$transaction(async (tx) => {
      const lotesCreados: number[] = [];
      let cantidadBaseTotal = 0;

      if (modo === "piezas") {
        const lista = (piezas ?? []).filter((p) => p > 0);
        if (lista.length === 0) {
          throw new Error("Se requiere al menos una pieza con peso > 0");
        }
        let i = 0;
        for (const pesoKg of lista) {
          const gramos = pesoKg * 1000;
          cantidadBaseTotal += gramos;
          // Un código único por pieza (sufijo si hay varias)
          const codigoPieza = codigoUnico
            ? lista.length > 1
              ? `${codigoUnico}-${i + 1}`
              : codigoUnico
            : null;
          const l = await tx.loteInventario.create({
            data: {
              tenantId, productoId,
              cantidadInicial: gramos,
              cantidadActual: gramos,
              pesoRealKg: pesoKg,
              fechaCaducidad: caducidad,
              numeroLote: lote || null,
              codigoUnico: codigoPieza,
              ubicacion: ubicacion || null,
            },
          });
          lotesCreados.push(l.id);
          i++;
        }
      } else {
        // modo normal (con factor opcional para formato distinto)
        if (!cantidad || cantidad <= 0) {
          throw new Error("Cantidad debe ser > 0");
        }
        // Guardar la variante de proveedor si se pidió
        if (varianteNombre && factorConversion > 0) {
          const existe = await tx.varianteProveedor.findFirst({
            where: { tenantId, productoId, nombre: varianteNombre },
          });
          if (!existe) {
            await tx.varianteProveedor.create({
              data: { tenantId, productoId, nombre: varianteNombre, factorConversion },
            });
          }
        }
        cantidadBaseTotal = convertir(
          cantidad * factorConversion,
          producto.unidadMedida,
          unidadDestino
        );
        const l = await tx.loteInventario.create({
          data: {
            tenantId, productoId,
            cantidadInicial: cantidadBaseTotal,
            cantidadActual: cantidadBaseTotal,
            fechaCaducidad: caducidad,
            numeroLote: lote || null,
            codigoUnico: codigoUnico || null,
            ubicacion: ubicacion || null,
          },
        });
        lotesCreados.push(l.id);
      }

      // Actualizar precio del producto si llegó con precio nuevo
      if (nuevoPrecio && nuevoPrecio > 0) {
        await tx.producto.update({
          where: { id: productoId },
          data: { precioUnitario: new Decimal(nuevoPrecio) },
        });
      }

      // Movimiento de auditoría (entrada) para el historial
      const notas = esSustituto
        ? `Recepción (sustituto)${notaSustituto ? `: ${notaSustituto}` : ""} → ${producto.nombre}`
        : `Recepción → lote(s) inventario`;
      await tx.movimiento.create({
        data: {
          productoId, tenantId, unidadId,
          tipo: "entrada",
          cantidad: new Decimal(cantidadBaseTotal),
          usuarioId: Number(user.id),
          lote: lote || null,
          notas,
          pedidoItemId,
        },
      });

      // Actualizar estado de la línea del pedido (ya validada por tenant arriba)
      {
        // recibida si cubre lo pedido; en sustituto se marca recibida (línea resuelta)
        const recibidaEnUnidadPedido = esSustituto
          ? cantidadPedida
          : convertir(cantidadBaseTotal, unidadDestino, producto.unidadMedida);
        const estadoLinea =
          esSustituto || recibidaEnUnidadPedido >= cantidadPedida ? "recibida" : "parcial";
        await tx.pedidoItem.update({
          where: { id: pedidoItemId },
          data: {
            cantidadRecibida: new Decimal(recibidaEnUnidadPedido),
            estadoLinea,
            lote: lote || pedidoItem.lote,
            fechaCaducidad: caducidad ?? pedidoItem.fechaCaducidad,
          },
        });
      }

      return { lotesCreados, cantidadBaseTotal };
    });

    return NextResponse.json({
      ok: true,
      lotesCreados: resultado.lotesCreados,
      cantidadBase: resultado.cantidadBaseTotal,
      unidad: unidadDestino,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error interno";
    console.error("[POST /api/recepcion/registrar]", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

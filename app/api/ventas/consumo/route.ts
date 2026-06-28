import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { consumirFIFO } from '@/lib/stock/consumirFIFO'
import { consumirFIFOElaboracion } from '@/lib/stock/consumirFIFOElaboracion'
import { convertir } from '@/lib/stock/convertir'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: 'API key requerida' }, { status: 401 })
    }

    const integracion = await prisma.integracionTPV.findUnique({
      where: { apiKey },
    })

    if (!integracion || !integracion.activa) {
      return NextResponse.json({ error: 'API key inválida o inactiva' }, { status: 401 })
    }

    const tenantId = integracion.tenantId
    const body = await req.json()
    const { fichaId, cantidad } = body

    if (!fichaId || !cantidad) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: fichaId, cantidad' },
        { status: 400 }
      )
    }

    const fichaIdNum = parseInt(fichaId, 10)
    if (isNaN(fichaIdNum) || cantidad <= 0) {
      return NextResponse.json({ error: 'fichaId debe ser número y cantidad > 0' }, { status: 400 })
    }

    // Unificado: el stock se descuenta desde los ingredientes de la FICHA TÉCNICA.
    // Cada ingrediente apunta a un insumo, que puede ser un producto (inventario)
    // o una elaboración (preparación). Los insumos manuales no descuentan stock.
    const ficha = await prisma.fichaTecnica.findFirst({
      where: { id: fichaIdNum, tenantId },
      include: {
        ingredientes: {
          include: {
            insumo: {
              include: {
                producto: true,
                elaboracion: { select: { id: true, nombre: true, unidadBase: true } },
              },
            },
          },
        },
      },
    })

    if (!ficha) {
      return NextResponse.json({ error: 'Ficha técnica no encontrada' }, { status: 404 })
    }

    // Cantidad de la ficha es para todas sus porciones; repartimos por porción
    // y multiplicamos por las raciones vendidas.
    const porciones = ficha.porciones || 1
    const factor = cantidad / porciones

    const resultados = []

    for (const ing of ficha.ingredientes) {
      const insumo = ing.insumo

      if (insumo.elaboracionId && insumo.elaboracion) {
        const cantidadNecesaria = ing.cantidad * factor
        const resultado = await consumirFIFOElaboracion({
          tenantId,
          elaboracionId: insumo.elaboracionId,
          cantidadNecesaria,
          motivo: 'VENTA',
          referenciaId: `ficha:${fichaIdNum}`,
        })
        resultados.push({
          tipo: 'elaboracion',
          id: insumo.elaboracionId,
          nombre: insumo.elaboracion.nombre,
          ...resultado,
        })
      } else if (insumo.productoId && insumo.producto) {
        const producto = insumo.producto
        const unidadDestino =
          producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida
        const cantidadBase =
          producto.tipoPeso === 'VARIABLE'
            ? ing.cantidad * factor
            : convertir(ing.cantidad * factor, insumo.unidad, unidadDestino)

        const resultado = await consumirFIFO({
          tenantId,
          productoId: insumo.productoId,
          cantidadNecesaria: cantidadBase,
          motivo: 'VENTA',
          referenciaId: `ficha:${fichaIdNum}`,
        })
        resultados.push({
          tipo: 'producto',
          id: insumo.productoId,
          nombre: producto.nombre,
          ...resultado,
        })
      }
      // insumo manual (sin producto ni elaboración) → no descuenta stock
    }

    if (resultados.length === 0) {
      return NextResponse.json(
        { error: 'La ficha no tiene ingredientes que afecten al stock (productos o preparaciones)' },
        { status: 422 }
      )
    }

    const hayErrores = resultados.some((r) => !r.ok)
    const statusCode = hayErrores ? 207 : 200
    const respuesta = { ok: !hayErrores, fichaId: fichaIdNum, cantidad, resultados }

    await prisma.logLlamadaTPV.create({
      data: {
        tenantId,
        integracionId: integracion.id,
        fichaId: fichaIdNum,
        cantidadPlatos: cantidad,
        statusCode,
        ok: !hayErrores,
        payload: body as object,
        respuesta: respuesta as object,
        ipOrigen: req.headers.get('x-forwarded-for') ?? null,
        duracionMs: Date.now() - startTime,
      },
    })

    return NextResponse.json(respuesta, { status: statusCode })
  } catch (error) {
    console.error('[POST /api/ventas/consumo]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

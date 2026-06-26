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

    const ficha = await prisma.fichaTecnica.findFirst({
      where: { id: fichaIdNum, tenantId },
      include: {
        ingredientesPlatoStock: {
          include: {
            producto: true,
            elaboracion: true,
          },
        },
      },
    })

    if (!ficha) {
      return NextResponse.json({ error: 'Ficha técnica no encontrada' }, { status: 404 })
    }

    if (ficha.ingredientesPlatoStock.length === 0) {
      return NextResponse.json(
        { error: 'La ficha no tiene ingredientes de stock configurados' },
        { status: 422 }
      )
    }

    const resultados = []

    for (const ingrediente of ficha.ingredientesPlatoStock) {
      if (ingrediente.elaboracionId && ingrediente.elaboracion) {
        const resultado = await consumirFIFOElaboracion({
          tenantId,
          elaboracionId: ingrediente.elaboracionId,
          cantidadNecesaria: ingrediente.cantidad * cantidad,
          motivo: 'VENTA',
          referenciaId: `ficha:${fichaIdNum}`,
        })
        resultados.push({
          tipo: 'elaboracion',
          id: ingrediente.elaboracionId,
          nombre: ingrediente.elaboracion.nombre,
          ...resultado,
        })
      } else if (ingrediente.productoId && ingrediente.producto) {
        const producto = ingrediente.producto
        const unidadDestino =
          producto.unidadBase ?? producto.contenidoUnidad ?? producto.unidadMedida
        const cantidadBase =
          producto.tipoPeso === 'VARIABLE'
            ? ingrediente.cantidad * cantidad
            : convertir(ingrediente.cantidad * cantidad, ingrediente.unidad, unidadDestino)

        const resultado = await consumirFIFO({
          tenantId,
          productoId: ingrediente.productoId,
          cantidadNecesaria: cantidadBase,
          motivo: 'VENTA',
          referenciaId: `ficha:${fichaIdNum}`,
        })
        resultados.push({
          tipo: 'producto',
          id: ingrediente.productoId,
          nombre: producto.nombre,
          ...resultado,
        })
      }
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

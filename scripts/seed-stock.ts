/**
 * seed-stock.ts — Datos de prueba para el módulo de stock
 *
 * Prerrequisito: el seed.ts principal ya debe haber corrido (tenant, usuarios, unidades).
 * Ejecutar: npx tsx scripts/seed-stock.ts
 *
 * Crea:
 *  - Productos con tipoPeso y unidadBase
 *  - LoteInventario con stock real
 *  - Elaboracion "Pulled Pork" con ingrediente
 *  - LoteElaboracion de esa elaboración
 *  - FichaTecnica "Bocadillo Pulled Pork" con IngredientePlatoStock
 *  - IntegracionTPV con API key de prueba
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TENANT_ID = 1 // ajusta si tu tenant tiene otro ID

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  seed-stock — módulo de stock\n')

  // ── 0. Verificar que el tenant existe ───────────────────────────────────
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } })
  if (!tenant) {
    console.error(`❌  Tenant ${TENANT_ID} no existe. Ejecuta primero scripts/seed.ts`)
    process.exit(1)
  }
  console.log(`✅  Tenant: ${tenant.nombre} (id=${tenant.id})`)

  // ── 1. Categoría ─────────────────────────────────────────────────────────
  const catCarnes = await prisma.categoria.upsert({
    where: { tenantId_nombre: { tenantId: TENANT_ID, nombre: 'Carnes' } },
    update: {},
    create: { tenantId: TENANT_ID, nombre: 'Carnes' },
  })

  const catLacteos = await prisma.categoria.upsert({
    where: { tenantId_nombre: { tenantId: TENANT_ID, nombre: 'Lácteos' } },
    update: {},
    create: { tenantId: TENANT_ID, nombre: 'Lácteos' },
  })

  const catAceites = await prisma.categoria.upsert({
    where: { tenantId_nombre: { tenantId: TENANT_ID, nombre: 'Aceites y salsas' } },
    update: {},
    create: { tenantId: TENANT_ID, nombre: 'Aceites y salsas' },
  })
  console.log(`✅  Categorías creadas/verificadas`)

  // ── 2. Productos con tipoPeso y unidadBase ────────────────────────────────
  const paleta = await prisma.producto.upsert({
    where: { tenantId_qrcode: { tenantId: TENANT_ID, qrcode: 'TEST-PALETA-001' } },
    update: {
      tipoPeso: 'VARIABLE',
      unidadBase: 'g',
    },
    create: {
      tenantId: TENANT_ID,
      nombre: 'Paleta de cerdo ibérica',
      categoriaId: catCarnes.id,
      unidadMedida: 'kg',
      precioUnitario: 8.50,
      stockMinimo: 5000,   // 5 kg en gramos
      qrcode: 'TEST-PALETA-001',
      tipoPeso: 'VARIABLE',
      unidadBase: 'g',
    },
  })

  const mozzarella = await prisma.producto.upsert({
    where: { tenantId_qrcode: { tenantId: TENANT_ID, qrcode: 'TEST-MOZZA-001' } },
    update: {
      tipoPeso: 'FIJO',
      unidadBase: 'g',
    },
    create: {
      tenantId: TENANT_ID,
      nombre: 'Mozzarella fresca',
      categoriaId: catLacteos.id,
      unidadMedida: 'kg',
      precioUnitario: 12.00,
      stockMinimo: 2000,  // 2 kg en gramos
      qrcode: 'TEST-MOZZA-001',
      tipoPeso: 'FIJO',
      unidadBase: 'g',
    },
  })

  const aceite = await prisma.producto.upsert({
    where: { tenantId_qrcode: { tenantId: TENANT_ID, qrcode: 'TEST-ACEITE-001' } },
    update: {
      tipoPeso: 'FIJO',
      unidadBase: 'ml',
    },
    create: {
      tenantId: TENANT_ID,
      nombre: 'Aceite de oliva virgen extra',
      categoriaId: catAceites.id,
      unidadMedida: 'l',
      precioUnitario: 6.00,
      stockMinimo: 1000,  // 1 litro en ml
      qrcode: 'TEST-ACEITE-001',
      tipoPeso: 'FIJO',
      unidadBase: 'ml',
    },
  })

  console.log(`✅  Productos: ${paleta.nombre}, ${mozzarella.nombre}, ${aceite.nombre}`)

  // ── 3. LoteInventario — stock inicial ─────────────────────────────────────
  // Paleta — dos piezas de peso variable
  const lotePaleta1 = await prisma.loteInventario.create({
    data: {
      tenantId: TENANT_ID,
      productoId: paleta.id,
      cantidadInicial: 3450,  // 3.45 kg en gramos
      cantidadActual: 3450,
      pesoRealKg: 3.45,
      fechaCaducidad: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
      numeroLote: 'TEST-L001',
    },
  })

  const lotePaleta2 = await prisma.loteInventario.create({
    data: {
      tenantId: TENANT_ID,
      productoId: paleta.id,
      cantidadInicial: 4200,  // 4.2 kg
      cantidadActual: 4200,
      pesoRealKg: 4.20,
      fechaCaducidad: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      numeroLote: 'TEST-L002',
    },
  })

  // Mozzarella — 3 kg (peso fijo)
  const loteMozza = await prisma.loteInventario.create({
    data: {
      tenantId: TENANT_ID,
      productoId: mozzarella.id,
      cantidadInicial: 3000,  // 3 kg en gramos
      cantidadActual: 3000,
      fechaCaducidad: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      numeroLote: 'TEST-L003',
    },
  })

  // Aceite — 5 litros (peso fijo)
  const loteAceite = await prisma.loteInventario.create({
    data: {
      tenantId: TENANT_ID,
      productoId: aceite.id,
      cantidadInicial: 5000,  // 5 litros en ml
      cantidadActual: 5000,
      numeroLote: 'TEST-L004',
    },
  })

  console.log(`✅  Lotes inventario: paleta ×2, mozzarella 3kg, aceite 5L`)

  // ── 4. Elaboración: Pulled Pork ───────────────────────────────────────────
  const existeElaboracion = await prisma.elaboracion.findFirst({
    where: { tenantId: TENANT_ID, nombre: 'Pulled Pork' },
  })

  const elaboracion = existeElaboracion ?? await prisma.elaboracion.create({
    data: {
      tenantId: TENANT_ID,
      nombre: 'Pulled Pork',
      descripcion: 'Paleta de cerdo confitada a baja temperatura, deshuesada y desmechada',
      unidadBase: 'g',
      stockMinimo: 1500,  // alerta si quedan menos de 1.5 kg
      ingredientes: {
        create: [
          {
            tenantId: TENANT_ID,
            productoId: paleta.id,
            cantidad: 0.85,   // 0.85 g de paleta cruda por 1 g de pulled pork
            unidad: 'g',
          },
        ],
      },
    },
  })
  console.log(`✅  Elaboración: ${elaboracion.nombre} (id=${elaboracion.id})`)

  // ── 5. LoteElaboracion — producción de hoy ────────────────────────────────
  // Registramos 2 kg de pulled pork ya producido (consumió de los lotes de paleta)
  const cantProducida = 2000  // 2 kg en gramos

  const loteElab = await prisma.loteElaboracion.create({
    data: {
      tenantId: TENANT_ID,
      elaboracionId: elaboracion.id,
      cantidadInicial: cantProducida,
      cantidadActual: cantProducida,
      fechaCaducidad: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      notas: 'Batch de prueba — seed',
      insumos: {
        create: [
          // Consumió 1700 g de paleta (0.85 × 2000) repartidos entre los dos lotes
          { tenantId: TENANT_ID, loteInventarioId: lotePaleta1.id, cantidadUsada: 1700 },
        ],
      },
    },
  })

  // Actualizar stock de la paleta (simulamos el consumo)
  await prisma.loteInventario.update({
    where: { id: lotePaleta1.id },
    data: { cantidadActual: lotePaleta1.cantidadActual - 1700 },
  })

  // Registrar el consumo
  await prisma.consumoLote.create({
    data: {
      tenantId: TENANT_ID,
      loteId: lotePaleta1.id,
      cantidad: 1700,
      motivo: 'PRODUCCION',
      referenciaId: `elaboracion:${elaboracion.id}`,
    },
  })

  console.log(`✅  Lote elaboración: ${cantProducida / 1000} kg de Pulled Pork listo en stock`)

  // ── 6. FichaTecnica — Bocadillo Pulled Pork ───────────────────────────────
  const fichaExistente = await prisma.fichaTecnica.findFirst({
    where: { tenantId: TENANT_ID, nombre: 'Bocadillo Pulled Pork' },
  })

  const ficha = fichaExistente ?? await prisma.fichaTecnica.create({
    data: {
      tenantId: TENANT_ID,
      nombre: 'Bocadillo Pulled Pork',
      descripcion: 'Bocadillo con pulled pork y mozzarella',
      porciones: 1,
      tiempoMin: 10,
      costoTotal: 0,
      costoPorPorcion: 0,
    },
  })

  // IngredientePlatoStock — escandallo para el TPV
  const yaConEscandallo = await prisma.ingredientePlatoStock.findFirst({
    where: { tenantId: TENANT_ID, fichaId: ficha.id },
  })

  if (!yaConEscandallo) {
    await prisma.ingredientePlatoStock.createMany({
      data: [
        {
          tenantId: TENANT_ID,
          fichaId: ficha.id,
          elaboracionId: elaboracion.id,  // consume Pulled Pork
          cantidad: 200,                   // 200 g por ración
          unidad: 'g',
        },
        {
          tenantId: TENANT_ID,
          fichaId: ficha.id,
          productoId: mozzarella.id,       // consume mozzarella directa
          cantidad: 60,                    // 60 g por ración
          unidad: 'g',
        },
      ],
    })
  }

  console.log(`✅  Ficha técnica: "${ficha.nombre}" con escandallo TPV`)

  // ── 7. IntegracionTPV ─────────────────────────────────────────────────────
  const integracion = await prisma.integracionTPV.upsert({
    where: { tenantId: TENANT_ID },
    update: { activa: true },
    create: {
      tenantId: TENANT_ID,
      nombre: 'TPV de prueba',
      activa: true,
      // apiKey se genera automáticamente con @default(uuid())
    },
  })

  console.log(`\n✅  IntegracionTPV activa`)
  console.log(`    API Key: ${integracion.apiKey}`)

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────')
  console.log('🏁  Seed completado. Resumen de datos de prueba:')
  console.log('')
  console.log('  INVENTARIO:')
  console.log(`  • Paleta ibérica      ${(lotePaleta1.cantidadActual - 1700 + lotePaleta2.cantidadActual) / 1000} kg disponibles (2 lotes)`)
  console.log(`  • Mozzarella          ${loteMozza.cantidadActual / 1000} kg disponibles`)
  console.log(`  • Aceite de oliva     ${loteAceite.cantidadActual / 1000} L disponibles`)
  console.log('')
  console.log('  ELABORACIONES:')
  console.log(`  • Pulled Pork         ${cantProducida / 1000} kg en stock`)
  console.log('')
  console.log('  SIMULADOR TPV:')
  console.log(`  • Ficha: "${ficha.nombre}" (id=${ficha.id})`)
  console.log(`  • Cada ración descuenta: 200g Pulled Pork + 60g Mozzarella`)
  console.log('')
  console.log('  API KEY TPV:')
  console.log(`  ${integracion.apiKey}`)
  console.log('')
  console.log('  RUTA SIMULADOR:')
  console.log('  /configuracion/integracion-tpv/simulador')
  console.log('─────────────────────────────────────────────────────────\n')
}

main()
  .catch((e) => {
    console.error('❌  Error en seed-stock:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

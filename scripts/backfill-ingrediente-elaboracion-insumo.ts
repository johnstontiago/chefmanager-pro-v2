/**
 * backfill-ingrediente-elaboracion-insumo.ts
 *
 * Backfill de la migración 20260706120000_elaboracion_ingrediente_insumo.
 * Ejecutar una vez, DESPUÉS de aplicar esa migración, contra cada entorno
 * (dev/staging/producción):
 *
 *   npx tsx scripts/backfill-ingrediente-elaboracion-insumo.ts
 *
 * Por cada tenant:
 *  1. syncProductosAsInsumos — garantiza que todo producto usado como
 *     ingrediente de elaboración ya tiene su Insumo espejo.
 *  2. seedInsumosPorDefecto — crea el insumo manual "Agua" si no existe.
 * Luego, una única consulta rellena `insumo_id` en las filas de
 * `ingredientes_elaboracion` que aún solo tienen `producto_id` (filas
 * creadas antes de esta migración).
 */

import { PrismaClient } from '@prisma/client'
import { syncProductosAsInsumos } from '../lib/fichas/costing'
import { seedInsumosPorDefecto } from '../lib/tenants/seedInsumosPorDefecto'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } })
  console.log(`Procesando ${tenants.length} tenant(s)...`)

  for (const tenant of tenants) {
    await syncProductosAsInsumos(tenant.id)
    await seedInsumosPorDefecto(tenant.id)
    console.log(`  ✓ ${tenant.nombre} (id=${tenant.id})`)
  }

  const actualizadas = await prisma.$executeRaw`
    UPDATE ingredientes_elaboracion ie
    SET insumo_id = i.id
    FROM insumos i
    WHERE i.tenant_id = ie.tenant_id
      AND i.producto_id = ie.producto_id
      AND ie.insumo_id IS NULL
      AND ie.producto_id IS NOT NULL
  `

  const pendientes = await prisma.ingredienteElaboracion.count({
    where: { insumoId: null },
  })

  console.log(`\nFilas de ingredientes_elaboracion actualizadas: ${actualizadas}`)
  if (pendientes > 0) {
    console.warn(
      `⚠️  ${pendientes} fila(s) siguen sin insumo_id (producto inactivo o dato inconsistente). Revisar manualmente.`
    )
  } else {
    console.log('✓ Todas las filas tienen insumo_id.')
  }
}

main()
  .catch((e) => {
    console.error('❌  Error en backfill:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

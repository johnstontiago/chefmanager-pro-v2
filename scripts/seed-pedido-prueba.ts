/**
 * seed-pedido-prueba.ts — Crea un pedido en estado "enviado" para probar la recepción.
 * Ejecutar: npx tsx scripts/seed-pedido-prueba.ts
 */
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();
const TENANT_ID = 1;

async function main() {
  console.log("\n🧾  Creando pedido de prueba...\n");

  const unidad = await prisma.unidad.findFirst({ where: { tenantId: TENANT_ID } });
  const usuario = await prisma.usuario.findFirst({ where: { tenantId: TENANT_ID } });
  if (!unidad || !usuario) {
    console.error("❌  Falta unidad o usuario. Ejecuta antes scripts/seed.ts");
    process.exit(1);
  }

  // Coge 3 productos del catálogo
  const productos = await prisma.producto.findMany({
    where: { tenantId: TENANT_ID, activo: true },
    take: 3,
    orderBy: { nombre: "asc" },
  });
  if (productos.length === 0) {
    console.error("❌  No hay productos. Ejecuta antes scripts/seed.ts");
    process.exit(1);
  }

  const items = productos.map((p) => ({
    productoId: p.id,
    cantidad: new Decimal(5),
    precioUnitario: p.precioUnitario,
    estadoLinea: "pendiente",
  }));

  const total = productos.reduce((s, p) => s + Number(p.precioUnitario) * 5, 0);

  const pedido = await prisma.pedido.create({
    data: {
      tenantId: TENANT_ID,
      unidadId: unidad.id,
      usuarioId: usuario.id,
      proveedorId: productos[0].proveedorId ?? undefined,
      estado: "enviado",
      total: new Decimal(total),
      notas: "Pedido de prueba para recepción",
      items: { create: items },
    },
    include: { items: { include: { producto: true } } },
  });

  console.log(`✅  Pedido #${pedido.id} creado (estado: enviado)`);
  console.log(`    Unidad: ${unidad.nombre}`);
  console.log(`    Líneas:`);
  for (const it of pedido.items) {
    console.log(`      • ${it.producto.nombre} — 5 ${it.producto.unidadMedida}`);
  }
  console.log(`\n  Ve a /recepcion → pestaña Pendientes → "Recibir Mercancía"\n`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

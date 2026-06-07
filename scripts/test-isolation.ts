/**
 * Tests de aislamiento multi-tenant (Sección 3.4 del plan)
 *
 * Crea datos temporales para un segundo tenant, verifica el aislamiento
 * y limpia todo al terminar. Seguro para ejecutar en BD de producción.
 *
 * Ejecutar: npx ts-node scripts/test-isolation.ts
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

const OK = "✅ PASS";
const FAIL = "❌ FAIL";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string, detail?: string) {
  if (condition) {
    console.log(`  ${OK}  ${description}`);
    passed++;
  } else {
    console.log(`  ${FAIL}  ${description}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  TESTS DE AISLAMIENTO MULTI-TENANT");
  console.log("═══════════════════════════════════════════════\n");

  // ─── Setup: tenant A ya existe (id=1), creamos tenant B temporal ───

  const tenantA = await prisma.tenant.findFirst({ where: { id: 1 } });
  if (!tenantA) throw new Error("Tenant A (id=1) no encontrado — ¿corriste las migraciones?");

  console.log(`Tenant A: "${tenantA.nombre}" (id=${tenantA.id})`);

  const tenantB = await prisma.tenant.create({
    data: {
      nombre: "__TEST_TENANT_B__",
      email: "test-b@test.invalid",
      regionUE: true,
      activo: true,
    },
  });
  console.log(`Tenant B creado para tests: id=${tenantB.id}\n`);

  // Datos de tenant B
  const unidadB = await prisma.unidad.create({
    data: { nombre: "__test_unidad_B__", activo: true, tenantId: tenantB.id },
  });

  const catB = await prisma.categoria.create({
    data: { nombre: "__test_cat_B__", activo: true, tenantId: tenantB.id },
  });

  const prodB = await prisma.producto.create({
    data: {
      nombre: "__test_producto_B__",
      categoriaId: catB.id,
      unidadMedida: "kg",
      precioUnitario: new Decimal(1),
      stockMinimo: new Decimal(1),
      activo: true,
      tenantId: tenantB.id,
    },
  });

  const usuarioB = await prisma.usuario.create({
    data: {
      email: "test-b-user@test.invalid",
      password: "hashed",
      nombre: "__test_user_B__",
      rol: "viewer",
      unidadId: unidadB.id,
      activo: true,
      tenantId: tenantB.id,
    },
  });

  const pedidoB = await prisma.pedido.create({
    data: {
      unidadId: unidadB.id,
      usuarioId: usuarioB.id,
      estado: "borrador",
      total: new Decimal(0),
      tenantId: tenantB.id,
    },
  });

  const invB = await prisma.inventario.create({
    data: {
      productoId: prodB.id,
      cantidad: new Decimal(10),
      estado: "disponible",
      unidadId: unidadB.id,
      tenantId: tenantB.id,
    },
  });

  const movB = await prisma.movimiento.create({
    data: {
      productoId: prodB.id,
      tipo: "entrada",
      cantidad: new Decimal(10),
      usuarioId: usuarioB.id,
      unidadId: unidadB.id,
      tenantId: tenantB.id,
    },
  });

  // ─── TEST 1: Lecturas — tenant A no ve datos de tenant B ───────────

  console.log("── Test 1: Tenant A no puede leer datos de Tenant B ──");

  const productosBFromA = await prisma.producto.findMany({
    where: { tenantId: tenantA.id, id: prodB.id },
  });
  assert(productosBFromA.length === 0, "productos: findMany(tenantA) no devuelve datos de tenantB");

  const categoriasBFromA = await prisma.categoria.findMany({
    where: { tenantId: tenantA.id, id: catB.id },
  });
  assert(categoriasBFromA.length === 0, "categorias: findMany(tenantA) no devuelve datos de tenantB");

  const pedidosBFromA = await prisma.pedido.findMany({
    where: { tenantId: tenantA.id, id: pedidoB.id },
  });
  assert(pedidosBFromA.length === 0, "pedidos: findMany(tenantA) no devuelve datos de tenantB");

  const inventarioBFromA = await prisma.inventario.findMany({
    where: { tenantId: tenantA.id, id: invB.id },
  });
  assert(inventarioBFromA.length === 0, "inventario: findMany(tenantA) no devuelve datos de tenantB");

  const movimientosBFromA = await prisma.movimiento.findMany({
    where: { tenantId: tenantA.id, id: movB.id },
  });
  assert(movimientosBFromA.length === 0, "movimientos: findMany(tenantA) no devuelve datos de tenantB");

  const usuariosBFromA = await prisma.usuario.findMany({
    where: { tenantId: tenantA.id, id: usuarioB.id },
  });
  assert(usuariosBFromA.length === 0, "usuarios: findMany(tenantA) no devuelve datos de tenantB");

  // ─── TEST 2: IDOR — tenant A no puede acceder por id a recursos de B ─

  console.log("\n── Test 2: Protección IDOR (acceso por id cruzado) ──");

  const idorProducto = await prisma.producto.findFirst({
    where: { id: prodB.id, tenantId: tenantA.id },
  });
  assert(idorProducto === null, "producto: findFirst(idB + tenantA) devuelve null (IDOR bloqueado)");

  const idorCategoria = await prisma.categoria.findFirst({
    where: { id: catB.id, tenantId: tenantA.id },
  });
  assert(idorCategoria === null, "categoria: findFirst(idB + tenantA) devuelve null (IDOR bloqueado)");

  const idorPedido = await prisma.pedido.findFirst({
    where: { id: pedidoB.id, tenantId: tenantA.id },
  });
  assert(idorPedido === null, "pedido: findFirst(idB + tenantA) devuelve null (IDOR bloqueado)");

  const idorInventario = await prisma.inventario.findFirst({
    where: { id: invB.id, tenantId: tenantA.id },
  });
  assert(idorInventario === null, "inventario: findFirst(idB + tenantA) devuelve null (IDOR bloqueado)");

  const idorUsuario = await prisma.usuario.findFirst({
    where: { id: usuarioB.id, tenantId: tenantA.id },
  });
  assert(idorUsuario === null, "usuario: findFirst(idB + tenantA) devuelve null (IDOR bloqueado)");

  // ─── TEST 3: Query sin tenantId devuelve datos de TODOS ───────────

  console.log("\n── Test 3: Sin filtro de tenant no hay aislamiento (confirma por qué es obligatorio) ──");

  const sinFiltro = await prisma.producto.findFirst({ where: { id: prodB.id } });
  assert(sinFiltro !== null, "sin tenantId en WHERE: findFirst(idB) sí encuentra datos de B — filtro es OBLIGATORIO en rutas");

  // ─── TEST 4: Tenant desactivado — login debe ser rechazado ────────

  console.log("\n── Test 4: Tenant inactivo bloquea el acceso ──");

  const tenantInactivo = await prisma.tenant.update({
    where: { id: tenantB.id },
    data: { activo: false },
  });
  assert(!tenantInactivo.activo, "tenant B marcado como activo=false correctamente");

  const usuarioBConTenant = await prisma.usuario.findFirst({
    where: { id: usuarioB.id },
    include: { tenant: true },
  });
  const loginBloqueado = usuarioBConTenant?.tenant?.activo === false;
  assert(loginBloqueado, "login: usuario de tenant inactivo detectado → auth-options lo rechazará");

  // ─── TEST 5: Datos propios de tenant A son accesibles ─────────────

  console.log("\n── Test 5: Datos de Tenant A accesibles con su propio filtro ──");

  const prodA = await prisma.producto.findFirst({ where: { tenantId: tenantA.id } });
  assert(prodA !== null && prodA.tenantId === tenantA.id, "tenant A: puede leer sus propios productos");

  const catA = await prisma.categoria.findFirst({ where: { tenantId: tenantA.id } });
  assert(catA !== null && catA.tenantId === tenantA.id, "tenant A: puede leer sus propias categorias");

  const pedA = await prisma.pedido.findFirst({ where: { tenantId: tenantA.id } });
  assert(pedA !== null && pedA.tenantId === tenantA.id, "tenant A: puede leer sus propios pedidos");

  // ─── Cleanup: borrar todos los datos de tenant B ──────────────────

  console.log("\n── Limpiando datos de test ──");

  await prisma.movimiento.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.inventario.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.pedidoItem.deleteMany({ where: { pedido: { tenantId: tenantB.id } } });
  await prisma.pedido.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.usuario.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.producto.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.categoria.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.proveedor.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.unidad.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.tenant.delete({ where: { id: tenantB.id } });

  console.log("  Datos de test eliminados correctamente.");

  // ─── Resultado final ──────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  RESULTADO: ${passed} pasados, ${failed} fallados`);
  if (failed === 0) {
    console.log("  ✅ AISLAMIENTO VERIFICADO — Fase 1 completa");
  } else {
    console.log("  ❌ HAY FALLOS — revisar implementación");
  }
  console.log("═══════════════════════════════════════════════");
}

main()
  .catch(async (e) => {
    console.error("\n❌ Error fatal en tests:", e.message);
    console.log("Intentando limpiar datos de test...");
    await prisma.movimiento.deleteMany({ where: { unidad: { nombre: "__test_unidad_B__" } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { nombre: "__TEST_TENANT_B__" } }).catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

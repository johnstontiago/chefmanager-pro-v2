-- Migración 3: convertir @unique globales en @@unique compuestos por tenant
-- Categorias: nombre único por tenant (antes era global)
-- Productos: qrcode único por tenant (antes era global, ahora sin valores)
-- Inventario: codigoUnico único por tenant (antes era global)

-- Categorias: eliminar índice global, crear compuesto
DROP INDEX "categorias_nombre_key";
CREATE UNIQUE INDEX "categorias_tenant_id_nombre_key" ON "categorias"("tenant_id", "nombre");

-- Productos: eliminar índice global qrcode, crear compuesto (todos los qrcodes son NULL actualmente)
DROP INDEX IF EXISTS "productos_qrcode_key";
CREATE UNIQUE INDEX "productos_tenant_id_qrcode_key" ON "productos"("tenant_id", "qrcode");

-- Inventario: eliminar índice global codigoUnico, crear compuesto
DROP INDEX "inventario_codigo_unico_key";
CREATE UNIQUE INDEX "inventario_tenant_id_codigo_unico_key" ON "inventario"("tenant_id", "codigo_unico");

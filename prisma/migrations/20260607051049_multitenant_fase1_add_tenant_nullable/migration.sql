-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "inventario" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "tenant_id" INTEGER;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tenant_id" INTEGER;

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cif" TEXT,
    "email" TEXT NOT NULL,
    "region_ue" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cif_key" ON "tenants"("cif");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

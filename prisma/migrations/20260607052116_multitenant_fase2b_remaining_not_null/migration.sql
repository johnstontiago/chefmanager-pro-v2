/*
  Warnings:

  - Made the column `tenant_id` on table `categorias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `inventario` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `movimientos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `pedidos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `productos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `proveedores` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "categorias" DROP CONSTRAINT "categorias_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "inventario" DROP CONSTRAINT "inventario_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "movimientos" DROP CONSTRAINT "movimientos_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "productos" DROP CONSTRAINT "productos_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "proveedores" DROP CONSTRAINT "proveedores_tenant_id_fkey";

-- AlterTable
ALTER TABLE "categorias" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "inventario" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "movimientos" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pedidos" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "productos" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "proveedores" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

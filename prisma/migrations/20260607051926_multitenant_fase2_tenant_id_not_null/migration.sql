/*
  Warnings:

  - Made the column `tenant_id` on table `unidades` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenant_id` on table `usuarios` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "unidades" DROP CONSTRAINT "unidades_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_tenant_id_fkey";

-- AlterTable
ALTER TABLE "unidades" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

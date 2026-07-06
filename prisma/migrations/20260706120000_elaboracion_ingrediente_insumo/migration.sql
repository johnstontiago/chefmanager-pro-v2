-- Elaboraciones anidadas + insumos manuales (ej. agua) como ingrediente de elaboraciones.
-- Migración aditiva (regla del módulo stock): no se elimina ninguna columna.
-- IngredienteElaboracion pasa a poder referenciar un Insumo (producto, elaboración,
-- preparación o insumo manual) igual que ya hacen FichaIngrediente y PreparacionIngrediente.
-- producto_id se relaja a nullable para convivir con filas nuevas que solo usan insumo_id;
-- las filas existentes conservan su producto_id y se les rellena insumo_id via backfill.

ALTER TABLE "ingredientes_elaboracion" ALTER COLUMN "producto_id" DROP NOT NULL;

ALTER TABLE "ingredientes_elaboracion" ADD COLUMN "insumo_id" INTEGER;

ALTER TABLE "ingredientes_elaboracion"
  ADD CONSTRAINT "ingredientes_elaboracion_insumo_id_fkey"
  FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ingredientes_elaboracion_tenant_id_insumo_id_idx"
  ON "ingredientes_elaboracion"("tenant_id", "insumo_id");

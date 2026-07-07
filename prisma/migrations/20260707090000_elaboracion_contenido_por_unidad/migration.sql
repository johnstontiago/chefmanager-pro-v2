-- Contenido por unidad en Elaboraciones (ej. "1 unidad de Masa = 280 g").
-- Migración aditiva: columnas nullable, sin backfill — las elaboraciones
-- existentes sin este dato conservan el comportamiento actual.

ALTER TABLE "elaboraciones" ADD COLUMN "contenido_neto" DOUBLE PRECISION;
ALTER TABLE "elaboraciones" ADD COLUMN "contenido_unidad" TEXT;

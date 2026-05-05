-- Fase 2: campos para recepción de pedidos ítem por ítem

-- Producto: campo qrcode único
ALTER TABLE "productos" ADD COLUMN "qrcode" TEXT;
CREATE UNIQUE INDEX "productos_qrcode_key" ON "productos"("qrcode");

-- Pedido: soporte para pedido hijo (recepción parcial)
ALTER TABLE "pedidos" ADD COLUMN "parent_pedido_id" INTEGER;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_parent_pedido_id_fkey"
  FOREIGN KEY ("parent_pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PedidoItem: campos de recepción
ALTER TABLE "pedido_items" ADD COLUMN "cantidad_recibida" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "pedido_items" ADD COLUMN "lote" TEXT;
ALTER TABLE "pedido_items" ADD COLUMN "fecha_caducidad" TIMESTAMP(3);
ALTER TABLE "pedido_items" ADD COLUMN "fecha_recepcion" TIMESTAMP(3);
ALTER TABLE "pedido_items" ADD COLUMN "recibido_por_id" INTEGER;
ALTER TABLE "pedido_items" ADD COLUMN "estado_linea" TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_recibido_por_id_fkey"
  FOREIGN KEY ("recibido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Movimiento: referencia al ítem de pedido que originó la entrada
ALTER TABLE "movimientos" ADD COLUMN "pedido_item_id" INTEGER;
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_pedido_item_id_fkey"
  FOREIGN KEY ("pedido_item_id") REFERENCES "pedido_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

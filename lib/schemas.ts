import { z } from "zod";

export const PedidoItemSchema = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
});

export const PedidoCreateSchema = z.object({
  items: z.array(PedidoItemSchema).min(1, "Se requiere al menos un ítem"),
  notas: z.string().max(500).optional(),
  estado: z.enum(["borrador", "pendiente", "enviado", "recibido", "recibido_parcial", "cancelado"]).optional(),
  proveedorId: z.number().int().positive().optional().nullable(),
});

export const PedidoPatchSchema = z.object({
  estado: z.enum(["borrador", "pendiente", "enviado", "recibido", "recibido_parcial", "cancelado"]),
  notas: z.string().max(500).optional(),
});

export const ProductoCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  categoriaId: z.number().int().positive(),
  proveedorId: z.number().int().positive().optional().nullable(),
  unidadMedida: z.string().min(1).max(50).optional(),
  precioUnitario: z.number().nonnegative(),
  stockMinimo: z.number().nonnegative(),
});

export const ProductoUpdateSchema = ProductoCreateSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const MovimientoCreateSchema = z.object({
  productoId: z.number().int().positive(),
  tipo: z.enum(["entrada", "consumo", "merma", "ajuste", "transferencia"]),
  cantidad: z.number().positive(),
  lote: z.string().max(100).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
  inventarioId: z.number().int().positive().optional().nullable(),
  pedidoItemId: z.number().int().positive().optional().nullable(),
});

export const InventarioCreateSchema = z.object({
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  lote: z.string().max(100).optional().nullable(),
  fechaCaducidad: z.string().datetime({ offset: true }).optional().nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  ubicacion: z.string().max(200).optional().nullable(),
  codigoUnico: z.string().max(100).optional().nullable(),
});

export const UsuarioCreateSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(200),
  password: z.string().min(8).max(100),
  rol: z.enum(["superuser", "admin", "operador", "viewer"]).optional(),
  unidadId: z.number().int().positive().optional().nullable(),
  pinCode: z.string().regex(/^\d{4,6}$/).optional().nullable(),
});

export const UsuarioUpdateSchema = z.object({
  email: z.string().email().optional(),
  nombre: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(100).optional(),
  rol: z.enum(["superuser", "admin", "operador", "viewer"]).optional(),
  unidadId: z.number().int().positive().optional().nullable(),
  pinCode: z.string().regex(/^\d{4,6}$/).optional().nullable(),
  activo: z.boolean().optional(),
});

export const CategoriaCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
});

export const ProveedorCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  contacto: z.string().max(200).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

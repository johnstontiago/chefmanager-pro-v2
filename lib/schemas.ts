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
  estado: z.enum(["borrador", "pendiente", "enviado", "en_recepcion", "recibido", "recibido_parcial", "cancelado"]),
  notas: z.string().max(500).optional(),
});

export const ProductoCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  fabricante: z.string().max(200).optional().nullable(),
  formato: z.string().max(200).optional().nullable(),
  categoriaId: z.number().int().positive(),
  proveedorId: z.number().int().positive().optional().nullable(),
  unidadMedida: z.string().min(1).max(50).optional(),
  precioUnitario: z.number().nonnegative(),
  stockMinimo: z.number().nonnegative(),
  contenidoNeto: z.number().positive().optional().nullable(),
  contenidoUnidad: z.enum(["g", "ml", "un"]).optional().nullable(),
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

export const ProveedorUpdateSchema = ProveedorCreateSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const UnidadCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  direccion: z.string().max(500).optional().nullable(),
  responsable: z.string().max(200).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
});

export const UnidadUpdateSchema = UnidadCreateSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const CategoriaUpdateSchema = CategoriaCreateSchema.partial().extend({
  activo: z.boolean().optional(),
});

// ─── SUPERADMIN ───────────────────────────────────────────────────────────────

export const TenantCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  cif: z.string().max(50).optional().nullable(),
  email: z.string().email(),
  regionUE: z.boolean().optional(),
  plan: z.enum(["basico", "profesional", "enterprise"]).optional(),
  fechaVencimiento: z.string().nullable().optional(),
  notasInternas: z.string().max(1000).optional().nullable(),
});

export const TenantUpdateSchema = TenantCreateSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const OnboardingSchema = z.object({
  // Datos del negocio
  tenantNombre: z.string().min(1, "Nombre del negocio requerido").max(200),
  tenantCif: z.string().max(50).optional().nullable(),
  tenantEmail: z.string().email("Email inválido"),
  plan: z.enum(["basico", "profesional", "enterprise"]).optional(),
  fechaVencimiento: z.string().nullable().optional(),
  notasInternas: z.string().max(1000).optional().nullable(),
  // Unidad principal
  unidadNombre: z.string().min(1, "Nombre de la unidad requerido").max(200),
  unidadDireccion: z.string().max(500).optional().nullable(),
  unidadTelefono: z.string().max(50).optional().nullable(),
  // Usuario administrador del tenant
  adminEmail: z.string().email("Email del admin inválido"),
  adminNombre: z.string().min(1, "Nombre del admin requerido").max(200),
  adminPassword: z.string().min(8, "Mínimo 8 caracteres").max(100),
  adminPin: z.string().regex(/^\d{4,6}$/, "PIN debe ser 4-6 dígitos").optional().nullable(),
});

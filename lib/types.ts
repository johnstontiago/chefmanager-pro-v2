import { Decimal } from "@prisma/client/runtime/library";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  rol: string;
  unidadId: number | null;
  unidadNombre: string | null;
  pinVerified: boolean;
}

export interface Unidad {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  unidadId: number;
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  fabricante: string | null;
  formato: string | null;
  categoriaId: number;
  proveedorId: number | null;
  unidadMedida: string;
  precioUnitario: number | Decimal;
  stockMinimo: number | Decimal;
  activo: boolean;
  categoria?: Categoria;
  proveedor?: Proveedor;
}

export interface InventarioItem {
  id: number;
  productoId: number;
  cantidad: number | Decimal;
  lote: string | null;
  fechaCaducidad: Date | null;
  ubicacion: string | null;
  codigoUnico: string | null;
  estado: string;
  producto?: Producto;
}

export interface CartItem {
  productoId: number;
  producto: Producto;
  cantidad: number;
  precioUnitario: number;
}

export type RolUsuario = "superuser" | "admin" | "recepcion" | "cocina" | "viewer";

export const ROLES_PERMISOS: Record<RolUsuario, string[]> = {
  superuser: ["all"],
  admin: ["pedidos", "recepcion", "inventario", "consumo", "admin"],
  recepcion: ["pedidos", "recepcion", "inventario.read"],
  cocina: ["consumo", "inventario.read"],
  viewer: ["inventario.read"],
};

export function hasPermission(rol: string, modulo: string): boolean {
  const permisos = ROLES_PERMISOS[rol as RolUsuario] || [];
  if (permisos.includes("all")) return true;
  if (permisos.includes(modulo)) return true;
  if (permisos.includes(`${modulo}.read`)) return true;
  return false;
}

export function canWrite(rol: string, modulo: string): boolean {
  const permisos = ROLES_PERMISOS[rol as RolUsuario] || [];
  if (permisos.includes("all")) return true;
  if (permisos.includes(modulo)) return true;
  return false;
}

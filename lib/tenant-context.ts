import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export interface TenantContext {
  tenantId: number;
  userId: number;
  rol: string;
  unidadId: number | null;
}

/**
 * Extrae y valida el contexto de tenant desde el JWT firmado.
 * Devuelve null si no hay sesión válida o si el token no tiene tenantId.
 * Las rutas de API deben rechazar con 401/403 si devuelve null.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = session.user as any;
  if (!user.tenantId) return null;

  return {
    tenantId: Number(user.tenantId),
    userId: Number(user.id),
    rol: String(user.rol),
    unidadId: user.unidadId != null ? Number(user.unidadId) : null,
  };
}

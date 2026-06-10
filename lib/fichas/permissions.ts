import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getActiveTenantId } from "@/lib/get-active-tenant";

export { canEditFichas, canDeleteFichas } from "./roles";

export interface FichasContext {
  userId: number;
  rol: string;
  tenantId: number;
}

export async function getFichasContext(): Promise<FichasContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  return {
    userId: parseInt(user.id, 10),
    rol: user.rol || "viewer",
    tenantId: getActiveTenantId(user),
  };
}

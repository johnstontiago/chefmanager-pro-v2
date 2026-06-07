import { cookies } from "next/headers";

type SudoContext = {
  tenantId: number;
  unidadId: number | null;
  unidadNombre?: string;
};

function parseSudoCookie(): SudoContext | null {
  const raw = cookies().get("superadmin_sudo")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.tenantId === "number") {
      return {
        tenantId: parsed.tenantId,
        unidadId: parsed.unidadId ?? null,
        unidadNombre: parsed.unidadNombre,
      };
    }
  } catch {
    // Formato legacy: solo el tenantId como string
    const id = parseInt(raw, 10);
    if (!isNaN(id) && id > 0) return { tenantId: id, unidadId: null };
  }
  return null;
}

export function getActiveTenantId(user: any): number {
  if (user?.rol === "superuser") {
    const ctx = parseSudoCookie();
    if (ctx) return ctx.tenantId;
  }
  return user.tenantId;
}

export function getActiveUnidadId(user: any): number | null {
  if (user?.rol === "superuser") {
    const ctx = parseSudoCookie();
    if (ctx) return ctx.unidadId;
  }
  return user.unidadId ?? null;
}

export function getSudoCookie(): SudoContext | null {
  return parseSudoCookie();
}

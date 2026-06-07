import { cookies } from "next/headers";

export function getActiveTenantId(user: any): number {
  if (user?.rol === "superuser") {
    const cookieStore = cookies();
    const sudo = cookieStore.get("superadmin_sudo")?.value;
    if (sudo) {
      const id = parseInt(sudo, 10);
      if (!isNaN(id) && id > 0) return id;
    }
  }
  return user.tenantId;
}

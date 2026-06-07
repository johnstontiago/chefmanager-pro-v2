/**
 * Audit logger para eventos sensibles (RGPD).
 * Emite JSON estructurado a stdout para que Railway lo indexe.
 * En una fase futura se puede persistir en BD.
 */

type AuditAction =
  | "login_ok"
  | "login_fail"
  | "login_tenant_inactive"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "access_denied";

interface AuditPayload {
  action: AuditAction;
  tenantId?: number;
  userId?: number;
  resource?: string;
  resourceId?: number | string;
  ip?: string;
  detail?: string;
}

export function audit(payload: AuditPayload) {
  console.log(
    JSON.stringify({
      audit: true,
      ts: new Date().toISOString(),
      ...payload,
    })
  );
}

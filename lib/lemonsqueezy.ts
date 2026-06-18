// Integración con la License API de Lemon Squeezy.
// No requiere API key: las operaciones de licencia van firmadas con la propia clave.
// Docs: https://docs.lemonsqueezy.com/help/licensing/license-api

const LS_API = "https://api.lemonsqueezy.com/v1/licenses";

// IDs de ChefManager Pro en Lemon Squeezy (públicos, no son secretos).
// Se usan para rechazar licencias de otros productos/tiendas.
export const LS_STORE_ID = Number(process.env.LEMONSQUEEZY_STORE_ID ?? 410086);
export const LS_PRODUCT_ID = Number(process.env.LEMONSQUEEZY_PRODUCT_ID ?? 1152361);

export interface LicenseResult {
  ok: boolean;
  error?: string;
  instanceId?: string;
  status?: string; // inactive | active | expired | disabled
  expiresAt?: string | null;
}

// Activa una license key creando una "instancia" (consume una activación).
// instanceName identifica la cuenta (p. ej. el nombre del negocio).
export async function activateLicense(licenseKey: string, instanceName: string): Promise<LicenseResult> {
  let res: Response;
  try {
    res = await fetch(`${LS_API}/activate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ license_key: licenseKey, instance_name: instanceName }).toString(),
    });
  } catch {
    return { ok: false, error: "No se pudo contactar con el servicio de licencias. Inténtalo de nuevo." };
  }

  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: "Respuesta inválida del servicio de licencias." };

  if (!data.activated) {
    // La API devuelve un mensaje en 'error' (clave no encontrada, caducada, límite alcanzado…).
    return {
      ok: false,
      error: traducirError(data.error, data.license_key?.status),
      status: data.license_key?.status,
    };
  }

  // La licencia debe pertenecer a nuestro producto y tienda.
  const storeOk = String(data.meta?.store_id) === String(LS_STORE_ID);
  const productOk = String(data.meta?.product_id) === String(LS_PRODUCT_ID);
  if (!storeOk || !productOk) {
    return { ok: false, error: "Esta licencia no corresponde a ChefManager Pro." };
  }

  return {
    ok: true,
    instanceId: data.instance?.id != null ? String(data.instance.id) : undefined,
    status: data.license_key?.status,
    expiresAt: data.license_key?.expires_at ?? null,
  };
}

function traducirError(error: string | undefined, status: string | undefined): string {
  if (status === "expired") return "Esta licencia ha caducado.";
  if (status === "disabled") return "Esta licencia ha sido deshabilitada.";
  if (error && /activation limit/i.test(error)) return "Esta licencia ya se ha usado para crear una cuenta.";
  if (error && /not found/i.test(error)) return "No encontramos esa licencia. Revisa que la has copiado bien.";
  return error || "La licencia no es válida.";
}

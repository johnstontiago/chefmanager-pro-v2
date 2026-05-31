/**
 * Wrapper de fetch con cola offline para escrituras.
 *
 * - GET: pasa directo (sin cola).
 * - POST/PUT/PATCH/DELETE con red: se envía normal.
 * - POST/PUT/PATCH/DELETE sin red: se guarda en IndexedDB y se reintenta al reconectar.
 *
 * Uso: reemplazar `fetch(url, options)` por `apiFetch(url, options)`
 * únicamente en las llamadas de escritura.
 */

"use client";

import {
  enqueue,
  dequeue,
  getPending,
  markError,
  incrementRetries,
  countPending,
} from "@/lib/offline-queue";

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// ─── Evento personalizado para notificar al indicador visual ─────────────────

function dispatchQueueEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("queue-updated"));
  }
}

// ─── Fetch con cola ───────────────────────────────────────────────────────────

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const isWrite = WRITE_METHODS.includes(method);

  try {
    const response = await fetch(url, options);
    return response;
  } catch (err) {
    // Solo encolamos si es una escritura y el error es de red (no de servidor)
    if (!isWrite) throw err;

    const body =
      typeof options.body === "string"
        ? options.body
        : options.body instanceof FormData
        ? ""
        : JSON.stringify(options.body ?? null);

    const headers: Record<string, string> = {};
    if (options.headers) {
      new Headers(options.headers).forEach((v, k) => { headers[k] = v; });
    }

    const id = await enqueue({ url, method, body, headers });
    dispatchQueueEvent();
    console.warn(`[apiFetch] Sin red. Operación encolada (id: ${id})`);

    // Respuesta sintética 202: el componente puede detectar X-Queued: true
    return new Response(
      JSON.stringify({ queued: true, queueId: id, message: "Guardado offline, se enviará al reconectar." }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          "X-Queued": "true",
        },
      }
    );
  }
}

// ─── Procesador de cola ───────────────────────────────────────────────────────

/** Delay en ms con backoff exponencial: 1s, 2s, 4s, 8s… máx 30s */
function backoff(retries: number): number {
  return Math.min(1000 * 2 ** retries, 30_000);
}

let processingQueue = false;

export async function processQueue(): Promise<void> {
  if (processingQueue) return;
  processingQueue = true;
  dispatchQueueEvent(); // estado: "sincronizando"

  try {
    const pending = await getPending();
    if (pending.length === 0) return;

    for (const item of pending) {
      if (item.status === "error") continue; // error permanente, no reintentar

      // Espera con backoff exponencial según número de reintentos previos
      if (item.retries > 0) {
        await new Promise((r) => setTimeout(r, backoff(item.retries)));
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body || undefined,
        });

        if (response.ok) {
          await dequeue(item.id);
          dispatchQueueEvent();
        } else if (response.status >= 400 && response.status < 500) {
          // Error del servidor (400/422): no reintentar, marcar como error
          const text = await response.text().catch(() => "");
          await markError(item.id, `HTTP ${response.status}: ${text}`);
          dispatchQueueEvent();
        } else {
          // Error 5xx: reintentar más tarde
          await incrementRetries(item.id);
        }
      } catch {
        // Sigue sin red, se reintentará en el próximo evento online
        await incrementRetries(item.id);
      }
    }
  } finally {
    processingQueue = false;
    dispatchQueueEvent(); // actualiza el indicador al terminar
  }
}

/** Devuelve el número de operaciones pendientes en la cola. */
export async function getPendingCount(): Promise<number> {
  if (typeof window === "undefined") return 0;
  return countPending();
}

// ─── Listener de reconexión ───────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[apiFetch] Conexión restaurada. Procesando cola offline…");
    processQueue();
  });
}

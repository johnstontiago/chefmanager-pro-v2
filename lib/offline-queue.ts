/**
 * Cola persistente de escrituras en IndexedDB.
 * Sobrevive a cierres de pestaña y recargas.
 * Solo se usa en el cliente (browser).
 */

const DB_NAME = "chefmanager-offline";
const DB_VERSION = 1;
const STORE = "write-queue";

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
  status: "pending" | "error";
  errorMessage?: string;
}

// ─── Apertura de BD ───────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

/** Agrega una petición fallida a la cola. Retorna el id asignado. */
export async function enqueue(
  entry: Pick<QueuedRequest, "url" | "method" | "body" | "headers">
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: QueuedRequest = {
    ...entry,
    id,
    timestamp: Date.now(),
    retries: 0,
    status: "pending",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/** Devuelve todos los elementos pendientes ordenados por timestamp. */
export async function getPending(): Promise<QueuedRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("timestamp").getAll();
    req.onsuccess = () => resolve(req.result as QueuedRequest[]);
    req.onerror = () => reject(req.error);
  });
}

/** Elimina un elemento de la cola (tras confirmación 2xx del servidor). */
export async function dequeue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Marca un elemento como error permanente (respuesta 4xx del servidor). */
export async function markError(id: string, message: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as QueuedRequest;
      if (item) {
        item.status = "error";
        item.errorMessage = message;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Incrementa el contador de reintentos. */
export async function incrementRetries(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as QueuedRequest;
      if (item) {
        item.retries += 1;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Devuelve el número de elementos pendientes (para el indicador visual). */
export async function countPending(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

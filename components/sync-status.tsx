"use client";

/**
 * Indicador visual de estado de conexión y cola offline.
 * Se monta en el layout del dashboard y se mantiene siempre visible.
 */

import { useEffect, useState, useCallback } from "react";
import { processQueue, getPendingCount } from "@/lib/api-client";
import { Wifi, WifiOff, CloudUpload, CheckCircle, AlertCircle } from "lucide-react";

type SyncState = "online" | "offline" | "syncing" | "pending" | "error" | "saved";

export default function SyncStatus() {
  const [state, setState] = useState<SyncState>("online");
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);

    if (!navigator.onLine) {
      setState("offline");
    } else if (count > 0) {
      setState("pending");
    } else {
      setState("online");
    }
  }, []);

  useEffect(() => {
    refresh();

    // Al recuperar conexión: sincroniza y actualiza
    const handleOnline = async () => {
      setState("syncing");
      await processQueue();
      await refresh();
      // Muestra "Todo guardado" por 3 segundos
      const count = await getPendingCount();
      if (count === 0) {
        setState("saved");
        setTimeout(() => setState("online"), 3000);
      }
    };

    const handleOffline = () => setState("offline");
    const handleQueueUpdate = () => refresh();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("queue-updated", handleQueueUpdate);

    // Procesa cola al montar (por si quedaron pendientes de sesiones anteriores)
    if (navigator.onLine) {
      processQueue().then(refresh);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("queue-updated", handleQueueUpdate);
    };
  }, [refresh]);

  // No renderizar nada si está online y sin pendientes (estado limpio)
  if (state === "online") return null;

  const config: Record<SyncState, { icon: React.ReactNode; text: string; className: string }> = {
    online: {
      icon: <Wifi className="h-4 w-4" />,
      text: "Conectado",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    offline: {
      icon: <WifiOff className="h-4 w-4" />,
      text: "Sin conexión",
      className: "bg-red-100 text-red-800 border-red-200",
    },
    pending: {
      icon: <CloudUpload className="h-4 w-4" />,
      text: `${pendingCount} operación${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""}`,
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    syncing: {
      icon: <CloudUpload className="h-4 w-4 animate-pulse" />,
      text: "Sincronizando…",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    saved: {
      icon: <CheckCircle className="h-4 w-4" />,
      text: "Todo guardado",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      text: "Error al sincronizar",
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const { icon, text, className } = config[state];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md transition-all duration-300 ${className}`}
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

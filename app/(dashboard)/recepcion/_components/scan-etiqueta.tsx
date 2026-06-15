"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanResult {
  lote: string | null;
  fechaCaducidad: string | null;
}

interface ScanEtiquetaProps {
  onScan: (result: ScanResult) => void;
  disabled?: boolean;
}

export default function ScanEtiqueta({ onScan, disabled }: ScanEtiquetaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"idle" | "scanning" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string>("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpiar input para permitir re-escanear el mismo archivo
    e.target.value = "";

    setEstado("scanning");
    setMensaje("");

    try {
      const base64 = await prepararImagen(file);

      const res = await fetch("/api/recepcion/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEstado("error");
        setMensaje(data.error ?? "Error al escanear");
        return;
      }

      const tieneAlgo = data.lote || data.fechaCaducidad;

      if (!tieneAlgo) {
        setEstado("error");
        setMensaje("No se detectaron datos. Comprueba la foto e inténtalo de nuevo.");
        return;
      }

      onScan({ lote: data.lote, fechaCaducidad: data.fechaCaducidad });
      setEstado("ok");
      setMensaje(
        [
          data.lote ? `Lote: ${data.lote}` : null,
          data.fechaCaducidad ? `Cad: ${data.fechaCaducidad}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    } catch {
      setEstado("error");
      setMensaje("No se pudo procesar la imagen.");
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
        disabled={disabled || estado === "scanning"}
        onClick={() => {
          setEstado("idle");
          setMensaje("");
          inputRef.current?.click();
        }}
      >
        {estado === "scanning" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Camera className="w-4 h-4 mr-2" />
        )}
        {estado === "scanning" ? "Analizando etiqueta..." : "Escanear etiqueta"}
      </Button>

      {estado === "ok" && (
        <p className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          <CheckCircle className="w-3 h-3 shrink-0" />
          {mensaje} — revisa y corrige si es necesario
        </p>
      )}

      {estado === "error" && (
        <p className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {mensaje}
        </p>
      )}
    </div>
  );
}

// Redimensiona la imagen a máx 1400px y la convierte a JPEG de alta calidad.
// Reduce el payload sin perder detalle legible en etiquetas.
function prepararImagen(file: File): Promise<string> {
  const MAX_PX = 1400;
  const QUALITY = 0.92;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(1, MAX_PX / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas no disponible")); return; }

        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

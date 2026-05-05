"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QrScannerProps {
  onScan: (value: string) => void;
  onClose?: () => void;
}

type ErrorKind = "NotAllowedError" | "NotFoundError" | "NotReadableError" | "SecurityError" | "unknown";

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  NotAllowedError: "Permisos de cámara denegados. Ve a los ajustes del navegador y activa el acceso a la cámara para este sitio.",
  NotFoundError: "No se detectó ninguna cámara en este dispositivo.",
  NotReadableError: "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.",
  SecurityError: "La cámara requiere HTTPS. Asegúrate de acceder por https://",
  unknown: "No se pudo acceder a la cámara.",
};

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [error, setError] = useState<ErrorKind | null>(null);
  const [active, setActive] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const stopCamera = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();
      setActive(true);
      scanLoop();
    } catch (e: any) {
      const kind: ErrorKind =
        e?.name === "NotAllowedError" ? "NotAllowedError" :
        e?.name === "NotFoundError" ? "NotFoundError" :
        e?.name === "NotReadableError" ? "NotReadableError" :
        e?.name === "SecurityError" ? "SecurityError" : "unknown";
      setError(kind);
    }
  };

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        try {
          // @ts-ignore — BarcodeDetector es experimental pero disponible en Chrome/Android
          if ("BarcodeDetector" in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            detector.detect(canvas).then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                stopCamera();
                onScan(barcodes[0].rawValue);
                return;
              }
            });
          }
        } catch {
          // BarcodeDetector no disponible, el usuario puede ingresar manualmente
        }
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue("");
    }
  };

  return (
    <div className="space-y-4">
      {!manualMode ? (
        <div className="space-y-3">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-square max-w-xs mx-auto">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            {!active && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                Iniciando cámara...
              </div>
            )}
            {active && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 border-2 border-white rounded-lg opacity-60" />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <CameraOff className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{ERROR_MESSAGES[error]}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {error && (
              <Button size="sm" variant="outline" onClick={startCamera} className="flex-1">
                <Camera className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => { stopCamera(); setManualMode(true); }}
              className="flex-1"
            >
              <Keyboard className="w-4 h-4 mr-1" />
              Ingresar código
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="manual-qr">Código QR / Código de producto</Label>
            <Input
              id="manual-qr"
              placeholder="Escanea o escribe el código..."
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              autoFocus
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleManualSubmit} className="flex-1" disabled={!manualValue.trim()}>
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setManualMode(false); startCamera(); }}
            >
              <Camera className="w-4 h-4 mr-1" />
              Usar cámara
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

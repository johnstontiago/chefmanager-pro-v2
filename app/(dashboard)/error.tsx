"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500" />
      <h2 className="text-lg font-semibold text-foreground">Ocurrió un error inesperado</h2>
      <p className="text-muted-foreground text-sm max-w-sm">{error.message || "Intenta de nuevo o recarga la página."}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}

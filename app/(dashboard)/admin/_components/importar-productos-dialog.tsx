"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

const PLANTILLA_HEADERS = "nombre;categoria;proveedor;fabricante;formato;unidad_medida;precio_unitario;stock_minimo;contenido_neto;contenido_unidad";
const PLANTILLA_EJEMPLO = "Tomate frito;Salsas;Distribuciones García;Solís;Lata 3kg;kg;4,50;5;3000;g";

interface Informe {
  total: number;
  creados: number;
  categoriasCreadas: number;
  proveedoresCreados: number;
  errores: { fila: number; motivo: string }[];
}

interface Props {
  onImported: () => void;
}

export default function ImportarProductosDialog({ onImported }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [informe, setInforme] = useState<Informe | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setInforme(null);
  };

  const descargarPlantilla = () => {
    // BOM (﻿) para que Excel abra el CSV en UTF-8 y respete los acentos.
    const csv = "﻿" + PLANTILLA_HEADERS + "\n" + PLANTILLA_EJEMPLO + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInforme(null);
    setFileName(file.name);
    // Sin delimiter: papaparse autodetecta ',' o ';' (Excel europeo usa ';').
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data as Record<string, unknown>[]).filter((r) =>
          Object.values(r).some((v) => v != null && String(v).trim() !== "")
        );
        setRows(data);
        if (data.length === 0) {
          toast({ title: "El archivo no contiene filas con datos", variant: "destructive" });
        }
      },
      error: () => toast({ title: "No se pudo leer el archivo CSV", variant: "destructive" }),
    });
    e.target.value = "";
  };

  const importar = async () => {
    if (rows.length === 0) return;
    try {
      setImporting(true);
      const res = await apiFetch("/api/productos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al importar");
      setInforme(data as Informe);
      onImported();
      toast({ title: `${data.creados} producto(s) importado(s)` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error al importar", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Importar productos desde CSV
            </DialogTitle>
            <DialogDescription>
              Crea productos en lote. Los proveedores y categorías que no existan se crean automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!informe ? (
              <>
                <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground space-y-2">
                  <p>1. Descarga la plantilla y rellena tus productos (una fila por producto).</p>
                  <p>2. Lo único obligatorio es el <strong>nombre</strong>. Lo que falte (precio, stock, categoría) lo completas luego con <strong>Editar producto</strong>.</p>
                  <Button size="sm" variant="outline" onClick={descargarPlantilla}>
                    <Download className="w-4 h-4 mr-2" />
                    Descargar plantilla
                  </Button>
                </div>

                <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                <Button variant="outline" className="w-full justify-start" onClick={() => inputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{fileName || "Seleccionar archivo CSV"}</span>
                </Button>

                {rows.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                    <span className="flex items-center gap-1 text-blue-800">
                      <CheckCircle className="w-4 h-4" />
                      {rows.length} fila(s) detectada(s)
                    </span>
                    <Button size="sm" onClick={importar} disabled={importing} className="bg-blue-600 hover:bg-blue-700">
                      {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Importar
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <p className="flex items-center gap-1 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {informe.creados} de {informe.total} productos creados
                  </p>
                  <p className="text-xs mt-1">
                    {informe.categoriasCreadas} categoría(s) y {informe.proveedoresCreados} proveedor(es) nuevos.
                  </p>
                </div>

                {informe.errores.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 max-h-40 overflow-y-auto">
                    <p className="flex items-center gap-1 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      {informe.errores.length} fila(s) con error
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {informe.errores.slice(0, 50).map((e, idx) => (
                        <li key={idx}>Fila {e.fila}: {e.motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={reset}>
                  Importar otro archivo
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

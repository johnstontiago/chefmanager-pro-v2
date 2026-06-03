"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, RotateCcw, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { LabelConfig } from "@/lib/bluetooth-printer";
import { DEFAULT_LABEL_CONFIG } from "@/lib/bluetooth-printer";

// Escala de visualización: 338 dots reales → 200px pantalla
const SCALE = 200 / 338;
const PX = (dots: number) => Math.round(dots * SCALE);

export default function EtiquetaTab() {
  const { toast } = useToast();
  const [cfg, setCfg]       = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config-etiqueta");
      if (res.ok) {
        const { config } = await res.json();
        setCfg(config);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config-etiqueta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        toast({ title: "Configuración guardada" });
      } else {
        toast({ title: "Error al guardar", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setCfg(DEFAULT_LABEL_CONFIG);

  const set = (key: keyof LabelConfig, val: string | number) =>
    setCfg((c) => ({ ...c, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // Posiciones Y calculadas igual que buildCPCL
  const s  = cfg.espaciado;
  const y0 = 57;
  const lines = [
    { y: y0,         text: "Producto: Berenjena" },
    { y: y0 +   s,   text: `Lote: L394959421` },
    { y: y0 + 2*s,   text: `Cad. Emb.: 2026-06-12` },
    { y: y0 + 3*s,   text: "Fecha Apertura:" },
    { y: y0 + 4*s,   text: "Consumir en:" },
    { y: y0 + 5*s,   text: "Fecha Cad.:" },
    { y: y0 + 6*s,   text: "Mermas:" },
    { y: y0 + 7*s,   text: "Cod. Unico:" },
    { y: y0 + 7*s + 28, text: "INV-MXX-XXXX", small: true },
  ];
  const xTitulo = Math.max(0, Math.floor((338 - cfg.titulo.length * 11) / 2));
  const labelH  = PX(cfg.altoLabel);
  const qrSize  = PX(cfg.tamanoQR * 37); // estimado con quiet zone

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Formulario ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            Configuración de etiqueta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Título */}
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1"
              value={cfg.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </div>

          {/* Grid de números */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alto etiqueta (dots)" hint="53mm = 417" value={cfg.altoLabel}
              onChange={(v) => set("altoLabel", v)} min={300} max={600} />
            <Field label="Margen izquierdo (dots)" hint="recomendado 15" value={cfg.xMargen}
              onChange={(v) => set("xMargen", v)} min={0} max={50} />
            <Field label="Espaciado líneas (dots)" hint="recomendado 38" value={cfg.espaciado}
              onChange={(v) => set("espaciado", v)} min={20} max={80} />
            <Field label="Fuente CPCL (0-7)" hint="0=mini 4=normal 7=grande" value={cfg.fuente}
              onChange={(v) => set("fuente", v)} min={0} max={7} />
            <Field label="QR posición X (dots)" hint="máx ~220 para 43mm" value={cfg.xQR}
              onChange={(v) => set("xQR", v)} min={100} max={280} />
            <Field label="QR posición Y (dots)" hint="recomendado 280-320" value={cfg.yQR}
              onChange={(v) => set("yQR", v)} min={100} max={400} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Restablecer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Preview ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Vista previa</CardTitle>
          <p className="text-xs text-slate-500">
            Escala aproximada · 43mm × {Math.round(cfg.altoLabel / 200 * 25.4)}mm
          </p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div
            className="relative border-2 border-slate-300 bg-white overflow-hidden"
            style={{ width: 200, height: labelH }}
          >
            {/* Título */}
            <div
              className="absolute text-[7px] font-bold leading-none"
              style={{ left: PX(xTitulo), top: PX(12) }}
            >
              {cfg.titulo}
            </div>
            {/* Separador */}
            <div
              className="absolute bg-slate-800"
              style={{ left: PX(15), top: PX(43), width: PX(308), height: 1 }}
            />
            {/* Líneas de datos */}
            {lines.map((l, i) => (
              <div
                key={i}
                className={`absolute leading-none ${l.small ? "text-[5px]" : "text-[7px]"} text-slate-700`}
                style={{ left: PX(cfg.xMargen), top: PX(l.y) }}
              >
                {l.text}
              </div>
            ))}
            {/* Cuadro Mermas */}
            <div
              className="absolute border border-slate-700"
              style={{
                left:   PX(cfg.xMargen + 110),
                top:    PX(y0 + 6*s - 8),
                width:  PX(75),
                height: PX(36),
              }}
            />
            {/* QR placeholder */}
            <div
              className="absolute bg-slate-200 border border-slate-400 flex items-center justify-center"
              style={{
                left:   PX(cfg.xQR),
                top:    PX(cfg.yQR),
                width:  Math.min(qrSize, 200 - PX(cfg.xQR)),
                height: Math.min(qrSize, labelH - PX(cfg.yQR)),
              }}
            >
              <span className="text-[5px] text-slate-500 text-center leading-tight px-1">QR</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label, hint, value, onChange, min, max,
}: {
  label: string; hint: string; value: number;
  onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <p className="text-[10px] text-slate-400 mb-1">{hint}</p>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
    </div>
  );
}

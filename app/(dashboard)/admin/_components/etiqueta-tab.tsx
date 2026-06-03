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

// Escala de visualización: 394 dots reales (50mm) → 220px pantalla
const SCALE = 220 / 394;
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
  const s   = cfg.espaciado;
  const y0  = 57;
  const yMermas = y0 + 7 * s;

  const lines = [
    { y: y0,           text: "Berenjena" },
    { y: y0 +     s,   text: "Marca Ejemplo" },
    { y: y0 +   2*s,   text: "Lote: L394959421" },
    { y: y0 +   3*s,   text: "Cad. Emb.: 2026-06-12" },
    { y: y0 +   4*s,   text: "Fecha Apertura:" },
    { y: y0 +   5*s,   text: "Consumir en:" },
    { y: y0 +   6*s,   text: "Fecha Cad.:" },
    { y: yMermas,      text: "Mermas:" },
    { y: yMermas + s,  text: "Cod. Unico:" },
    { y: yMermas + s + 28, text: "INV-MXX-XXXX", small: true },
  ];

  // QR: U 7 → versión 7 (45 módulos × M 3 = 135 dots)
  const QR_DOTS = 135;
  const xTitulo = Math.max(0, Math.floor((394 - cfg.titulo.length * 11) / 2));
  const labelH  = PX(cfg.altoLabel);

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
            <Field label="Alto etiqueta (dots)" hint="60mm = 472" value={cfg.altoLabel}
              onChange={(v) => set("altoLabel", v)} min={400} max={600} />
            <Field label="Margen izquierdo (dots)" hint="recomendado 15" value={cfg.xMargen}
              onChange={(v) => set("xMargen", v)} min={0} max={50} />
            <Field label="Espaciado líneas (dots)" hint="recomendado 45" value={cfg.espaciado}
              onChange={(v) => set("espaciado", v)} min={20} max={80} />
            <Field label="Fuente CPCL (0-7)" hint="0=mini 4=normal 7=grande" value={cfg.fuente}
              onChange={(v) => set("fuente", v)} min={0} max={7} />
          </div>

          <p className="text-[10px] text-slate-400">
            El QR se posiciona automáticamente en la esquina inferior derecha.
          </p>

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
            Escala aproximada · 50mm × {Math.round(cfg.altoLabel / 200 * 25.4)}mm
          </p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div
            className="relative border-2 border-slate-300 bg-white overflow-hidden"
            style={{ width: 220, height: labelH }}
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
              style={{ left: PX(15), top: PX(43), width: PX(359), height: 1 }}
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
                top:    PX(yMermas - 8),
                width:  PX(75),
                height: PX(36),
              }}
            />
            {/* QR placeholder — esquina inferior derecha (x=261, y=altoLabel-123-10) */}
            <div
              className="absolute bg-slate-200 border border-slate-400 flex items-center justify-center"
              style={{
                left:   PX(261),
                top:    PX(cfg.altoLabel - QR_DOTS - 10),
                width:  Math.min(PX(QR_DOTS), 220 - PX(261)),
                height: Math.min(PX(QR_DOTS), labelH - PX(cfg.altoLabel - QR_DOTS - 10)),
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

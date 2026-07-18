"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, MapPin, UserCog, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";

type FormData = {
  tenantNombre: string;
  tenantCif: string;
  tenantEmail: string;
  plan: string;
  fechaVencimiento: string;
  notasInternas: string;
  unidadNombre: string;
  unidadDireccion: string;
  unidadTelefono: string;
  adminEmail: string;
  adminNombre: string;
  adminPassword: string;
  adminPin: string;
};

const EMPTY: FormData = {
  tenantNombre: "", tenantCif: "", tenantEmail: "", plan: "basico",
  fechaVencimiento: "", notasInternas: "",
  unidadNombre: "", unidadDireccion: "", unidadTelefono: "",
  adminEmail: "", adminNombre: "", adminPassword: "", adminPin: "",
};

export default function OnboardingForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ tenantId: number; tenantNombre: string } | null>(null);

  const set = (k: keyof FormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.tenantNombre.trim()) return "El nombre del negocio es requerido";
      if (!form.tenantEmail.trim()) return "El email del negocio es requerido";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.tenantEmail)) return "Email del negocio inválido";
    }
    if (s === 2) {
      if (!form.unidadNombre.trim()) return "El nombre de la unidad es requerido";
    }
    if (s === 3) {
      if (!form.adminEmail.trim()) return "El email del admin es requerido";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) return "Email del admin inválido";
      if (!form.adminNombre.trim()) return "El nombre del admin es requerido";
      if (form.adminPassword.length < 8) return "La contraseña debe tener mínimo 8 caracteres";
      if (form.adminPin && !/^\d{4,6}$/.test(form.adminPin)) return "El PIN debe ser 4-6 dígitos";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    const err = validateStep(3);
    if (err) { setErrorMsg(err); return; }
    setSaving(true);
    try {
      const payload = {
        tenantNombre: form.tenantNombre,
        tenantCif: form.tenantCif || null,
        tenantEmail: form.tenantEmail,
        plan: form.plan,
        fechaVencimiento: form.fechaVencimiento || null,
        notasInternas: form.notasInternas || null,
        unidadNombre: form.unidadNombre,
        unidadDireccion: form.unidadDireccion || null,
        unidadTelefono: form.unidadTelefono || null,
        adminEmail: form.adminEmail,
        adminNombre: form.adminNombre,
        adminPassword: form.adminPassword,
        adminPin: form.adminPin || null,
      };
      const res = await fetch("/api/superadmin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setDone({ tenantId: data.resultado.tenant.id, tenantNombre: data.resultado.tenant.nombre });
    } catch (e: any) {
      const msg = e.message || "Error al crear el negocio";
      setErrorMsg(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-10 pb-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">¡Negocio creado con éxito!</h2>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{done.tenantNombre}</span> ya está activo en el sistema.
          </p>
          <p className="text-sm text-muted-foreground">
            El administrador puede entrar con el email y contraseña que configuraste.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => router.push("/superadmin")}>
              Volver al panel
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => router.push(`/superadmin/tenants/${done.tenantId}`)}>
              Ver el negocio
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              step > s ? "bg-purple-600 text-white" : step === s ? "bg-purple-600 text-white ring-4 ring-purple-100" : "bg-secondary text-muted-foreground"
            }`}>
              {step > s ? "✓" : s}
            </div>
            <span className={`text-sm hidden sm:inline ${step === s ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {s === 1 ? "Negocio" : s === 2 ? "Local" : "Admin"}
            </span>
            {s < 3 && <div className={`flex-1 h-0.5 mx-2 ${step > s ? "bg-purple-600" : "bg-secondary"}`} />}
          </div>
        ))}
      </div>

      {/* Paso 1: Datos del negocio */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-purple-600" />
              Datos del negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nombre del negocio *</Label>
                <Input placeholder="Restaurante El Rincón" value={form.tenantNombre} onChange={(e) => set("tenantNombre", e.target.value)} />
              </div>
              <div>
                <Label>Email de contacto *</Label>
                <Input type="email" placeholder="contacto@negocio.com" value={form.tenantEmail} onChange={(e) => set("tenantEmail", e.target.value)} />
              </div>
              <div>
                <Label>CIF / NIF (opcional)</Label>
                <Input placeholder="B12345678" value={form.tenantCif} onChange={(e) => set("tenantCif", e.target.value)} />
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="profesional">Profesional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de vencimiento (opcional)</Label>
                <Input type="date" value={form.fechaVencimiento} onChange={(e) => set("fechaVencimiento", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notas internas (solo visibles para ti)</Label>
                <Textarea placeholder="Ej: cliente referido por Juan, pago por transferencia…" rows={2} value={form.notasInternas} onChange={(e) => set("notasInternas", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={goNext}>
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Local principal */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-purple-600" />
              Local / Unidad principal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nombre del local *</Label>
                <Input placeholder="Cocina Central, Restaurante Playa…" value={form.unidadNombre} onChange={(e) => set("unidadNombre", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Dirección (opcional)</Label>
                <Input placeholder="Calle Mayor 1, Madrid" value={form.unidadDireccion} onChange={(e) => set("unidadDireccion", e.target.value)} />
              </div>
              <div>
                <Label>Teléfono (opcional)</Label>
                <Input placeholder="+34 600 000 000" value={form.unidadTelefono} onChange={(e) => set("unidadTelefono", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={goNext}>
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: Administrador */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="w-5 h-5 text-purple-600" />
              Usuario administrador del cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta cuenta tendrá rol <strong>Admin</strong> y será el acceso principal del cliente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nombre completo *</Label>
                <Input placeholder="María García" value={form.adminNombre} onChange={(e) => set("adminNombre", e.target.value)} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" placeholder="chef@restaurante.com" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
              </div>
              <div>
                <Label>Contraseña *</Label>
                <Input type="password" placeholder="Mínimo 8 caracteres" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
              </div>
              <div>
                <Label>PIN de acceso (opcional, 4-6 dígitos)</Label>
                <Input
                  maxLength={6}
                  placeholder="1234"
                  value={form.adminPin}
                  onChange={(e) => set("adminPin", e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            {errorMsg && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={saving}>Atrás</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {saving ? "Creando..." : "Crear Negocio"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

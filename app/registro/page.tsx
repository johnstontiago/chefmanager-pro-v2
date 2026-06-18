"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { KeyRound, Building2, MapPin, UserCircle, Mail, Lock, Hash, Loader2, ChefHat, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    licenseKey: "",
    negocioNombre: "",
    localNombre: "",
    adminNombre: "",
    email: "",
    password: "",
    pin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo crear la cuenta.");
        setLoading(false);
        return;
      }

      // Cuenta creada → iniciar sesión automáticamente.
      const login = await signIn("credentials", {
        email: form.email.trim(),
        password: form.password,
        redirect: false,
      });
      if (login?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // La cuenta existe; que inicie sesión manualmente.
        router.push("/login");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Crea tu cuenta</h1>
          <p className="text-slate-500 text-sm mt-1">Introduce tu licencia y los datos de tu negocio</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <Field icon={KeyRound} label="Licencia">
            <Input
              required
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={form.licenseKey}
              onChange={(e) => set("licenseKey", e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field icon={Building2} label="Nombre del negocio">
            <Input required placeholder="Pizzería La Toscana" value={form.negocioNombre} onChange={(e) => set("negocioNombre", e.target.value)} />
          </Field>

          <Field icon={MapPin} label="Nombre de tu local">
            <Input required placeholder="Local Centro" value={form.localNombre} onChange={(e) => set("localNombre", e.target.value)} />
          </Field>

          <Field icon={UserCircle} label="Tu nombre">
            <Input required placeholder="Ana García" value={form.adminNombre} onChange={(e) => set("adminNombre", e.target.value)} />
          </Field>

          <Field icon={Mail} label="Email">
            <Input required type="email" placeholder="ana@negocio.com" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          </Field>

          <Field icon={Lock} label="Contraseña">
            <Input required type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
          </Field>

          <Field icon={Hash} label="PIN de acceso (4 dígitos)">
            <Input
              required
              inputMode="numeric"
              maxLength={4}
              placeholder="Ej. 1234"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="off"
            />
            <p className="text-xs text-slate-400 mt-1">Te lo pedirá cada vez que entres, como segunda verificación.</p>
          </Field>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {loading ? "Creando tu cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">Inicia sesión</Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿No tienes licencia? Consíguela en <span className="font-medium">chefmanager.pro</span>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1 text-slate-700">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        {label}
      </Label>
      {children}
    </div>
  );
}

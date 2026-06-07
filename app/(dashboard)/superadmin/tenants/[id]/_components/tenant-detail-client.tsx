"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, MapPin, Calendar, Loader2, Save,
  ShieldCheck, ShieldOff, UserCircle, Crown,
} from "lucide-react";

type Tenant = {
  id: number; nombre: string; cif: string | null; email: string;
  regionUE: boolean; activo: boolean; plan: string;
  fechaVencimiento: string | null; notasInternas: string | null;
  createdAt: string;
  unidades: { id: number; nombre: string; direccion: string | null; activo: boolean }[];
  usuarios: { id: number; email: string; nombre: string; rol: string; activo: boolean }[];
  _count: { usuarios: number; unidades: number; pedidos: number };
};

const PLAN_LABELS: Record<string, string> = {
  basico: "Básico", profesional: "Profesional", enterprise: "Enterprise",
};
const ROL_LABELS: Record<string, string> = {
  superuser: "Super Admin", admin: "Admin", recepcion: "Recepción",
  cocina: "Cocina", viewer: "Viewer",
};

export default function TenantDetailClient({ tenant: initial }: { tenant: Tenant }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tenant, setTenant] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: initial.nombre,
    email: initial.email,
    cif: initial.cif ?? "",
    plan: initial.plan,
    fechaVencimiento: initial.fechaVencimiento
      ? new Date(initial.fechaVencimiento).toISOString().split("T")[0]
      : "",
    notasInternas: initial.notasInternas ?? "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          cif: form.cif || null,
          plan: form.plan,
          fechaVencimiento: form.fechaVencimiento || null,
          notasInternas: form.notasInternas || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setTenant((t) => ({ ...t, ...data.tenant }));
      setEditing(false);
      toast({ title: "Cambios guardados" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !tenant.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenant((t) => ({ ...t, activo: data.tenant.activo }));
      toast({ title: data.tenant.activo ? "Negocio activado" : "Negocio suspendido" });
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Crown className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{tenant.nombre}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={tenant.activo
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-red-100 text-red-700 border-red-200"}>
                {tenant.activo ? "Activo" : "Suspendido"}
              </Badge>
              <Badge variant="outline" className="bg-slate-100 text-slate-600">
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleActivo}
            disabled={saving}
            className={tenant.activo ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}
          >
            {tenant.activo
              ? <><ShieldOff className="w-4 h-4 mr-1" />Suspender</>
              : <><ShieldCheck className="w-4 h-4 mr-1" />Activar</>}
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{tenant._count.usuarios}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> Usuarios
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{tenant._count.unidades}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /> Locales
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{tenant._count.pedidos}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" /> Pedidos
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Datos del negocio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" /> Datos del negocio
          </CardTitle>
          {!editing
            ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  Guardar
                </Button>
              </div>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nombre</Label>
                <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
              </div>
              <div>
                <Label>Email de contacto</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div>
                <Label>CIF / NIF</Label>
                <Input value={form.cif} onChange={(e) => set("cif", e.target.value)} />
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
                <Label>Fecha de vencimiento</Label>
                <Input type="date" value={form.fechaVencimiento} onChange={(e) => set("fechaVencimiento", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notas internas</Label>
                <Textarea rows={2} value={form.notasInternas} onChange={(e) => set("notasInternas", e.target.value)} />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-400">Email</dt><dd className="font-medium">{tenant.email}</dd></div>
              <div><dt className="text-slate-400">CIF</dt><dd className="font-medium">{tenant.cif || "—"}</dd></div>
              <div><dt className="text-slate-400">Plan</dt><dd className="font-medium">{PLAN_LABELS[tenant.plan]}</dd></div>
              <div>
                <dt className="text-slate-400">Vencimiento</dt>
                <dd className="font-medium">
                  {tenant.fechaVencimiento
                    ? new Date(tenant.fechaVencimiento).toLocaleDateString("es-ES")
                    : "Sin fecha límite"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Alta en el sistema</dt>
                <dd className="font-medium">{new Date(tenant.createdAt).toLocaleDateString("es-ES")}</dd>
              </div>
              {tenant.notasInternas && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-400">Notas internas</dt>
                  <dd className="font-medium whitespace-pre-wrap">{tenant.notasInternas}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Locales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" /> Locales / Unidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.unidades.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin locales registrados</p>
          ) : (
            <div className="space-y-2">
              {tenant.unidades.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{u.nombre}</div>
                    {u.direccion && <div className="text-xs text-slate-400">{u.direccion}</div>}
                  </div>
                  <Badge variant="outline" className={u.activo ? "text-green-600" : "text-slate-400"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-purple-600" /> Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.usuarios.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin usuarios registrados</p>
          ) : (
            <div className="space-y-2">
              {tenant.usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{u.nombre}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ROL_LABELS[u.rol] ?? u.rol}</Badge>
                    {!u.activo && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

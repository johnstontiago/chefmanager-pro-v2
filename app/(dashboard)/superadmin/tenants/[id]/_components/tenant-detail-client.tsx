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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, MapPin, Calendar, Loader2, Save,
  ShieldCheck, ShieldOff, UserCircle, Crown, Plus, Trash2, Edit, Eye,
} from "lucide-react";

type Unidad = { id: number; nombre: string; direccion: string | null; activo: boolean };
type Usuario = { id: number; email: string; nombre: string; rol: string; activo: boolean; unidadId: number | null };

type Tenant = {
  id: number; nombre: string; cif: string | null; email: string;
  regionUE: boolean; activo: boolean; plan: string;
  fechaVencimiento: string | null; notasInternas: string | null;
  createdAt: string;
  unidades: Unidad[];
  usuarios: Usuario[];
  _count: { usuarios: number; unidades: number; pedidos: number };
};

const PLAN_LABELS: Record<string, string> = {
  basico: "Básico", profesional: "Profesional", enterprise: "Enterprise",
};
const ROL_OPTIONS = [
  { value: "admin",     label: "Admin" },
  { value: "recepcion", label: "Recepción" },
  { value: "cocina",    label: "Cocina" },
  { value: "viewer",    label: "Viewer" },
];
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
  const [enteringAs, setEnteringAs] = useState(false);
  const [showEnterDialog, setShowEnterDialog] = useState(false);
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");

  // Confirmaciones de borrado
  const [deleteTenantOpen, setDeleteTenantOpen] = useState(false);
  const [deleteUnidad, setDeleteUnidad] = useState<Unidad | null>(null);
  const [deleteUsuario, setDeleteUsuario] = useState<Usuario | null>(null);

  // Modales de creación
  const [showAddUnidad, setShowAddUnidad] = useState(false);
  const [showAddUsuario, setShowAddUsuario] = useState(false);

  // Form edición datos del negocio
  const [form, setForm] = useState({
    nombre: initial.nombre, email: initial.email, cif: initial.cif ?? "",
    plan: initial.plan,
    fechaVencimiento: initial.fechaVencimiento
      ? new Date(initial.fechaVencimiento).toISOString().split("T")[0] : "",
    notasInternas: initial.notasInternas ?? "",
  });

  // Form nueva unidad
  const [unidadForm, setUnidadForm] = useState({ nombre: "", direccion: "", telefono: "" });
  const [unidadError, setUnidadError] = useState<string | null>(null);
  const [savingUnidad, setSavingUnidad] = useState(false);

  // Form nuevo usuario
  const [usuarioForm, setUsuarioForm] = useState({
    nombre: "", email: "", password: "", rol: "admin", unidadId: "", pinCode: "",
  });
  const [usuarioError, setUsuarioError] = useState<string | null>(null);
  const [savingUsuario, setSavingUsuario] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ── Guardar datos negocio ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre, email: form.email, cif: form.cif || null,
          plan: form.plan, fechaVencimiento: form.fechaVencimiento || null,
          notasInternas: form.notasInternas || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenant((t) => ({ ...t, ...data.tenant }));
      setEditing(false);
      toast({ title: "Cambios guardados" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Activar / Suspender ────────────────────────────────────────────────────
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
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Entrar como este negocio ───────────────────────────────────────────────
  const handleEnterAs = async () => {
    setEnteringAs(true);
    const unidad = tenant.unidades.find((u) => String(u.id) === selectedUnidad);
    try {
      const res = await fetch("/api/superadmin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          unidadId: unidad?.id ?? null,
          unidadNombre: unidad?.nombre ?? null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      setEnteringAs(false);
    }
  };

  // ── Eliminar negocio ───────────────────────────────────────────────────────

  const handleDeleteTenant = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: "Negocio eliminado" });
      router.push("/superadmin");
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  // ── Añadir unidad ──────────────────────────────────────────────────────────
  const handleAddUnidad = async () => {
    setUnidadError(null);
    if (!unidadForm.nombre.trim()) { setUnidadError("El nombre es requerido"); return; }
    setSavingUnidad(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/unidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: unidadForm.nombre,
          direccion: unidadForm.direccion || null,
          telefono: unidadForm.telefono || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenant((t) => ({
        ...t,
        unidades: [...t.unidades, data.unidad],
        _count: { ...t._count, unidades: t._count.unidades + 1 },
      }));
      setUnidadForm({ nombre: "", direccion: "", telefono: "" });
      setShowAddUnidad(false);
      toast({ title: "Unidad creada" });
    } catch (e: any) {
      setUnidadError(e.message);
    } finally {
      setSavingUnidad(false);
    }
  };

  // ── Eliminar unidad ────────────────────────────────────────────────────────
  const handleDeleteUnidad = async () => {
    if (!deleteUnidad) return;
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/unidades/${deleteUnidad.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTenant((t) => ({
        ...t,
        unidades: t.unidades.filter((u) => u.id !== deleteUnidad.id),
        _count: { ...t._count, unidades: t._count.unidades - 1 },
      }));
      setDeleteUnidad(null);
      toast({ title: "Unidad eliminada" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Añadir usuario ─────────────────────────────────────────────────────────
  const handleAddUsuario = async () => {
    setUsuarioError(null);
    if (!usuarioForm.email.trim() || !usuarioForm.nombre.trim()) {
      setUsuarioError("Email y nombre son requeridos"); return;
    }
    if (usuarioForm.password.length < 8) {
      setUsuarioError("La contraseña debe tener mínimo 8 caracteres"); return;
    }
    setSavingUsuario(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: usuarioForm.email,
          nombre: usuarioForm.nombre,
          password: usuarioForm.password,
          rol: usuarioForm.rol,
          unidadId: usuarioForm.unidadId ? parseInt(usuarioForm.unidadId) : null,
          pinCode: usuarioForm.pinCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenant((t) => ({
        ...t,
        usuarios: [...t.usuarios, data.usuario],
        _count: { ...t._count, usuarios: t._count.usuarios + 1 },
      }));
      setUsuarioForm({ nombre: "", email: "", password: "", rol: "admin", unidadId: "", pinCode: "" });
      setShowAddUsuario(false);
      toast({ title: "Usuario creado" });
    } catch (e: any) {
      setUsuarioError(e.message);
    } finally {
      setSavingUsuario(false);
    }
  };

  // ── Eliminar usuario ───────────────────────────────────────────────────────
  const handleDeleteUsuario = async () => {
    if (!deleteUsuario) return;
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}/usuarios/${deleteUsuario.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTenant((t) => ({
        ...t,
        usuarios: t.usuarios.filter((u) => u.id !== deleteUsuario.id),
        _count: { ...t._count, usuarios: t._count.usuarios - 1 },
      }));
      setDeleteUsuario(null);
      toast({ title: "Usuario eliminado" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{tenant.nombre}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={tenant.activo
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-red-100 text-red-700 border-red-200"}>
                {tenant.activo ? "Activo" : "Suspendido"}
              </Badge>
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm"
            onClick={() => { setSelectedUnidad(""); setShowEnterDialog(true); }}
            disabled={enteringAs || saving}
            className="text-blue-600 hover:bg-blue-50 border-blue-200">
            {enteringAs
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Entrando...</>
              : <><Eye className="w-4 h-4 mr-1" />Ver como este negocio</>}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleActivo} disabled={saving}
            className={tenant.activo ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}>
            {tenant.activo
              ? <><ShieldOff className="w-4 h-4 mr-1" />Suspender</>
              : <><ShieldCheck className="w-4 h-4 mr-1" />Activar</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteTenantOpen(true)} disabled={saving}
            className="text-red-600 hover:bg-red-50 border-red-200">
            <Trash2 className="w-4 h-4 mr-1" />Eliminar negocio
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Usuarios", value: tenant._count.usuarios, icon: Users },
          { label: "Locales", value: tenant._count.unidades, icon: MapPin },
          { label: "Pedidos", value: tenant._count.pedidos, icon: Calendar },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" /> {label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Datos del negocio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" /> Datos del negocio
          </CardTitle>
          {!editing
            ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit className="w-3 h-3 mr-1" />Editar</Button>
            : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}Guardar
                </Button>
              </div>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label>CIF / NIF</Label><Input value={form.cif} onChange={(e) => set("cif", e.target.value)} /></div>
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
              <div><Label>Fecha vencimiento</Label><Input type="date" value={form.fechaVencimiento} onChange={(e) => set("fechaVencimiento", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Notas internas</Label><Textarea rows={2} value={form.notasInternas} onChange={(e) => set("notasInternas", e.target.value)} /></div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{tenant.email}</dd></div>
              <div><dt className="text-muted-foreground">CIF</dt><dd className="font-medium">{tenant.cif || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Plan</dt><dd className="font-medium">{PLAN_LABELS[tenant.plan]}</dd></div>
              <div><dt className="text-muted-foreground">Vencimiento</dt><dd className="font-medium">{tenant.fechaVencimiento ? new Date(tenant.fechaVencimiento).toLocaleDateString("es-ES") : "Sin límite"}</dd></div>
              <div><dt className="text-muted-foreground">Alta</dt><dd className="font-medium">{new Date(tenant.createdAt).toLocaleDateString("es-ES")}</dd></div>
              {tenant.notasInternas && (
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Notas internas</dt><dd className="font-medium whitespace-pre-wrap">{tenant.notasInternas}</dd></div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Locales / Unidades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-600" /> Locales / Unidades ({tenant.unidades.length})
          </CardTitle>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => { setUnidadError(null); setShowAddUnidad(true); }}>
            <Plus className="w-4 h-4 mr-1" />Añadir local
          </Button>
        </CardHeader>
        <CardContent>
          {tenant.unidades.length === 0 ? (
            <p className="text-muted-foreground text-sm py-2">Sin locales — añade el primero</p>
          ) : (
            <div className="space-y-2">
              {tenant.unidades.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{u.nombre}</div>
                    {u.direccion && <div className="text-xs text-muted-foreground">{u.direccion}</div>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50"
                    onClick={() => setDeleteUnidad(u)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-purple-600" /> Usuarios ({tenant.usuarios.length})
          </CardTitle>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => { setUsuarioError(null); setShowAddUsuario(true); }}>
            <Plus className="w-4 h-4 mr-1" />Añadir usuario
          </Button>
        </CardHeader>
        <CardContent>
          {tenant.usuarios.length === 0 ? (
            <p className="text-muted-foreground text-sm py-2">Sin usuarios — añade el primero</p>
          ) : (
            <div className="space-y-2">
              {tenant.usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ROL_LABELS[u.rol] ?? u.rol}</Badge>
                    {!u.activo && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                    <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50"
                      onClick={() => setDeleteUsuario(u)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: entrar como este negocio */}
      <Dialog open={showEnterDialog} onOpenChange={(open) => { setShowEnterDialog(open); if (!open) setSelectedUnidad(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Entrar como {tenant.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Selecciona el local desde el que quieres visualizar el dashboard:</p>
            {tenant.unidades.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
                Este negocio no tiene locales. Crea uno primero antes de entrar.
              </p>
            ) : (
              <Select value={selectedUnidad} onValueChange={setSelectedUnidad}>
                <SelectTrigger><SelectValue placeholder="Elige un local..." /></SelectTrigger>
                <SelectContent>
                  {tenant.unidades.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEnterDialog(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!selectedUnidad || enteringAs}
              onClick={() => { setShowEnterDialog(false); handleEnterAs(); }}
            >
              {enteringAs
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Entrando...</>
                : <><Eye className="w-4 h-4 mr-1" />Entrar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: añadir unidad */}
      <Dialog open={showAddUnidad} onOpenChange={setShowAddUnidad}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo local / unidad</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre *</Label><Input placeholder="Cocina Central" value={unidadForm.nombre} onChange={(e) => setUnidadForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
            <div><Label>Dirección</Label><Input placeholder="Calle Mayor 1, Madrid" value={unidadForm.direccion} onChange={(e) => setUnidadForm((f) => ({ ...f, direccion: e.target.value }))} /></div>
            <div><Label>Teléfono</Label><Input placeholder="+34 600 000 000" value={unidadForm.telefono} onChange={(e) => setUnidadForm((f) => ({ ...f, telefono: e.target.value }))} /></div>
            {unidadError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{unidadError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddUnidad(false)}>Cancelar</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAddUnidad} disabled={savingUnidad}>
                {savingUnidad && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Crear local
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: añadir usuario */}
      <Dialog open={showAddUsuario} onOpenChange={setShowAddUsuario}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre *</Label><Input placeholder="Ana García" value={usuarioForm.nombre} onChange={(e) => setUsuarioForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
              <div><Label>Email *</Label><Input type="email" placeholder="ana@negocio.com" value={usuarioForm.email} onChange={(e) => setUsuarioForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Contraseña *</Label><Input type="password" placeholder="Mín. 8 caracteres" value={usuarioForm.password} onChange={(e) => setUsuarioForm((f) => ({ ...f, password: e.target.value }))} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={usuarioForm.rol} onValueChange={(v) => setUsuarioForm((f) => ({ ...f, rol: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROL_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select value={usuarioForm.unidadId || "none"} onValueChange={(v) => setUsuarioForm((f) => ({ ...f, unidadId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {tenant.unidades.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>PIN (opcional)</Label><Input maxLength={6} placeholder="1234" value={usuarioForm.pinCode} onChange={(e) => setUsuarioForm((f) => ({ ...f, pinCode: e.target.value.replace(/\D/g, "") }))} /></div>
            </div>
            {usuarioError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{usuarioError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddUsuario(false)}>Cancelar</Button>
              <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAddUsuario} disabled={savingUsuario}>
                {savingUsuario && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Crear usuario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar negocio */}
      <AlertDialog open={deleteTenantOpen} onOpenChange={setDeleteTenantOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{tenant.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>todos los datos</strong> del negocio: unidades, usuarios, pedidos, inventario y movimientos. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-red-600 hover:bg-red-700">
              Sí, eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar eliminar unidad */}
      <AlertDialog open={!!deleteUnidad} onOpenChange={() => setDeleteUnidad(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteUnidad?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>Los usuarios asignados a esta unidad quedarán sin unidad asignada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUnidad} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar eliminar usuario */}
      <AlertDialog open={!!deleteUsuario} onOpenChange={() => setDeleteUsuario(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a "{deleteUsuario?.nombre}"?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará la cuenta de {deleteUsuario?.email}. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUsuario} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Users, Plus, Search, Edit2, Trash2, Loader2, Save, Shield, Key, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { puedeGestionarUsuario, puedeAsignarRol } from "@/lib/user-permissions";

const ROLES = [
  { value: "superuser", label: "Super Admin", color: "bg-purple-100 text-purple-700" },
  { value: "admin", label: "Admin", color: "bg-blue-100 text-blue-700" },
  { value: "recepcion", label: "Recepción", color: "bg-green-100 text-green-700" },
  { value: "cocina", label: "Cocina", color: "bg-orange-100 text-orange-700" },
  { value: "viewer", label: "Viewer", color: "bg-slate-100 text-slate-700" },
];

export default function UsuariosTab({ actorRol }: { actorRol: string }) {
  const { toast } = useToast();
  const rolesDisponibles = ROLES.filter((r) => puedeAsignarRol(actorRol, r.value));
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [formData, setFormData] = useState({ email: "", nombre: "", rol: "viewer", unidadId: "", password: "", pinCode: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, unitRes] = await Promise.all([fetch("/api/usuarios"), fetch("/api/unidades")]);
      if (userRes.ok) {
        const data = await userRes.json();
        setUsuarios(data?.usuarios || []);
      }
      if (unitRes.ok) {
        const data = await unitRes.json();
        setUnidades(data?.unidades || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = (usuarios || []).filter((u) => u.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || "") || u.email?.toLowerCase()?.includes(busqueda?.toLowerCase() || ""));

  const openNew = () => {
    setEditingItem(null);
    setFormData({ email: "", nombre: "", rol: "viewer", unidadId: "", password: "", pinCode: "" });
    setShowDialog(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ email: item.email || "", nombre: item.nombre || "", rol: item.rol || "viewer", unidadId: item.unidadId?.toString() || "", password: "", pinCode: "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.email || !formData.nombre) {
      toast({ title: "Email y nombre son requeridos", variant: "destructive" });
      return;
    }
    if (!editingItem && !formData.password) {
      toast({ title: "La contraseña es requerida para nuevos usuarios", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const payload: any = { email: formData.email, nombre: formData.nombre, rol: formData.rol, unidadId: formData.unidadId ? parseInt(formData.unidadId) : null };
      if (formData.password) payload.password = formData.password;
      if (formData.pinCode) payload.pinCode = formData.pinCode;

      const res = await apiFetch(editingItem ? `/api/usuarios/${editingItem.id}` : "/api/usuarios", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Error");
      }
      toast({ title: editingItem ? "Usuario actualizado" : "Usuario creado" });
      setShowDialog(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error?.message || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await apiFetch(`/api/usuarios/${deleteItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast({ title: "Usuario desactivado" });
      setDeleteItem(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error al desactivar", variant: "destructive" });
    }
  };

  const handleAnonymize = async () => {
    if (!deleteItem) return;
    try {
      setAnonymizing(true);
      const res = await apiFetch(`/api/usuarios/${deleteItem.id}/anonimizar`, { method: "POST" });
      if (!res.ok) throw new Error("Error");
      toast({ title: "Usuario anonimizado", description: "Se eliminaron sus datos personales" });
      setDeleteItem(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error al anonimizar", variant: "destructive" });
    } finally {
      setAnonymizing(false);
    }
  };

  const getRoleBadge = (rol: string) => {
    const role = ROLES.find((r) => r.value === rol) || ROLES[4];
    return <Badge className={role.color}>{role.label}</Badge>;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Usuarios ({(usuarios || []).length})</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-10 w-full sm:w-48" />
              </div>
              <Button onClick={openNew} className="flex-shrink-0"><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay usuarios</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-slate-800">{item.nombre}</h4>
                      {getRoleBadge(item.rol)}
                      {!item.activo && <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                      <span>{item.email}</span>
                      {item.unidad && <span className="flex items-center"><Building2 className="w-3 h-3 mr-1" />{item.unidad.nombre}</span>}
                      {item.hasPin && <span className="flex items-center"><Key className="w-3 h-3 mr-1" />PIN configurado</span>}
                    </div>
                  </div>
                  {puedeGestionarUsuario(actorRol, item.rol) && (
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDeleteItem(item)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Email *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div><Label>Nombre *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Rol</Label>
                <Select value={formData.rol} onValueChange={(v) => setFormData({ ...formData, rol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rolesDisponibles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select value={formData.unidadId || "none"} onValueChange={(v) => setFormData({ ...formData, unidadId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {(unidades || []).map((u) => <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{editingItem ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña *"}</Label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>
            <div><Label>PIN (4 dígitos)</Label><Input maxLength={4} value={formData.pinCode} onChange={(e) => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, "") })} placeholder="0000" /></div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja a "{deleteItem?.nombre}"</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><strong>Desactivar:</strong> el usuario pierde el acceso pero se conservan sus datos. Es reversible (puedes reactivarlo).</p>
                <p><strong>Anonimizar (RGPD):</strong> elimina de forma <strong>irreversible</strong> sus datos personales (email, nombre, PIN), conservando el historial operativo. Úsalo para atender el derecho de supresión.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={handleDelete} disabled={anonymizing}>Desactivar</Button>
            <Button onClick={handleAnonymize} disabled={anonymizing} className="bg-red-600 hover:bg-red-700 text-white">
              {anonymizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Anonimizar (RGPD)
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

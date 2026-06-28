"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Truck, Plus, Search, Edit2, Trash2, Loader2, Save, Phone, Mail, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function ProveedoresTab() {
  const { toast } = useToast();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", contacto: "", telefono: "", email: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/proveedores");
      if (res.ok) {
        const data = await res.json();
        setProveedores(data?.proveedores || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = (proveedores || []).filter((p) => p.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || ""));

  const openNew = () => {
    setEditingItem(null);
    setFormData({ nombre: "", contacto: "", telefono: "", email: "" });
    setShowDialog(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ nombre: item.nombre || "", contacto: item.contacto || "", telefono: item.telefono || "", email: item.email || "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.nombre) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const res = await apiFetch(editingItem ? `/api/proveedores/${editingItem.id}` : "/api/proveedores", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Error");
      toast({ title: editingItem ? "Proveedor actualizado" : "Proveedor creado" });
      setShowDialog(false);
      fetchData();
    } catch (error) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await apiFetch(`/api/proveedores/${deleteItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast({ title: "Proveedor eliminado" });
      setDeleteItem(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <span>Proveedores ({(proveedores || []).length})</span>
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
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay proveedores</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-slate-800">{item.nombre}</h4>
                      {!item.activo && <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                      {item.contacto && <span className="flex items-center"><User className="w-3 h-3 mr-1" />{item.contacto}</span>}
                      {item.telefono && <span className="flex items-center"><Phone className="w-3 h-3 mr-1" />{item.telefono}</span>}
                      {item.email && <span className="flex items-center"><Mail className="w-3 h-3 mr-1" />{item.email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDeleteItem(item)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre *</Label><Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} /></div>
            <div><Label>Contacto</Label><Input value={formData.contacto} onChange={(e) => setFormData({ ...formData, contacto: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
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
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará "{deleteItem?.nombre}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

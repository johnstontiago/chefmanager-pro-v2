"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Tags, Plus, Search, Edit2, Trash2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function CategoriasTab() {
  const { toast } = useToast();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categorias");
      if (res.ok) {
        const data = await res.json();
        setCategorias(data?.categorias || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtradas = (categorias || []).filter((c) => c.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || ""));

  const openNew = () => { setEditingItem(null); setNombre(""); setShowDialog(true); };
  const openEdit = (item: any) => { setEditingItem(item); setNombre(item.nombre || ""); setShowDialog(true); };

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const res = await apiFetch(editingItem ? `/api/categorias/${editingItem.id}` : "/api/categorias", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) throw new Error("Error");
      toast({ title: editingItem ? "Categoría actualizada" : "Categoría creada" });
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
      const res = await apiFetch(`/api/categorias/${deleteItem.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast({ title: "Categoría eliminada" });
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
              <Tags className="w-5 h-5 text-blue-600" />
              <span>Categorías ({(categorias || []).length})</span>
            </CardTitle>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-10 w-48" />
              </div>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtradas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Tags className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay categorías</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtradas.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <h4 className="font-semibold text-slate-800">{item.nombre}</h4>
                  <div className="flex items-center space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteItem(item)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nombre *</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la categoría" /></div>
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
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
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

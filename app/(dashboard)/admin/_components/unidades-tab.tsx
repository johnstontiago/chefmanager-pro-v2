"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  MapPin,
  Phone,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Unidad {
  id: number;
  nombre: string;
  direccion: string | null;
  responsable: string | null;
  telefono: string | null;
  activo: boolean;
  createdAt: string;
}

export default function UnidadesTab() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<Unidad | null>(null);
  const [deletingUnidad, setDeletingUnidad] = useState<Unidad | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    responsable: "",
    telefono: "",
  });

  const fetchUnidades = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/unidades");
      if (res.ok) {
        const data = await res.json();
        setUnidades(data?.unidades || []);
      }
    } catch (error) {
      toast({ title: "Error al cargar unidades", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnidades();
  }, []);

  const openCreateDialog = () => {
    setEditingUnidad(null);
    setFormData({ nombre: "", direccion: "", responsable: "", telefono: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (unidad: Unidad) => {
    setEditingUnidad(unidad);
    setFormData({
      nombre: unidad.nombre,
      direccion: unidad.direccion || "",
      responsable: unidad.responsable || "",
      telefono: unidad.telefono || "",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (unidad: Unidad) => {
    setDeletingUnidad(unidad);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const url = editingUnidad
        ? `/api/unidades/${editingUnidad.id}`
        : "/api/unidades";
      const method = editingUnidad ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: editingUnidad
            ? "Unidad actualizada correctamente"
            : "Unidad creada correctamente",
        });
        setIsDialogOpen(false);
        fetchUnidades();
      } else {
        const error = await res.json();
        toast({ title: error.error || "Error al guardar", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUnidad) return;

    try {
      const res = await apiFetch(`/api/unidades/${deletingUnidad.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Unidad eliminada correctamente" });
        setIsDeleteDialogOpen(false);
        setDeletingUnidad(null);
        fetchUnidades();
      } else {
        const error = await res.json();
        toast({ title: error.error || "Error al eliminar", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const filteredUnidades = (unidades || []).filter(
    (u) =>
      u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.direccion?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      u.responsable?.toLowerCase()?.includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar unidades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Unidad
        </Button>
      </div>

      {filteredUnidades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No hay unidades de negocio registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUnidades.map((unidad) => (
            <Card key={unidad.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">{unidad.nombre}</CardTitle>
                  </div>
                  <Badge variant={unidad.activo ? "default" : "secondary"}>
                    {unidad.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {unidad.direccion && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span>{unidad.direccion}</span>
                  </div>
                )}
                {unidad.responsable && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{unidad.responsable}</span>
                  </div>
                )}
                {unidad.telefono && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{unidad.telefono}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(unidad)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openDeleteDialog(unidad)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {editingUnidad ? "Editar Unidad" : "Nueva Unidad de Negocio"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la Unidad *</Label>
              <Input
                id="nombre"
                placeholder="Ej: PANZZONI - Sucursal Centro"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección de Reparto</Label>
              <Input
                id="direccion"
                placeholder="Ej: Calle Principal 123, Madrid"
                value={formData.direccion}
                onChange={(e) =>
                  setFormData({ ...formData, direccion: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsable">Nombre del Responsable</Label>
              <Input
                id="responsable"
                placeholder="Ej: Juan García"
                value={formData.responsable}
                onChange={(e) =>
                  setFormData({ ...formData, responsable: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                placeholder="Ej: +34 600 123 456"
                value={formData.telefono}
                onChange={(e) =>
                  setFormData({ ...formData, telefono: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar unidad de negocio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la unidad "{deletingUnidad?.nombre}". Si tiene
              datos relacionados (usuarios, productos, pedidos), será desactivada
              en lugar de eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

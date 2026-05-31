"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDecimal, toNumber } from "@/lib/utils";

export default function ProductosTab() {
  const { toast } = useToast();
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleteProduct, setDeleteProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    fabricante: "",
    formato: "",
    categoriaId: "",
    proveedorId: "",
    unidadMedida: "kg",
    precioUnitario: "",
    stockMinimo: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, provRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/categorias"),
        fetch("/api/proveedores"),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data?.productos || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorias(data?.categorias || []);
      }
      if (provRes.ok) {
        const data = await provRes.json();
        setProveedores(data?.proveedores || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = (productos || []).filter((p) =>
    p.nombre?.toLowerCase()?.includes(busqueda?.toLowerCase() || "")
  );

  const openNewDialog = () => {
    setEditingProduct(null);
    setFormData({
      nombre: "",
      fabricante: "",
      formato: "",
      categoriaId: "",
      proveedorId: "",
      unidadMedida: "kg",
      precioUnitario: "",
      stockMinimo: "",
    });
    setShowDialog(true);
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre || "",
      fabricante: product.fabricante || "",
      formato: product.formato || "",
      categoriaId: product.categoriaId?.toString() || "",
      proveedorId: product.proveedorId?.toString() || "",
      unidadMedida: product.unidadMedida || "kg",
      precioUnitario: toNumber(product.precioUnitario).toString(),
      stockMinimo: toNumber(product.stockMinimo).toString(),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.categoriaId || !formData.precioUnitario || !formData.stockMinimo) {
      toast({ title: "Completa todos los campos requeridos", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nombre: formData.nombre,
        fabricante: formData.fabricante || null,
        formato: formData.formato || null,
        categoriaId: parseInt(formData.categoriaId),
        proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
        unidadMedida: formData.unidadMedida,
        precioUnitario: parseFloat(formData.precioUnitario),
        stockMinimo: parseFloat(formData.stockMinimo),
      };

      const res = await apiFetch(
        editingProduct ? `/api/productos/${editingProduct.id}` : "/api/productos",
        {
          method: editingProduct ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Error al guardar");

      toast({ title: editingProduct ? "Producto actualizado" : "Producto creado" });
      setShowDialog(false);
      fetchData();
    } catch (error) {
      toast({ title: "Error al guardar producto", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;

    try {
      const res = await apiFetch(`/api/productos/${deleteProduct.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error al eliminar");

      toast({ title: "Producto eliminado" });
      setDeleteProduct(null);
      fetchData();
    } catch (error) {
      toast({ title: "Error al eliminar producto", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Productos ({(productos || []).length})</span>
            </CardTitle>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay productos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {productosFiltrados.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-slate-800">{prod.nombre}</h4>
                      {!prod.activo && <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
                      <span>{prod.categoria?.nombre || "-"}</span>
                      {prod.fabricante && <span>{prod.fabricante}</span>}
                      {prod.formato && <span className="italic">{prod.formato}</span>}
                      <span>{prod.proveedor?.nombre || "Sin proveedor"}</span>
                      <span>{formatCurrency(prod.precioUnitario)}/{prod.unidadMedida}</span>
                      <span>Mín: {formatDecimal(prod.stockMinimo)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(prod)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleteProduct(prod)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Fabricante</Label>
                <Input
                  value={formData.fabricante}
                  onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                  placeholder="Marca o fabricante"
                />
              </div>
              <div>
                <Label>Formato</Label>
                <Input
                  value={formData.formato}
                  onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
                  placeholder="Ej: 1kg, 500ml, 6 unid."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Categoría *</Label>
                <Select value={formData.categoriaId} onValueChange={(v) => setFormData({ ...formData, categoriaId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categorias || []).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proveedor</Label>
                <Select value={formData.proveedorId || "none"} onValueChange={(v) => setFormData({ ...formData, proveedorId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {(proveedores || []).map((prov) => (
                      <SelectItem key={prov.id} value={prov.id.toString()}>
                        {prov.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Unidad</Label>
                <Select value={formData.unidadMedida} onValueChange={(v) => setFormData({ ...formData, unidadMedida: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="l">l</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                    <SelectItem value="docena">docena</SelectItem>
                    <SelectItem value="botella">botella</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precioUnitario}
                  onChange={(e) => setFormData({ ...formData, precioUnitario: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Stock mín. *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.stockMinimo}
                  onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{deleteProduct?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

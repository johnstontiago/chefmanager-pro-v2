"use client";

import { useState } from "react";
import {
  Settings,
  Package,
  Truck,
  Tags,
  Users,
  FileText,
  Building2,
  Printer,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductosTab from "./productos-tab";
import ProveedoresTab from "./proveedores-tab";
import CategoriasTab from "./categorias-tab";
import UsuariosTab from "./usuarios-tab";
import ReportesTab from "./reportes-tab";
import UnidadesTab from "./unidades-tab";
import EtiquetaTab from "./etiqueta-tab";

interface AdminContentProps {
  userRole: string;
}

export default function AdminContent({ userRole }: AdminContentProps) {
  const [activeTab, setActiveTab] = useState("productos");

  const isSuperuser = userRole === "superuser";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Administración</h1>
        <p className="text-slate-500">Gestiona productos, proveedores, categorías y usuarios</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="productos" className="flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Productos</span>
          </TabsTrigger>
          <TabsTrigger value="proveedores" className="flex items-center space-x-2">
            <Truck className="w-4 h-4" />
            <span>Proveedores</span>
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center space-x-2">
            <Tags className="w-4 h-4" />
            <span>Categorías</span>
          </TabsTrigger>
          {isSuperuser && (
            <TabsTrigger value="usuarios" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Usuarios</span>
            </TabsTrigger>
          )}
          {isSuperuser && (
            <TabsTrigger value="unidades" className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>Unidades</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="reportes" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Reportes</span>
          </TabsTrigger>
          <TabsTrigger value="etiqueta" className="flex items-center space-x-2">
            <Printer className="w-4 h-4" />
            <span>Etiqueta</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="mt-6">
          <ProductosTab />
        </TabsContent>

        <TabsContent value="proveedores" className="mt-6">
          <ProveedoresTab />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <CategoriasTab />
        </TabsContent>

        {isSuperuser && (
          <TabsContent value="usuarios" className="mt-6">
            <UsuariosTab />
          </TabsContent>
        )}

        {isSuperuser && (
          <TabsContent value="unidades" className="mt-6">
            <UnidadesTab />
          </TabsContent>
        )}

        <TabsContent value="reportes" className="mt-6">
          <ReportesTab />
        </TabsContent>

        <TabsContent value="etiqueta" className="mt-6">
          <EtiquetaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

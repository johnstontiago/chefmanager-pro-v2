"use client";

import { useState, useEffect } from "react";
import {
  Search,
  FileText,
  Download,
  Copy,
  Eye,
  Loader2,
  Calendar,
  Truck,
  Filter,
  MoreVertical,
  FileDown,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatDecimal, toNumber } from "@/lib/utils";

interface HistorialPedidosProps {
  userRole: string;
}

export default function HistorialPedidos({ userRole }: HistorialPedidosProps) {
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroProveedor, setFiltroProveedor] = useState("all");
  const [pedidoDetalle, setPedidoDetalle] = useState<any>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pedRes, provRes] = await Promise.all([
        fetch("/api/pedidos"),
        fetch("/api/proveedores"),
      ]);

      if (pedRes.ok) {
        const data = await pedRes.json();
        setPedidos(data?.pedidos || []);
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

  const pedidosFiltrados = pedidos.filter((p) => {
    const matchEstado = filtroEstado === "all" || p.estado === filtroEstado;
    const matchProveedor =
      filtroProveedor === "all" || p.proveedorId === parseInt(filtroProveedor);
    const matchBusqueda =
      p.id?.toString()?.includes(busqueda) ||
      p.notas?.toLowerCase()?.includes(busqueda?.toLowerCase() || "");
    return matchEstado && matchProveedor && matchBusqueda;
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "borrador":
        return <Badge variant="secondary"><Edit2 className="w-3 h-3 mr-1" /> Borrador</Badge>;
      case "enviado":
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case "recibido":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Recibido</Badge>;
      case "recibido_parcial":
        return <Badge className="bg-yellow-100 text-yellow-800"><CheckCircle className="w-3 h-3 mr-1" /> Recibido parcial</Badge>;
      case "cancelado":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  const cambiarEstado = async (pedidoId: number, nuevoEstado: string) => {
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!res.ok) throw new Error("Error al actualizar estado");

      toast({ title: `Estado actualizado a: ${nuevoEstado}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error al cambiar estado", variant: "destructive" });
    }
  };

  const generarPDF = async (
    pedido: any,
    tipo: "completo" | "por_proveedor" | "por_categoria"
  ) => {
    try {
      setGenerandoPDF(true);
      const res = await fetch("/api/pedidos/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: pedido.id, tipo }),
      });

      if (!res.ok) throw new Error("Error generando PDF");

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `pedido_${pedido.id}_${tipo}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Check content type for ZIP
      const contentType = res.headers.get("Content-Type") || "";
      const isZip = contentType.includes("zip");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ 
        title: isZip ? "ZIP generado con PDFs por proveedor" : "PDF generado correctamente" 
      });
    } catch (error) {
      toast({ title: "Error al generar PDF", variant: "destructive" });
    } finally {
      setGenerandoPDF(false);
    }
  };

  const exportarCSV = (pedido: any) => {
    const items = pedido.items || [];
    const headers = ["Producto", "Cantidad", "Unidad", "Proveedor", "Categoría"];
    const rows = items.map((item: any) => [
      item.producto?.nombre || "",
      formatDecimal(item.cantidad),
      item.producto?.unidadMedida || "",
      item.producto?.proveedor?.nombre || "",
      item.producto?.categoria?.nombre || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedido_${pedido.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "CSV exportado" });
  };

  const exportarCSVRecepcion = async (pedido: any) => {
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/csv`);
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || "Error al exportar CSV", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `pedido-${pedido.id}-recepcion.csv`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "CSV de recepción exportado" });
    } catch {
      toast({ title: "Error al exportar CSV", variant: "destructive" });
    }
  };

  const copiarAlPortapapeles = (pedido: any) => {
    const items = pedido.items || [];
    let texto = `PEDIDO #${pedido.id}\n`;
    texto += `Fecha: ${formatDate(pedido.fechaPedido)}\n`;
    texto += `Estado: ${pedido.estado}\n\n`;
    texto += "PRODUCTOS:\n";
    texto += "-".repeat(50) + "\n";

    items.forEach((item: any) => {
      texto += `${item.producto?.nombre}\n`;
      texto += `  Cantidad: ${formatDecimal(item.cantidad)} ${item.producto?.unidadMedida}\n`;
      texto += `  Proveedor: ${item.producto?.proveedor?.nombre || "-"}\n\n`;
    });

    texto += "-".repeat(50) + "\n";
    texto += `TOTAL: ${items.length} productos\n`;
    if (pedido.notas) texto += `\nNotas: ${pedido.notas}`;

    navigator.clipboard.writeText(texto);
    toast({ title: "Copiado al portapapeles" });
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
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Historial de Pedidos</span>
            </CardTitle>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 w-full md:w-48"
                />
              </div>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="recibido">Recibido</SelectItem>
                  <SelectItem value="recibido_parcial">Recibido parcial</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay pedidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosFiltrados.map((pedido) => (
                <div
                  key={pedido.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-bold text-lg">#{pedido.id}</span>
                      {getEstadoBadge(pedido.estado)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(pedido.fechaPedido)}
                      </span>
                      <span className="flex items-center font-semibold text-slate-800">
                        <Truck className="w-4 h-4 mr-1" />
                        {pedido.items?.length || 0} productos
                      </span>
                    </div>
                    {pedido.notas && (
                      <p className="text-xs text-slate-500 mt-1 truncate max-w-md">
                        {pedido.notas}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-3 md:mt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPedidoDetalle(pedido)}
                    >
                      <Eye className="w-4 h-4 mr-1" /> Ver
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FileDown className="w-4 h-4 mr-2" />
                            Generar PDF
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => generarPDF(pedido, "completo")}
                              disabled={generandoPDF}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              PDF Completo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => generarPDF(pedido, "por_proveedor")}
                              disabled={generandoPDF}
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              PDFs por Proveedor
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => generarPDF(pedido, "por_categoria")}
                              disabled={generandoPDF}
                            >
                              <Filter className="w-4 h-4 mr-2" />
                              PDFs por Categoría
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => exportarCSV(pedido)}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Exportar CSV (pedido)
                        </DropdownMenuItem>
                        {(pedido.estado === "recibido" || pedido.estado === "recibido_parcial") && (
                          <DropdownMenuItem onClick={() => exportarCSVRecepcion(pedido)}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Exportar CSV recepción
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => copiarAlPortapapeles(pedido)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar al portapapeles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {pedido.estado === "borrador" && (
                          <DropdownMenuItem onClick={() => cambiarEstado(pedido.id, "enviado")}>
                            Marcar como Enviado
                          </DropdownMenuItem>
                        )}
                        {pedido.estado === "enviado" && (
                          <DropdownMenuItem onClick={() => cambiarEstado(pedido.id, "recibido")}>
                            Marcar como Recibido
                          </DropdownMenuItem>
                        )}
                        {pedido.estado !== "cancelado" && pedido.estado !== "recibido" && (
                          <DropdownMenuItem
                            onClick={() => cambiarEstado(pedido.id, "cancelado")}
                            className="text-red-600"
                          >
                            Cancelar Pedido
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!pedidoDetalle} onOpenChange={() => setPedidoDetalle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pedido #{pedidoDetalle?.id}</span>
              {pedidoDetalle && getEstadoBadge(pedidoDetalle.estado)}
            </DialogTitle>
          </DialogHeader>
          {pedidoDetalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Fecha</p>
                  <p className="font-medium">{formatDate(pedidoDetalle.fechaPedido)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Usuario</p>
                  <p className="font-medium">{pedidoDetalle.usuario?.nombre || "-"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Productos</h4>
                <div className="space-y-2">
                  {pedidoDetalle.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.producto?.nombre}</p>
                        <p className="text-sm text-slate-500">
                          {item.producto?.proveedor?.nombre || "Sin proveedor"} •{" "}
                          {item.producto?.categoria?.nombre || "Sin categoría"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">
                          {formatDecimal(item.cantidad)} {item.producto?.unidadMedida}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between items-center">
                <span className="text-lg font-bold">Total Productos</span>
                <span className="text-2xl font-bold text-blue-600">
                  {pedidoDetalle.items?.length || 0} items
                </span>
              </div>

              {pedidoDetalle.notas && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Notas</h4>
                  <p className="text-slate-600">{pedidoDetalle.notas}</p>
                </div>
              )}

              <div className="border-t pt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => generarPDF(pedidoDetalle, "completo")}
                  disabled={generandoPDF}
                >
                  {generandoPDF ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  PDF Completo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generarPDF(pedidoDetalle, "por_proveedor")}
                  disabled={generandoPDF}
                >
                  PDF por Proveedor
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generarPDF(pedidoDetalle, "por_categoria")}
                  disabled={generandoPDF}
                >
                  PDF por Categoría
                </Button>
                <Button variant="outline" onClick={() => exportarCSV(pedidoDetalle)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  CSV pedido
                </Button>
                {(pedidoDetalle.estado === "recibido" || pedidoDetalle.estado === "recibido_parcial") && (
                  <Button variant="outline" onClick={() => exportarCSVRecepcion(pedidoDetalle)}>
                    <Download className="w-4 h-4 mr-2" />
                    CSV recepción
                  </Button>
                )}
                <Button variant="outline" onClick={() => copiarAlPortapapeles(pedidoDetalle)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

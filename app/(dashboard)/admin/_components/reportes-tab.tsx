"use client";

import { useState } from "react";
import { FileText, Download, Loader2, Package, Truck, UtensilsCrossed, Calendar, Clock, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const REPORTS = [
  { id: "inventario", name: "Reporte de Inventario", description: "Stock actual de todos los productos", icon: Package, color: "bg-blue-500" },
  { id: "pedidos", name: "Reporte de Pedidos", description: "Historial de pedidos realizados", icon: Truck, color: "bg-green-500" },
  { id: "consumos", name: "Reporte de Consumos", description: "Movimientos de consumo y merma manual", icon: UtensilsCrossed, color: "bg-orange-500" },
  { id: "consumo-diario", name: "Consumo diario por insumo", description: "Consumo real por comandas TPV y producción, agrupado por día e insumo (últimos 30 días)", icon: BarChart3, color: "bg-purple-500" },
  { id: "caducidades", name: "Reporte de Caducidades", description: "Productos próximos a caducar", icon: Clock, color: "bg-red-500" },
];

export default function ReportesTab() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  const generateReport = async (reportId: string, format: "pdf" | "csv") => {
    try {
      setGenerating(`${reportId}-${format}`);

      const res = await fetch(`/api/reportes/${reportId}?format=${format}`);
      if (!res.ok) throw new Error("Error generando reporte");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${reportId}_${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: "Reporte generado" });
    } catch (error) {
      toast({ title: "Error al generar reporte", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>Reportes</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS.map((report) => (
            <div key={report.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <report.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800">{report.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{report.description}</p>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => generateReport(report.id, "pdf")}
                      disabled={!!generating}
                    >
                      {generating === `${report.id}-pdf` ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateReport(report.id, "csv")}
                      disabled={!!generating}
                    >
                      {generating === `${report.id}-csv` ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      CSV
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

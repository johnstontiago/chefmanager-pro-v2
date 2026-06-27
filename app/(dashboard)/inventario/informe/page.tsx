import { redirect } from "next/navigation";

// El informe se consolidó en /inventario (un único registro de inventario).
// Esta ruta se mantiene como redirección para no romper enlaces antiguos.
export default function InformeRedirect() {
  redirect("/inventario");
}

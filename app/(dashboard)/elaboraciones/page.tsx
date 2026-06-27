import { redirect } from "next/navigation";

// Las elaboraciones se gestionan ahora dentro de Fichas Técnicas.
export default function ElaboracionesRedirect() {
  redirect("/fichas/elaboraciones");
}

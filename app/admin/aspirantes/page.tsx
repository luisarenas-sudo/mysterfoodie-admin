import { redirect } from "next/navigation";

// Los aspirantes ya viven dentro de Invitar (una sola pantalla). Esta ruta se conserva para ligas y correos anteriores.
export default function AspirantesRedirect() {
  redirect("/perfil/invitar?tab=aspirantes");
}

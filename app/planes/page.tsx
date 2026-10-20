import { redirect } from "next/navigation";
import { PACKAGES_URL } from "@/lib/links";

/**
 * La comparativa de planes vive solo en la web (mysterfoodie.com/servicios).
 * Esta ruta ya no es una pantalla de la app: cualquier liga vieja o marcador
 * lleva a la web. Los planes de cada negocio se siguen contratando y
 * administrando desde su ficha en Negocios.
 */
export default function PlanesPage() {
  redirect(PACKAGES_URL);
}

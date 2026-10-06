import { redirect } from "next/navigation";

// Finanzas ahora vive en /finanzas (la ven también Sibaritas y Foodies, cada
// quien con sus propias ganancias). Se deja esta ruta para links viejos.
export default function AdminFinanzasRedirect() {
  redirect("/finanzas");
}

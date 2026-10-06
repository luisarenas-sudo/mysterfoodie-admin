/**
 * Solo acepta rutas internas ("/algo") para el parámetro `next` del login.
 * Sin esto, "//sitio-malo.com" o "https://..." se podían usar para mandar a
 * alguien a otro sitio justo después de iniciar sesión.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

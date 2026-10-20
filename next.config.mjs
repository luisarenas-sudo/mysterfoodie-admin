import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // pdfkit (generación del PDF del reporte completo) lee sus archivos de
  // fuentes internos (.afm) con rutas relativas a su propio paquete en
  // node_modules; si webpack lo empaqueta junto con el resto del server
  // bundle esas rutas se rompen. Se deja fuera del bundle para que se
  // cargue tal cual con require() normal en tiempo de ejecución.
  serverExternalPackages: ["pdfkit"],
  // Lo público vive en mysterfoodie.com; la app (app.mysterfoodie.com) solo
  // redirige los textos legales para que los enlaces viejos sigan sirviendo.
  // Cabeceras de seguridad (OWASP Secure Headers): HTTPS forzado, sin sniffing de tipos, sin incrustarse en otros
  // sitios, referrer mínimo y permisos de dispositivo acotados (la cámara solo para la propia app: fotos de perfil/ticket).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/privacidad", destination: "https://mysterfoodie.com/privacidad/", permanent: true },
      { source: "/terminos", destination: "https://mysterfoodie.com/terminos/", permanent: true },
    ];
  },
};

export default nextConfig;

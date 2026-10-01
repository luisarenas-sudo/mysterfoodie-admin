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
};

export default nextConfig;

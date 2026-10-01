import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type PublicConfig = { supabaseUrl: string; supabaseAnonKey: string };

let cachedConfig: PublicConfig | null = null;
let configPromise: Promise<PublicConfig> | null = null;
let cachedClient: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient> | null = null;

async function getPublicConfig(): Promise<PublicConfig> {
  if (cachedConfig) return cachedConfig;
  if (!configPromise) {
    configPromise = fetch("/api/public-config", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar la configuración pública.");
        return res.json() as Promise<PublicConfig>;
      })
      .then((data) => {
        cachedConfig = data;
        return data;
      })
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

async function buildClient(): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseAnonKey } = await getPublicConfig();
  const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  // Espera a que la sesión termine de cargarse desde las cookies antes de
  // devolver el cliente. @supabase/ssr inicializa la sesión en segundo
  // plano al construir el cliente; si algo la usa de inmediato (como
  // linkIdentity, que necesita la sesión activa ya cargada para saber a
  // qué usuario vincular la cuenta de Google) puede dispararse antes de
  // que esa carga termine. Forzar un getSession() aquí evita esa carrera.
  await client.auth.getSession();
  return client;
}

/**
 * Cliente de Supabase para componentes de cliente (login, set-password,
 * forgot-password, conectar cuenta de Google). Usa la anon key; nunca la
 * service role key.
 *
 * La URL y la anon key se piden en tiempo de ejecución a /api/public-config
 * en vez de leerse directo de `process.env.NEXT_PUBLIC_*`: algunos hostings
 * (GoDaddy Node.js Hosting) solo inyectan esas variables cuando el servidor
 * ya está corriendo, no durante el `next build`, así que un valor leído de
 * `process.env.NEXT_PUBLIC_*` en código de cliente queda "horneado" como
 * vacío en el build. Pedirlo por HTTP evita ese problema.
 *
 * Se reutiliza una sola instancia del cliente (singleton) en vez de crear
 * una nueva en cada llamada: evita repetir el round-trip a
 * /api/public-config y evita la condición de carrera descrita arriba.
 */
export async function createSupabaseBrowserClient(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient;
  if (!clientPromise) {
    clientPromise = buildClient()
      .then((client) => {
        cachedClient = client;
        return client;
      })
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

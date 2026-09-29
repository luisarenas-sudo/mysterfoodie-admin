import { createBrowserClient } from "@supabase/ssr";

type PublicConfig = { supabaseUrl: string; supabaseAnonKey: string };

let cachedConfig: PublicConfig | null = null;
let configPromise: Promise<PublicConfig> | null = null;

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

/**
 * Cliente de Supabase para componentes de cliente (login, set-password,
 * forgot-password). Usa la anon key; nunca la service role key.
 *
 * La URL y la anon key se piden en tiempo de ejecución a /api/public-config
 * en vez de leerse directo de `process.env.NEXT_PUBLIC_*`: algunos hostings
 * (GoDaddy Node.js Hosting) solo inyectan esas variables cuando el servidor
 * ya está corriendo, no durante el `next build`, así que un valor leído de
 * `process.env.NEXT_PUBLIC_*` en código de cliente queda "horneado" como
 * vacío en el build. Pedirlo por HTTP evita ese problema.
 */
export async function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = await getPublicConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

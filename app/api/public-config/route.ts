import { NextResponse } from "next/server";

// No debe cachearse ni pre-renderizarse en build time: las variables que
// lee solo existen de forma confiable cuando el proceso del servidor ya
// está corriendo (ver nota en lib/supabaseBrowser.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return NextResponse.json({ supabaseUrl, supabaseAnonKey });
}

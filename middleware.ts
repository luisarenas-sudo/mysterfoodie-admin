import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/set-password" || pathname === "/forgot-password") return true;
  if (pathname.startsWith("/r/")) return true;
  // Las rutas de API validan su propia sesión con requireRole().
  if (pathname.startsWith("/api/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Sin Supabase configurado no hay forma de saber quién es quién;
  // se deja pasar todo para no tapiar el sitio completo con un error
  // de configuración (las páginas ya muestran su propio aviso).
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as "admin" | "agente" | "cliente" | undefined) ?? "cliente";

  const adminOnly = pathname.startsWith("/negocios") || pathname.startsWith("/admin");
  const agenteOAdmin =
    pathname === "/" ||
    pathname.startsWith("/mis-visitas") ||
    pathname.startsWith("/visitas") ||
    pathname.startsWith("/nueva-visita") ||
    pathname.startsWith("/perfil");
  const clienteOnly = pathname.startsWith("/mi-negocio");

  if (adminOnly && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (agenteOAdmin && role !== "admin" && role !== "agente") {
    return NextResponse.redirect(new URL("/mi-negocio", request.url));
  }
  if (clienteOnly && role !== "cliente") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|logo-wordmark.png|icon-512.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

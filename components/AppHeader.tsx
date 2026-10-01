import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionProfile, createSupabaseServerClient, type Role } from "@/lib/auth";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const NAV_BY_ROLE: Record<Role, { href: string; label: string }[]> = {
  admin: [
    { href: "/", label: "Nueva evaluación" },
    { href: "/negocios", label: "Negocios" },
    { href: "/mis-visitas", label: "Visitas" },
    { href: "/admin/usuarios", label: "Usuarios" },
    { href: "/automatizaciones", label: "Automatizaciones" },
    { href: "/admin/finanzas", label: "Finanzas" },
    { href: "/perfil", label: "Perfil" },
  ],
  agente: [
    { href: "/", label: "Nueva evaluación" },
    { href: "/mis-visitas", label: "Mis visitas" },
    { href: "/perfil", label: "Perfil" },
  ],
  sibarita: [
    { href: "/", label: "Nueva evaluación" },
    { href: "/negocios", label: "Negocios" },
    { href: "/mis-visitas", label: "Mis visitas" },
    { href: "/perfil", label: "Perfil" },
  ],
  cliente: [
    { href: "/mi-negocio", label: "Mi negocio" },
    { href: "/perfil", label: "Perfil" },
  ],
};

export default async function AppHeader() {
  const profile = await getSessionProfile();
  const homeHref = !profile ? "/login" : profile.role === "cliente" ? "/mi-negocio" : "/";

  return (
    <header className="bg-ink">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href={homeHref} className="flex items-center gap-2">
          <Image
            src="/logo-wordmark.png"
            alt="MysterFoodie"
            width={140}
            height={75}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {profile ? (
          <nav className="flex items-center gap-5 text-sm font-medium text-white/80">
            {NAV_BY_ROLE[profile.role].map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            {/* El nombre/correo ya no se repite aquí -- vive dentro de
               Perfil (con avatar, rango, etc.), que ya está en la nav
               de arriba para los 4 roles. */}
            <form action={signOut}>
              <button type="submit" className="text-white/60 hover:text-white">
                Cerrar sesión
              </button>
            </form>
          </nav>
        ) : (
          <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white">
            Iniciar sesión
          </Link>
        )}
      </div>
      <div className="h-1 bg-brand-gradient" />
    </header>
  );
}

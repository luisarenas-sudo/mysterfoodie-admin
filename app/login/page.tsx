import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { safeNextPath } from "@/lib/safeNext";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const nextPath = String(formData.get("next") || "");

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      const qs = new URLSearchParams({ error: signInError.message });
      if (nextPath) qs.set("next", nextPath);
      redirect(`/login?${qs.toString()}`);
    }

    redirect(safeNextPath(nextPath));
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-stone-500">Acceso para el equipo y para negocios registrados.</p>

      {error && (
        <p className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          {ERROR_MESSAGES[error] || error}
        </p>
      )}

      <form action={signIn} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next || ""} />
        <label className="block">
          <span className="text-sm font-medium text-ink">Correo</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input mt-1"
            placeholder="tu@correo.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input mt-1"
          />
        </label>
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Entrar
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">o</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <GoogleSignInButton next={next} />
      <p className="mt-2 text-xs leading-relaxed text-stone-400">
        Entra con Google usando el mismo correo de tu cuenta. ¿Te invitaron y aún no creas tu cuenta? Abre el link del correo de
        invitación: ahí puedes elegir «Crear cuenta con Google».
      </p>
    </main>
  );
}

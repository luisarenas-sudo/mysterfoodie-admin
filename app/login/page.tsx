import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Correo o contrasena incorrectos.",
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

    redirect(nextPath || "/");
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-brand-600">MysterFoodie</p>
      <h1 className="heading mt-2 text-3xl text-ink">Iniciar sesion</h1>
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
            className="input mt-1"
            placeholder="tu@correo.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Contrasena</span>
          <input name="password" type="password" required className="input mt-1" />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

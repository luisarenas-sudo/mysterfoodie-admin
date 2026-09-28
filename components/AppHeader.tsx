import Link from "next/link";
import Image from "next/image";

export default function AppHeader() {
  return (
    <header className="bg-ink">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-wordmark.png"
            alt="MysterFoodie"
            width={140}
            height={75}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <nav className="flex gap-5 text-sm font-medium text-white/80">
          <Link href="/" className="hover:text-white">
            Nueva evaluacion
          </Link>
          <Link href="/negocios" className="hover:text-white">
            Negocios
          </Link>
        </nav>
      </div>
      <div className="h-1 bg-brand-gradient" />
    </header>
  );
}

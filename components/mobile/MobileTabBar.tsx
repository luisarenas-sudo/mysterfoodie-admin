"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const ACTIVE = "#F24444";
const INACTIVE = "rgba(60,60,67,0.45)";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Inicio", key: "home" as const },
    ...(role === "admin" ? [{ href: "/negocios", label: "Negocios", key: "negocios" as const }] : []),
    { href: "/mis-visitas", label: "Reportes", key: "reportes" as const },
    { href: "/perfil", label: "Perfil", key: "perfil" as const },
  ];

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex pt-2"
      style={{
        background: "rgba(249,249,251,0.92)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(60,60,67,0.12)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        height: 83,
      }}
    >
      <Link href="/" className="flex flex-1 flex-col items-center gap-[3px]">
        <svg width="25" height="25" viewBox="0 0 24 24">
          <path
            d="M4 11.5L12 4l8 7.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8.5z"
            fill={isActivePath(pathname, "/") ? ACTIVE : INACTIVE}
          />
        </svg>
        <span className="text-[10.5px] font-semibold" style={{ color: isActivePath(pathname, "/") ? ACTIVE : INACTIVE }}>
          Inicio
        </span>
      </Link>

      {role === "admin" && (
        <Link href="/negocios" className="flex flex-1 flex-col items-center gap-[3px]">
          <svg width="25" height="25" viewBox="0 0 24 24">
            <path
              d="M4 10l1-6h14l1 6M4 10v9a1 1 0 001 1h3v-6h8v6h3a1 1 0 001-1v-9M4 10h16"
              stroke={isActivePath(pathname, "/negocios") ? ACTIVE : INACTIVE}
              strokeWidth="1.8"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="text-[10.5px] font-semibold"
            style={{ color: isActivePath(pathname, "/negocios") ? ACTIVE : INACTIVE }}
          >
            Negocios
          </span>
        </Link>
      )}

      <Link href="/nueva-visita" className="flex flex-1 flex-col items-center gap-[2px]">
        <div
          className="mt-[-26px] flex items-center justify-center rounded-full shadow-lg"
          style={{
            width: 52,
            height: 52,
            background: "linear-gradient(180deg,#F24444 0%,#F25631 100%)",
            border: "3px solid rgba(249,249,251,0.92)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.22)",
          }}
        >
          <Image src="/icon-512.png" alt="" width={26} height={26} className="rounded-sm object-contain" />
        </div>
        <span className="mt-[1px] text-[10.5px] font-semibold" style={{ color: ACTIVE }}>
          Nueva visita
        </span>
      </Link>

      <Link href="/mis-visitas" className="flex flex-1 flex-col items-center gap-[3px]">
        <svg width="25" height="25" viewBox="0 0 24 24">
          <path
            d="M7 3h8l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke={isActivePath(pathname, "/mis-visitas") ? ACTIVE : INACTIVE}
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M9 12h6M9 16h6"
            stroke={isActivePath(pathname, "/mis-visitas") ? ACTIVE : INACTIVE}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span
          className="text-[10.5px] font-semibold"
          style={{ color: isActivePath(pathname, "/mis-visitas") ? ACTIVE : INACTIVE }}
        >
          Reportes
        </span>
      </Link>

      <Link href="/perfil" className="flex flex-1 flex-col items-center gap-[3px]">
        <svg width="25" height="25" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="8"
            r="3.6"
            stroke={isActivePath(pathname, "/perfil") ? ACTIVE : INACTIVE}
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M4.5 20c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"
            stroke={isActivePath(pathname, "/perfil") ? ACTIVE : INACTIVE}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[10.5px] font-semibold" style={{ color: isActivePath(pathname, "/perfil") ? ACTIVE : INACTIVE }}>
          Perfil
        </span>
      </Link>
    </nav>
  );
}

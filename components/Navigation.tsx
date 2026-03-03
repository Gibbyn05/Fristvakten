"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/subscriptions", label: "Abonnementer" },
  { href: "/app/inbox", label: "Innboks" },
  { href: "/app/settings", label: "Innstillinger" },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/app/dashboard" className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            Fristvakt
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-400 max-w-32 truncate">
              {session?.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Logg ut
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden flex gap-1 pb-3 -mx-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                pathname === link.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

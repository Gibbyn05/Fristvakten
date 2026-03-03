"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Feil e-post eller passord. Prøv igjen.");
      setLoading(false);
    } else {
      router.push("/app/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Fristvakt</h1>
          <p className="text-slate-500 text-sm mt-1">Logg inn på kontoen din</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">E-postadresse</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deg@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Passord</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Logger inn…" : "Logg inn"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Har du ikke konto?{" "}
          <Link href="/register" className="text-brand-600 hover:underline font-medium">
            Opprett konto
          </Link>
        </p>
      </div>
    </div>
  );
}

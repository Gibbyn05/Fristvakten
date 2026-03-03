"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Noe gikk galt. Prøv igjen.");
      setLoading(false);
      return;
    }

    // Auto-login after registration
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Konto opprettet, men innlogging feilet. Prøv å logge inn manuelt.");
      setLoading(false);
    } else {
      router.push("/app/settings");
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
          <p className="text-slate-500 text-sm mt-1">Opprett en gratis konto</p>
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
              <label className="label" htmlFor="password">
                Passord <span className="text-slate-400">(min. 8 tegn)</span>
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Oppretter konto…" : "Opprett konto"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Har du allerede konto?{" "}
          <Link href="/login" className="text-brand-600 hover:underline font-medium">
            Logg inn
          </Link>
        </p>
      </div>
    </div>
  );
}

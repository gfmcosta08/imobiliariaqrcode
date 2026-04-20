"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName.trim() || undefined,
                  whatsapp_number: whatsapp.trim() || undefined,
                },
              },
            });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Lado esquerdo — foto */}
      <div
        className="hidden w-1/2 lg:block"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex h-full flex-col justify-between bg-black/30 p-10">
          <Link href="/">
            <span className="text-sm font-bold uppercase tracking-widest text-white">IMOBQR</span>
          </Link>
          <p className="text-2xl font-bold leading-snug text-white">
            A plataforma de QR Code para corretores de imóveis.
          </p>
        </div>
      </div>

      {/* Lado direito — formulário */}
      <div className="flex w-full flex-col items-center justify-center px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <span className="text-sm font-bold uppercase tracking-widest text-gray-900">
                IMOBQR
              </span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "login" ? "Entrar na sua conta" : "Criar conta gratuita"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {mode === "login"
              ? "Acesse seu painel de imóveis e leads."
              : "1 imóvel ativo grátis. Sem cartão de crédito."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {mode === "signup" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#0055d2] focus:ring-1 focus:ring-[#0055d2]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="+55 11 99999-0000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#0055d2] focus:ring-1 focus:ring-[#0055d2]"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#0055d2] focus:ring-1 focus:ring-[#0055d2]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#0055d2] focus:ring-1 focus:ring-[#0055d2]"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0055d2] py-3.5 text-sm font-semibold text-white transition hover:bg-[#0044b0] disabled:opacity-50"
            >
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <button
              type="button"
              className="font-medium text-[#0055d2] transition hover:underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Cadastre-se" : "Entrar"}
            </button>
          </p>

          <p className="mt-8 text-center text-xs text-gray-400">
            <Link href="/" className="transition hover:text-gray-700">
              ← Voltar ao início
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

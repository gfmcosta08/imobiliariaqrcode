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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/">
            <span className="font-display text-2xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50">
              ImobQR
            </span>
          </Link>
        </div>

        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {mode === "login" ? "Entrar na sua conta" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "login"
            ? "Acesse seu painel de imóveis e leads."
            : "Conta gratuita com 1 imóvel ativo."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
          {mode === "signup" ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Nome completo</span>
                <input
                  type="text"
                  autoComplete="name"
                  required={mode === "signup"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border-b border-zinc-300 bg-transparent pb-2 text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-600 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">WhatsApp</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  required={mode === "signup"}
                  placeholder="+55 11 99999-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="border-b border-zinc-300 bg-transparent pb-2 text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-600 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-b border-zinc-300 bg-transparent pb-2 text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-600 dark:text-zinc-50 dark:focus:border-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Senha</span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-b border-zinc-300 bg-transparent pb-2 text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-600 dark:text-zinc-50 dark:focus:border-zinc-100"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-zinc-900 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>

        <p className="mt-8 text-center text-xs text-zinc-400">
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}

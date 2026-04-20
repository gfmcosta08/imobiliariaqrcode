"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) {
          setError(resetError.message);
        } else {
          setInfo("Enviamos um link de recuperação para o seu e-mail. Verifique também a caixa de spam.");
        }
        return;
      }

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
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
        if (!data.session) {
          setInfo("Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // login
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
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

  const titles: Record<Mode, string> = {
    login: "Entrar na sua conta",
    signup: "Criar conta gratuita",
    forgot: "Recuperar senha",
  };
  const subtitles: Record<Mode, string> = {
    login: "Acesse seu painel de imóveis e leads.",
    signup: "1 imóvel ativo grátis. Sem cartão de crédito.",
    forgot: "Informe seu e-mail para receber o link de recuperação.",
  };

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
              <span className="text-sm font-bold uppercase tracking-widest text-gray-900">IMOBQR</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{titles[mode]}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitles[mode]}</p>

          {info ? (
            <div className="mt-6 border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {info}
            </div>
          ) : (
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
                      className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
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
                      className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
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
                  className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

              {mode !== "forgot" ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Senha</label>
                    {mode === "login" ? (
                      <button
                        type="button"
                        className="text-xs text-gray-500 transition hover:text-gray-900"
                        onClick={() => switchMode("forgot")}
                      >
                        Esqueceu a senha?
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-none border border-gray-300 px-4 py-3 pr-11 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="text-sm text-red-600" role="alert">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading
                  ? "Aguarde…"
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link de recuperação"}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-3 text-center text-sm text-gray-500">
            {mode === "login" ? (
              <p>
                Não tem conta?{" "}
                <button
                  type="button"
                  className="font-medium text-black transition hover:underline"
                  onClick={() => switchMode("signup")}
                >
                  Cadastre-se
                </button>
              </p>
            ) : null}
            {mode === "signup" ? (
              <p>
                Já tem conta?{" "}
                <button
                  type="button"
                  className="font-medium text-black transition hover:underline"
                  onClick={() => switchMode("login")}
                >
                  Entrar
                </button>
              </p>
            ) : null}
            {mode === "forgot" ? (
              <p>
                <button
                  type="button"
                  className="font-medium text-black transition hover:underline"
                  onClick={() => switchMode("login")}
                >
                  ← Voltar ao login
                </button>
              </p>
            ) : null}
          </div>

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

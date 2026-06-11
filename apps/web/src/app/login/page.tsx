"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";
type InviteClaimResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
};

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/dashboard";
  }
  return value;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const signupModeUrl = "/login?mode=signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setAcceptedLegal(false);
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
          setInfo(
            "Enviamos um link de recuperação para o seu e-mail. Verifique também a caixa de spam.",
          );
        }
        return;
      }

      if (mode === "signup") {
        if (!acceptedLegal) {
          setError("Voce precisa aceitar os Termos de Uso e a Politica de Privacidade.");
          return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            fullName,
            whatsapp: whatsapp.replace(/\D/g, ""),
            acceptedLegal,
          }),
        });

        let data: { ok?: boolean; error?: string };
        try {
          data = (await res.json()) as { ok?: boolean; error?: string };
        } catch {
          setError("Erro inesperado do servidor. Tente novamente.");
          return;
        }
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Erro ao criar conta.");
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.push(safeNextPath(searchParams.get("next")));
        router.refresh();
        return;
      }

      // login: aceita e-mail normal ou credenciais numéricas de cortesia
      const loginInput = email.trim();
      const isInviteCode = /^\d{6,8}$/.test(loginInput);

      if (isInviteCode) {
        if (!/^\d{6,8}$/.test(password.trim())) {
          setError("Para convite cortesia, a senha deve ter entre 6 e 8 numeros.");
          return;
        }

        const claimRes = await fetch("/api/convite/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login_code: loginInput,
            access_code: password.trim(),
          }),
        });

        let claimData: InviteClaimResponse;
        try {
          claimData = (await claimRes.json()) as InviteClaimResponse;
        } catch {
          setError("Erro inesperado do servidor. Tente novamente.");
          return;
        }
        if (!claimRes.ok || !claimData.ok) {
          const msgs: Record<string, string> = {
            invalid_credentials: "Login ou senha incorretos. Verifique os dados e tente novamente.",
            invitation_already_activated:
              "Este convite ja foi ativado. Entre com o e-mail e a senha criados no cadastro.",
            invitation_completed:
              "Este convite ja foi concluido. Entre com o e-mail e a senha criados no cadastro.",
            invitation_already_used:
              "Este convite ja foi utilizado. Entre com o e-mail e a senha criados no cadastro.",
            invitation_expired: "Este convite expirou. Entre em contato com o suporte.",
            too_many_attempts: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
          };
          setError(msgs[claimData.error ?? ""] ?? "Erro ao validar convite cortesia.");
          return;
        }

        await supabase.auth.setSession({
          access_token: claimData.access_token!,
          refresh_token: claimData.refresh_token!,
        });
        router.push("/onboarding/complete-profile");
        router.refresh();
        return;
      }

      if (!loginInput.includes("@")) {
        setError("No login, informe um e-mail valido ou um codigo de convite numerico.");
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginInput,
        password,
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
            <span className="text-sm font-bold uppercase tracking-widest text-white">
              ImoveisQR
            </span>
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
                ImoveisQR
              </span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{titles[mode]}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitles[mode]}</p>
          {mode === "signup" ? (
            <p className="mt-3 text-xs text-gray-500">
              Conta teste gratuita: 1 imovel ativo, QR Code e painel de leads. Sem cartao de
              credito.
            </p>
          ) : null}

          {info ? (
            <div className="mt-6 border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {info}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              {mode === "signup" ? (
                <>
                  <div>
                    <label
                      htmlFor="signup-full-name"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Nome completo
                    </label>
                    <input
                      id="signup-full-name"
                      type="text"
                      autoComplete="name"
                      data-testid="signup-full-name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="signup-whatsapp"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      WhatsApp
                    </label>
                    <input
                      id="signup-whatsapp"
                      type="tel"
                      autoComplete="tel"
                      data-testid="signup-whatsapp"
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
                <label
                  htmlFor="login-identifier"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {mode === "login" ? "E-mail ou codigo de convite" : "E-mail"}
                </label>
                <input
                  id="login-identifier"
                  type={mode === "login" ? "text" : "email"}
                  inputMode={mode === "login" ? "text" : "email"}
                  autoComplete={mode === "login" ? "username" : "email"}
                  data-testid="login-identifier"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "login" ? "seu@email.com ou 123456" : "seu@email.com"}
                  className="w-full rounded-none border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                />
                {mode === "login" ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Convite cortesia: use os 6 numeros de login e os 6 numeros de senha do cartao.
                  </p>
                ) : null}
              </div>

              {mode !== "forgot" ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                      Senha
                    </label>
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
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      data-testid="login-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-none border border-gray-300 px-4 py-3 pr-11 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="login-toggle-password"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "signup" ? (
                <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-600">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                    className="mt-0.5 h-4 w-4 border-gray-300"
                  />
                  <span>
                    Aceito os{" "}
                    <Link href="/termos" className="font-medium text-black underline">
                      Termos de Uso
                    </Link>{" "}
                    e a{" "}
                    <Link href="/privacidade" className="font-medium text-black underline">
                      Politica de Privacidade
                    </Link>
                    .
                  </span>
                </label>
              ) : null}

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit"
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
            <span className="sr-only">{signupModeUrl}</span>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginPageContent />
    </Suspense>
  );
}

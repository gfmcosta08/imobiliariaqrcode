"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConvitePage() {
  const router = useRouter();
  const [loginCode, setLoginCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/convite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_code: loginCode.trim(), access_code: accessCode.trim() }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!data.ok) {
        const msgs: Record<string, string> = {
          invalid_credentials: "Login ou senha incorretos. Verifique os dados e tente novamente.",
          invitation_already_activated:
            "Este convite ja foi ativado. Entre com o e-mail e a senha criados no cadastro.",
          invitation_completed:
            "Este convite ja foi concluido. Entre com o e-mail e a senha criados no cadastro.",
          invitation_already_used:
            "Este convite ja foi utilizado. Entre com o e-mail e a senha criados no cadastro.",
          invitation_expired: "Este convite expirou. Entre em contato com o suporte.",
        };
        setError(msgs[data.error ?? ""] ?? "Erro inesperado. Tente novamente.");
        return;
      }

      router.push("/onboarding/complete-profile");
    } catch {
      setError("Erro de conexao. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Digite os codigos do seu cartao de cortesia para ativar seu anuncio.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="loginCode" className="block text-sm font-medium text-gray-700 mb-1">
              Codigo de login
            </label>
            <input
              id="loginCode"
              name="loginCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              data-testid="invite-login-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-1">
              Codigo de senha
            </label>
            <input
              id="accessCode"
              name="accessCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              data-testid="invite-access-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading || loginCode.length !== 6 || accessCode.length !== 6}
            data-testid="invite-submit"
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Verificando..." : "Ativar meu anuncio"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Os codigos estao impressos no seu cartao QR Code cortesia.
        </p>
      </div>
    </div>
  );
}

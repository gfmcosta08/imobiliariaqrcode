"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    whatsapp: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }
    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Nome e e-mail sao obrigatorios.");
      return;
    }
    if (!acceptedTerms) {
      setError("Marque que voce leu e aceitou os termos antes de continuar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp,
          password: form.password,
          acceptedTerms: true,
          acceptedPrivacy: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar perfil.");
        return;
      }

      // Mudar senha invalida a sessão atual — reautenticar antes de prosseguir
      const supabase = createClient();
      const normalizedEmail = form.email.trim().toLowerCase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: form.password,
      });
      if (signInError) {
        setError(`Falha ao entrar apos salvar perfil: ${signInError.message}`);
        return;
      }

      router.push("/onboarding/complete-listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Complete seu perfil</h1>
          <p className="text-sm text-gray-500 mt-1">Passo 1 de 2 &mdash; Dados da conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input
              id="onboarding-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              data-testid="onboarding-full-name"
              required
              value={form.fullName}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input
              id="onboarding-email"
              name="email"
              type="email"
              autoComplete="email"
              data-testid="onboarding-email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp (opcional)
            </label>
            <input
              id="onboarding-whatsapp"
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              data-testid="onboarding-whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="(11) 99999-9999"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha *</label>
            <input
              id="onboarding-password"
              name="password"
              type="password"
              autoComplete="new-password"
              data-testid="onboarding-password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              placeholder="Minimo 8 caracteres"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar senha *
            </label>
            <input
              id="onboarding-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              data-testid="onboarding-confirm-password"
              required
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repita a senha"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
              <input
                id="onboarding-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Li e aceito os{" "}
                <a href="/termos" target="_blank" className="font-medium underline">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank" className="font-medium underline">
                  Politica de Privacidade
                </a>
                .
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            data-testid="onboarding-submit"
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? "Salvando..." : "Continuar para o anuncio"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

type InvitationResult = {
  login_code: string;
  access_code: string;
  qr_url: string;
  property_id: string;
  property_count: number;
};

type ApiError = { ok: false; error: string; detail?: string };

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
}

export function InvitationGenerator() {
  const [propertyCount, setPropertyCount] = useState(1);
  const [expirationDays, setExpirationDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_count: propertyCount, expiration_days: expirationDays }),
      });
      const data = (await res.json()) as InvitationResult & ApiError & { ok: boolean };
      if (!data.ok) {
        const err = data as ApiError;
        setError(`${err.error}${err.detail ? `: ${err.detail}` : ""}`);
        return;
      }
      setResult(data);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleNew() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="mt-8 border border-gray-200 p-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
        Gerar convite cortesia
      </h2>

      {!result ? (
        <div className="mt-5">
          <p className="text-sm text-gray-600">
            Configure e gere um QR Code + credenciais de acesso para entregar impresso a um
            corretor.
          </p>

          <div className="mt-4 flex flex-wrap gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">Numero de imoveis (minimo 1)</span>
              <input
                type="number"
                min={1}
                data-testid="admin-invite-property-count"
                value={propertyCount}
                onChange={(e) => setPropertyCount(parsePositiveInteger(e.target.value, 1))}
                className="mt-1 block w-24 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Validade em dias (minimo 1)</span>
              <input
                type="number"
                min={1}
                data-testid="admin-invite-expiration-days"
                value={expirationDays}
                onChange={(e) => setExpirationDays(parsePositiveInteger(e.target.value, 30))}
                className="mt-1 block w-28 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </label>
          </div>

          {error && <p className="mt-3 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            data-testid="admin-invite-generate"
            className="mt-5 bg-black px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Gerando..." : "Gerar convite cortesia"}
          </button>
        </div>
      ) : (
        <div className="mt-5" data-testid="admin-invite-result">
          <div id="print-area" className="border border-gray-200 p-6 print:border-none print:p-0">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <Image
                  src={qrImageUrl(result.qr_url)}
                  alt="QR Code do imovel"
                  width={160}
                  height={160}
                  className="border border-gray-200"
                  unoptimized
                />
              </div>

              <div className="flex-1">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                  Credenciais de acesso
                </p>
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs text-gray-500">Login</span>
                    <span className="font-mono text-3xl font-bold tracking-widest text-gray-900">
                      <span className="sr-only">Login gerado: </span>
                      <span data-testid="admin-invite-login-code">
                      {result.login_code}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Senha</span>
                    <span className="font-mono text-3xl font-bold tracking-widest text-gray-900">
                      <span className="sr-only">Senha gerada: </span>
                      <span data-testid="admin-invite-access-code">
                      {result.access_code}
                      </span>
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  Acesse: <span className="font-medium">{window.location.origin}/convite</span>
                </p>
                {result.property_count > 1 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {result.property_count} imoveis + QR Codes criados neste convite.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
              data-testid="admin-invite-print"
              className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Imprimir
            </button>
            <button
              onClick={handleNew}
              className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
            >
              Gerar outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

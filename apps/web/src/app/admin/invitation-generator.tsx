"use client";

import { useState } from "react";
import Image from "next/image";

type InvitationResult = {
  login_code: string;
  access_code: string;
  qr_url: string;
  property_id: string;
};

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
}

export function InvitationGenerator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations", { method: "POST" });
      const data = (await res.json()) as InvitationResult & { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Erro ao gerar convite.");
        return;
      }
      setResult(data);
    } catch {
      setError("Erro de conexão. Tente novamente.");
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
            Clique para gerar um QR Code + credenciais de acesso para entregar impresso a um
            corretor.
          </p>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2">{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-5 bg-black px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Gerando..." : "Gerar convite cortesia"}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          {/* Área imprimível */}
          <div
            id="print-area"
            className="border border-gray-200 p-6 print:border-none print:p-0"
          >
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* QR Code */}
              <div className="flex-shrink-0">
                <Image
                  src={qrImageUrl(result.qr_url)}
                  alt="QR Code do imóvel"
                  width={160}
                  height={160}
                  className="border border-gray-200"
                  unoptimized
                />
              </div>

              {/* Credenciais */}
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Credenciais de acesso
                </p>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 block">Login</span>
                    <span className="text-3xl font-mono font-bold text-gray-900 tracking-widest">
                      {result.login_code}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Senha</span>
                    <span className="text-3xl font-mono font-bold text-gray-900 tracking-widest">
                      {result.access_code}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  Acesse: <span className="font-medium">{window.location.origin}/convite</span>
                </p>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="mt-4 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
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

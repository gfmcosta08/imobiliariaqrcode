"use client";

import { useRef, useState } from "react";

import { buildConvitePrintTitle } from "../lib/convite-print";

type InvitationResult = {
  login_code: string;
  access_code: string;
  qr_url: string;
  property_id: string;
  public_id: string | null;
  property_count: number;
};

type ApiError = { ok: false; error: string; detail?: string };

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function qrImageUrl(data: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function InvitationGenerator() {
  const [propertyCount, setPropertyCount] = useState(1);
  const [expirationDays, setExpirationDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

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
    const printArea = printAreaRef.current;
    if (!result || !printArea) return;

    const printTitle = buildConvitePrintTitle(result.public_id);
    const previousTitle = document.title;
    document.title = printTitle;

    const iframe = document.createElement("iframe");
    iframe.style.border = "0";
    iframe.style.bottom = "0";
    iframe.style.height = "0";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.width = "0";
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const doc = printWindow?.document;
    if (!doc || !printWindow) {
      document.title = previousTitle;
      iframe.remove();
      return;
    }

    doc.write(`<!doctype html>
      <html>
        <head>
          <title>${printTitle}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              background: #fff;
              margin: 0;
              min-height: auto;
              padding: 0;
            }
            body {
              align-items: center;
              display: flex;
              justify-content: center;
            }
            .convite-print-area {
              border: 0 !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              max-width: 210mm !important;
              padding: 10mm 15mm !important;
              width: 210mm !important;
              break-after: avoid;
              break-before: avoid;
              break-inside: avoid;
              page-break-after: avoid;
              page-break-before: avoid;
              page-break-inside: avoid;
            }
            .convite-screen-only { display: none !important; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>${printArea.outerHTML}</body>
      </html>`);
    doc.close();
    doc.title = printTitle;

    let cleanedUp = false;
    let fallbackTimeoutId: number | undefined;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (fallbackTimeoutId !== undefined) {
        window.clearTimeout(fallbackTimeoutId);
      }
      document.title = previousTitle;
      iframe.remove();
    };

    printWindow.addEventListener("afterprint", cleanup, { once: true });

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      fallbackTimeoutId = window.setTimeout(cleanup, 120_000);
    }, 500);
  }

  function handleNew() {
    setResult(null);
    setError(null);
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

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
          <div
            ref={printAreaRef}
            data-testid="admin-invite-print-area"
            className="convite-print-area border border-gray-200 bg-white p-6"
          >
            <div className="convite-print-content flex flex-col items-center">
              <div className="mb-5 flex flex-col items-center">
                <img
                  src="/brand/qr-sign-logo-black-blue.png"
                  alt="ImoveisQR"
                  width={140}
                  height={55}
                  className="mb-2"
                />
              </div>

              <div className="mb-5">
                <img
                  src={qrImageUrl(result.qr_url, 240)}
                  alt="QR Code de acesso"
                  width={240}
                  height={240}
                  className="border border-gray-200"
                />
              </div>

              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                Credenciais de acesso
              </p>

              <div className="space-y-3 text-center">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-gray-500">
                    Login
                  </span>
                  <span
                    className="font-mono text-3xl font-bold tracking-widest text-gray-900"
                    data-testid="admin-invite-login-code-print"
                  >
                    {result.login_code}
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-gray-500">
                    Senha
                  </span>
                  <span
                    className="font-mono text-3xl font-bold tracking-widest text-gray-900"
                    data-testid="admin-invite-access-code-print"
                  >
                    {result.access_code}
                  </span>
                </div>
                {result.public_id ? (
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-gray-500">
                      ID do imovel
                    </span>
                    <span
                      className="font-mono text-xl font-bold tracking-wider text-gray-900"
                      data-testid="admin-invite-public-id-print"
                    >
                      {result.public_id}
                    </span>
                  </div>
                ) : null}
              </div>

              <p className="mt-5 text-sm font-medium text-gray-700">Acesse: {appUrl}/convite</p>

              {result.property_count > 1 && (
                <p className="mt-2 text-xs text-gray-500">
                  {result.property_count} imoveis + QR Codes criados neste convite.
                </p>
              )}
            </div>
          </div>

          <div className="convite-screen-only mt-4 flex gap-3">
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

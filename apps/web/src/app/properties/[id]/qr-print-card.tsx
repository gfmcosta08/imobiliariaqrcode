"use client";

import { useRef } from "react";

type QrPrintCardProps = {
  publicId: string | null;
  internalCode: string | null;
  publicQrUrl: string;
  qrReads: number;
};

const QR_LEFT = "52%";
const QR_TOP = "60%";
const QR_WIDTH = "37%";
const QR_PADDING = "2%";

function qrImageUrl(data: string, size = 360): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function QrPrintCard({ publicId, internalCode, publicQrUrl, qrReads }: QrPrintCardProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const printablePublicId = publicId?.trim() || "sem ID";
  const printableInternalCode = internalCode?.trim() || "nao informado";

  function handlePrint() {
    const printArea = printAreaRef.current;
    if (!printArea) return;

    const iframe = document.createElement("iframe");
    iframe.style.border = "0";
    iframe.style.bottom = "0";
    iframe.style.height = "0";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.width = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.write(`<!doctype html>
      <html>
        <head>
          <title>Placa ${printablePublicId}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              align-items: flex-start;
              background: #fff;
              color: #111827;
              display: flex;
              font-family: Arial, sans-serif;
              justify-content: center;
              margin: 0;
              min-height: auto;
              padding: 0;
            }
            .qr-print-area {
              border: 0 !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              max-width: 150mm !important;
              padding: 0 !important;
              width: 150mm !important;
            }
            img { max-width: 100%; }
          </style>
        </head>
        <body>${printArea.outerHTML}</body>
      </html>`);
    doc.close();

    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    }, 500);
  }

  return (
    <div className="mt-6 border border-gray-200 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            QR Code ativo
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Leituras acumuladas: <span className="font-semibold text-gray-900">{qrReads}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          data-testid="qr-print-button"
          className="qr-screen-only bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Imprimir PDF
        </button>
      </div>

      <div
        ref={printAreaRef}
        data-testid="qr-print-area"
        className="qr-print-area mt-5 max-w-[420px] border border-gray-200 bg-white p-5 text-gray-950 shadow-sm print:shadow-none"
        style={{
          background: "#ffffff",
          color: "#111827",
          maxWidth: "420px",
          padding: "20px",
          width: "100%",
        }}
      >
        <div className="mx-auto w-full max-w-[320px]" style={{ margin: "0 auto", maxWidth: 320, width: "100%" }}>
          <div className="relative aspect-square w-full" style={{ aspectRatio: "1 / 1", position: "relative", width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/qr-sign-logo-black-blue-frame.png"
              alt="Logo da placa do QR"
              className="h-full w-full object-contain"
              style={{ height: "100%", objectFit: "contain", width: "100%" }}
            />
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 bg-white"
              style={{
                background: "#ffffff",
                left: QR_LEFT,
                padding: QR_PADDING,
                position: "absolute",
                top: QR_TOP,
                transform: "translate(-50%, -50%)",
                width: QR_WIDTH,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl(publicQrUrl)}
                alt="QR Code do imovel embutido na logo"
                className="h-full w-full"
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>
        </div>

        <div
          className="mt-4 border-t border-gray-200 pt-4 text-sm"
          style={{
            borderTop: "1px solid #e5e7eb",
            fontSize: "14px",
            marginTop: "16px",
            paddingTop: "16px",
          }}
        >
          <p data-testid="qr-print-public-id">
            <span className="font-semibold">ID do sistema:</span> {printablePublicId}
          </p>
          <p className="mt-1" data-testid="qr-print-internal-code">
            <span className="font-semibold">Codigo interno:</span> {printableInternalCode}
          </p>
          <p className="mt-3 break-all text-xs text-gray-500" data-testid="qr-print-public-url">
            {publicQrUrl}
          </p>
        </div>
      </div>
    </div>
  );
}

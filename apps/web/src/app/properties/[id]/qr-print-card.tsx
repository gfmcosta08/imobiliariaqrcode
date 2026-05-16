"use client";

import { useRef } from "react";

type QrPrintCardProps = {
  publicId: string | null;
  internalCode: string | null;
  publicQrUrl: string;
  qrReads: number;
};

type PlateTemplate = {
  id: "vertical" | "horizontal";
  label: string;
  helper: string;
  src: string;
  aspectRatio: string;
  maxWidth: number;
  printPage: "A4 portrait" | "A4 landscape";
  printWidth: string;
  qrBox: {
    left: string;
    top: string;
    width: string;
  };
};

const PLATE_TEMPLATES: PlateTemplate[] = [
  {
    id: "vertical",
    label: "Placa vertical",
    helper: "Formato vertical para placa de imobiliaria.",
    src: "/brand/qr-sign-template-vertical.jpeg",
    aspectRatio: "2110 / 2984",
    maxWidth: 420,
    printPage: "A4 portrait",
    printWidth: "210mm",
    qrBox: {
      left: "21.2%",
      top: "7.8%",
      width: "57.5%",
    },
  },
  {
    id: "horizontal",
    label: "Placa A4 horizontal",
    helper: "Formato A4 horizontal para impressao rapida.",
    src: "/brand/qr-sign-template-a4-horizontal.jpeg",
    aspectRatio: "2984 / 2110",
    maxWidth: 680,
    printPage: "A4 landscape",
    printWidth: "297mm",
    qrBox: {
      left: "5.5%",
      top: "16%",
      width: "42.5%",
    },
  },
];

function qrImageUrl(data: string, size = 900): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function testId(base: string, template: PlateTemplate) {
  return template.id === "vertical" ? base : `${base}-${template.id}`;
}

export function QrPrintCard({ publicId, internalCode, publicQrUrl, qrReads }: QrPrintCardProps) {
  const printAreaRefs = useRef<Record<PlateTemplate["id"], HTMLDivElement | null>>({
    vertical: null,
    horizontal: null,
  });
  const printablePublicId = publicId?.trim() || "sem ID";
  const printableInternalCode = internalCode?.trim() || "nao informado";

  function handlePrint(template: PlateTemplate) {
    const printArea = printAreaRefs.current[template.id];
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
          <title>Placa ${printablePublicId} - ${template.label}</title>
          <style>
            @page { size: ${template.printPage}; margin: 0; }
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
            .qr-print-area {
              border: 0 !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              max-width: ${template.printWidth} !important;
              padding: 0 !important;
              width: ${template.printWidth} !important;
            }
            .qr-print-card-shell {
              border: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
            .qr-screen-only { display: none !important; }
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
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            O QR grande identifica este anuncio. O QR pequeno dentro da casinha e apenas ilustrativo
            e permanece fixo na arte.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        {PLATE_TEMPLATES.map((template) => (
          <div key={template.id} className="qr-print-card-shell border border-gray-200 bg-white p-4 shadow-sm">
            <div className="qr-screen-only mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-950">{template.label}</h3>
                <p className="mt-1 text-xs text-gray-500">{template.helper}</p>
              </div>
              <button
                type="button"
                onClick={() => handlePrint(template)}
                data-testid={testId("qr-print-button", template)}
                className="bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Imprimir PDF
              </button>
            </div>

            <div
              ref={(node) => {
                printAreaRefs.current[template.id] = node;
              }}
              data-testid={testId("qr-print-area", template)}
              className="qr-print-area bg-white text-gray-950"
              style={{
                background: "#ffffff",
                color: "#111827",
                maxWidth: template.maxWidth,
                width: "100%",
              }}
            >
              <div
                className="relative w-full overflow-hidden bg-white"
                style={{ aspectRatio: template.aspectRatio, position: "relative", width: "100%" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.src}
                  alt={`Modelo ${template.label}`}
                  className="h-full w-full object-cover"
                  style={{ height: "100%", objectFit: "cover", width: "100%" }}
                />
                <div
                  data-testid={testId("qr-overlay-box", template)}
                  className="absolute bg-white"
                  style={{
                    background: "#ffffff",
                    left: template.qrBox.left,
                    padding: "0.8%",
                    position: "absolute",
                    top: template.qrBox.top,
                    width: template.qrBox.width,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl(publicQrUrl)}
                    alt="QR Code real do anuncio"
                    className="h-full w-full"
                    style={{ display: "block", height: "100%", width: "100%" }}
                  />
                </div>
              </div>

              <div className="qr-screen-only mt-3 border-t border-gray-200 pt-3 text-sm">
                <p data-testid={testId("qr-print-public-id", template)}>
                  <span className="font-semibold">ID do sistema:</span> {printablePublicId}
                </p>
                <p className="mt-1" data-testid={testId("qr-print-internal-code", template)}>
                  <span className="font-semibold">Codigo interno:</span> {printableInternalCode}
                </p>
                <p className="mt-3 break-all text-xs text-gray-500" data-testid={testId("qr-print-public-url", template)}>
                  {publicQrUrl}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

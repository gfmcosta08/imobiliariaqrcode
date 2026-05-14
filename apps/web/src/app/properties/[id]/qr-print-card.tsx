"use client";

type QrPrintCardProps = {
  publicId: string | null;
  internalCode: string | null;
  publicQrUrl: string;
  qrReads: number;
};

function qrImageUrl(data: string, size = 360): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function QrPrintCard({ publicId, internalCode, publicQrUrl, qrReads }: QrPrintCardProps) {
  const printablePublicId = publicId?.trim() || "sem ID";
  const printableInternalCode = internalCode?.trim() || "nao informado";

  function handlePrint() {
    document.body.classList.add("printing-qr-plate");
    const cleanup = () => {
      document.body.classList.remove("printing-qr-plate");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.print();
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
          className="qr-screen-only bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Imprimir PDF
        </button>
      </div>

      <div className="qr-print-area mt-5 max-w-[420px] border border-gray-200 bg-white p-5 text-gray-950 shadow-sm print:shadow-none">
        <div className="mx-auto w-full max-w-[320px]">
          <div className="relative aspect-square w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/qr-sign-logo-black-blue.png"
              alt="Logo da placa do QR"
              className="h-full w-full object-contain"
            />
            <div className="absolute left-1/2 top-[57%] w-[43%] -translate-x-1/2 -translate-y-1/2 bg-white p-[2.5%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl(publicQrUrl)}
                alt="QR Code do imovel embutido na logo"
                className="h-full w-full"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4 text-sm">
          <p>
            <span className="font-semibold">ID do sistema:</span> {printablePublicId}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Codigo interno:</span> {printableInternalCode}
          </p>
          <p className="mt-3 break-all text-xs text-gray-500">{publicQrUrl}</p>
        </div>
      </div>
    </div>
  );
}

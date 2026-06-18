"use client";

import Link from "next/link";

type LgpdBannerProps = {
  onAccept: () => void;
};

export function LgpdBanner({ onAccept }: LgpdBannerProps) {
  return (
    <div
      className="border-b border-gray-200 bg-gray-50 p-4"
      data-testid="chat-lgpd-banner"
      role="region"
      aria-label="Consentimento LGPD"
    >
      <p className="text-sm text-gray-700">
        Esta conversa e registrada para melhorar nosso atendimento. Ao continuar, voce concorda com
        nossa{" "}
        <Link href="/privacidade" className="font-medium text-black underline">
          Politica de Privacidade
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={onAccept}
        data-testid="chat-lgpd-accept"
        className="mt-3 w-full bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        Aceitar e conversar
      </button>
    </div>
  );
}

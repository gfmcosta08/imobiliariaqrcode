import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Site em manutenção | ImoveisQR",
  description: "O ImoveisQR está temporariamente indisponível para manutenção.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] px-6 py-10 text-[#1a1a1a]">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#d6d2c4] bg-white shadow-sm">
          <span className="text-2xl font-semibold">QR</span>
        </div>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#5d6b61]">
          Manutenção programada
        </p>

        <h1 className="font-display text-4xl font-semibold leading-tight text-[#111111] sm:text-6xl">
          Estamos fazendo alguns ajustes.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-[#555555] sm:text-lg">
          O site do ImoveisQR está temporariamente indisponível para manutenção.
          Nossa equipe está trabalhando para restabelecer o acesso o quanto antes.
        </p>

        <div className="mt-10 border-t border-[#d6d2c4] pt-6 text-sm leading-6 text-[#666666]">
          Agradecemos a compreensão.
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/plans" />
      <main className="mx-auto max-w-5xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Escolha o plano que melhor se adapta às suas necessidades.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* SOLO */}
          <div className="border border-gray-200 p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Plano</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Solo</h2>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              R$&nbsp;150<span className="text-base font-normal text-gray-400"> único</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">Validade: 120 dias</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> 1 anúncio ativo
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> 1 placa QR Code inclusa
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Bot WhatsApp automático
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Captura de leads
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-500"
            >
              Contratar Solo
            </Link>
          </div>

          {/* PRO */}
          <div className="border-2 border-black p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-black">Plano</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Pro</h2>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              R$&nbsp;500<span className="text-base font-normal text-gray-400">/mês</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">Renovação mensal</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Múltiplos imóveis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Kit inicial: 10 placas QR Code
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Placas adicionais cobradas à parte
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Bot WhatsApp + leads ilimitados
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Dashboard de métricas
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Assinar Pro →
            </Link>
          </div>

          {/* PREMIUM */}
          <div className="border border-gray-200 p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Plano</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Premium</h2>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              R$&nbsp;1.000<span className="text-base font-normal text-gray-400">/mês</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">Renovação mensal</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Múltiplos imóveis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Múltiplos corretores
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Kit inicial: 20 placas QR Code
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Placas adicionais cobradas à parte
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Bot WhatsApp + leads ilimitados
              </li>
              <li className="flex items-start gap-2">
                <span className="text-black">✓</span> Dashboard de métricas completo
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-500"
            >
              Assinar Premium
            </Link>
          </div>
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Pagamentos via Stripe ou Mercado Pago. Em implantação.
        </p>
      </main>
    </div>
  );
}

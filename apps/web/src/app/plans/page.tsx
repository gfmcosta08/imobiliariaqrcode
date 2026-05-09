import { AppHeader } from "@/components/app-header";
import Link from "next/link";
import type { StripePlanCode } from "@/lib/stripe";

import { CheckoutButton } from "./checkout-button";
import { TrialButton } from "./trial-button";

type PaidPlan = {
  code: StripePlanCode;
  name: string;
  price: string;
  suffix: string;
  note: string;
  featured: boolean;
  label: string;
  features: string[];
};

const paidPlans: PaidPlan[] = [
  {
    code: "solo",
    name: "Solo",
    price: "R$ 150",
    suffix: " trimestral",
    note: "Validade: 3 meses",
    featured: false,
    label: "Contratar Solo",
    features: [
      "1 anuncio ativo",
      "1 placa QR Code inclusa",
      "Bot WhatsApp automatico",
      "Captura de leads",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    price: "R$ 500",
    suffix: "/mes",
    note: "Renovacao mensal automatica",
    featured: true,
    label: "Assinar Pro",
    features: [
      "Multiplos imoveis",
      "Kit inicial: 10 placas QR Code",
      "Bot WhatsApp + leads ilimitados",
    ],
  },
  {
    code: "premium",
    name: "Premium",
    price: "R$ 2.000",
    suffix: "/mes",
    note: "Renovacao mensal automatica",
    featured: false,
    label: "Assinar Premium",
    features: [
      "Multiplos imoveis",
      "5 corretores",
      "Kit inicial: 20 placas QR Code",
      "Bot WhatsApp + leads ilimitados",
    ],
  },
];

function cardClass(featured = false) {
  return featured ? "border-2 border-black p-8" : "border border-gray-200 p-8";
}

function eyebrowClass(featured = false) {
  return featured
    ? "text-xs font-bold uppercase tracking-widest text-black"
    : "text-xs font-bold uppercase tracking-widest text-gray-400";
}

function secondaryButtonClass(featured = false) {
  return featured
    ? "mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
    : "mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-500 disabled:opacity-50";
}

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/plans" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Escolha entre testar por 30 dias ou contratar um plano.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/properties/new"
            className="bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Cadastrar imóvel
          </Link>
          <Link
            href="/properties"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Meus imóveis
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cardClass(false)}>
            <p className={eyebrowClass(false)}>Plano</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Teste</h2>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              R$ 0<span className="text-base font-normal text-gray-400"> por 30 dias</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">Sem cobranca Stripe</p>
            <ul className="mt-6 space-y-3 text-sm text-gray-600">
              {[
                "1 anuncio ativo",
                "1 placa QR Code inclusa",
                "Bot WhatsApp automatico",
                "Captura de leads",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="text-black">✓</span> {feature}
                </li>
              ))}
            </ul>
            <TrialButton className={secondaryButtonClass(false)} />
          </div>

          {paidPlans.map((plan) => (
            <div key={plan.code} className={cardClass(plan.featured)}>
              <p className={eyebrowClass(plan.featured)}>Plano</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{plan.name}</h2>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {plan.price}
                <span className="text-base font-normal text-gray-400">{plan.suffix}</span>
              </p>
              <p className="mt-2 text-xs text-gray-400">{plan.note}</p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-black">✓</span> {feature}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                planCode={plan.code}
                label={plan.label}
                className={secondaryButtonClass(plan.featured)}
              />
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Pagamentos processados com seguranca via Stripe. O teste gratuito pode ser usado uma vez
          por conta.
        </p>
      </main>
    </div>
  );
}

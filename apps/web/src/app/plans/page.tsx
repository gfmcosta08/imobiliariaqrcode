import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { StripePlanCode } from "@/lib/stripe";

import { CheckoutButton } from "./checkout-button";
import { TrialButton } from "./trial-button";

type PlanDisplay = {
  plan_code: "trial" | StripePlanCode;
  display_name: string;
  display_price: string;
  display_suffix: string;
  display_note: string;
  display_label: string;
  display_featured: boolean;
  features: string[];
};

const DEFAULT_PLANS: PlanDisplay[] = [
  {
    plan_code: "trial",
    display_name: "Teste",
    display_price: "R$ 0",
    display_suffix: " por 30 dias",
    display_note: "Sem cobranca Stripe",
    display_label: "Comecar teste",
    display_featured: false,
    features: [
      "1 anuncio ativo",
      "1 placa QR Code inclusa",
      "Bot WhatsApp automatico",
      "Captura de leads",
    ],
  },
  {
    plan_code: "solo",
    display_name: "Solo",
    display_price: "R$ 150",
    display_suffix: " trimestral",
    display_note: "Validade: 3 meses",
    display_label: "Contratar Solo",
    display_featured: false,
    features: [
      "1 anuncio ativo",
      "1 placa QR Code inclusa",
      "Bot WhatsApp automatico",
      "Captura de leads",
    ],
  },
  {
    plan_code: "pro",
    display_name: "Pro",
    display_price: "R$ 500",
    display_suffix: "/mes",
    display_note: "Renovacao mensal automatica",
    display_label: "Assinar Pro",
    display_featured: true,
    features: [
      "Multiplos imoveis",
      "Kit inicial: 10 placas QR Code",
      "Bot WhatsApp + leads ilimitados",
    ],
  },
  {
    plan_code: "premium",
    display_name: "Premium",
    display_price: "R$ 2.000",
    display_suffix: "/mes",
    display_note: "Renovacao mensal automatica",
    display_label: "Assinar Premium",
    display_featured: false,
    features: [
      "Multiplos imoveis",
      "5 corretores",
      "Kit inicial: 20 placas QR Code",
      "Bot WhatsApp + leads ilimitados",
    ],
  },
];

const PLAN_ORDER = ["trial", "solo", "pro", "premium"];

function cardClass(featured = false) {
  return featured ? "border-2 border-black p-8" : "border border-gray-200 p-8";
}

function eyebrowClass(featured = false) {
  return featured
    ? "text-xs font-bold uppercase tracking-widest text-black"
    : "text-xs font-bold uppercase tracking-widest text-gray-400";
}

function buttonClass(featured = false) {
  return featured
    ? "mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
    : "mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-500 disabled:opacity-50";
}

async function getPlans(): Promise<PlanDisplay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_display_config").select("*");
  if (error || !data?.length) return DEFAULT_PLANS;

  const byCode = new Map(DEFAULT_PLANS.map((plan) => [plan.plan_code, plan]));
  for (const plan of data as PlanDisplay[]) {
    byCode.set(plan.plan_code, plan);
  }

  return Array.from(byCode.values()).sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code),
  );
}

export default async function PlansPage() {
  const plans = await getPlans();

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
            Cadastrar imovel
          </Link>
          <Link
            href="/properties"
            className="border border-gray-300 px-5 py-2.5 text-sm text-gray-700 transition hover:border-gray-500"
          >
            Meus imoveis
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.plan_code} className={cardClass(plan.display_featured)}>
              <p className={eyebrowClass(plan.display_featured)}>Plano</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{plan.display_name}</h2>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {plan.display_price}
                <span className="text-base font-normal text-gray-400">
                  {plan.display_suffix}
                </span>
              </p>
              {plan.display_note ? (
                <p className="mt-2 text-xs text-gray-400">{plan.display_note}</p>
              ) : null}
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-black">OK</span> {feature}
                  </li>
                ))}
              </ul>
              {plan.plan_code === "trial" ? (
                <TrialButton className={buttonClass(plan.display_featured)} />
              ) : (
                <CheckoutButton
                  planCode={plan.plan_code}
                  label={plan.display_label}
                  className={buttonClass(plan.display_featured)}
                />
              )}
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

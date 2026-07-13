import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  FREE_ACTIVE_PROPERTY_LIMIT,
  PLAN_IMAGES_PER_PROPERTY_LIMIT,
  STARTER_ACTIVE_PROPERTY_LIMIT,
  STARTER_IMPORT_BATCHES_PER_MONTH,
} from "../lib/plans";
import { createClient } from "@/lib/supabase/server";

import { CheckoutButton } from "../components/CheckoutButton";

type PlanCode = "free" | "starter";

type PlanDisplay = {
  plan_code: PlanCode;
  display_name: string;
  display_price: string;
  display_suffix: string;
  display_note: string;
  display_description: string;
  display_label: string;
  display_featured: boolean;
  features: string[];
};

const DEFAULT_PLANS: PlanDisplay[] = [
  {
    plan_code: "free",
    display_name: "Free",
    display_price: "R$ 0",
    display_suffix: " sem recorrencia",
    display_note: "Plano legado ativo",
    display_description: `Plano de entrada para manter ${FREE_ACTIVE_PROPERTY_LIMIT} anuncio ativo com QR.`,
    display_label: "Checkout indisponivel",
    display_featured: false,
    features: [
      `${FREE_ACTIVE_PROPERTY_LIMIT} anuncio ativo`,
      `${PLAN_IMAGES_PER_PROPERTY_LIMIT} imagens no anuncio`,
      "QR Code com atendimento via WhatsApp",
      "Sem renovacao automatica",
    ],
  },
  {
    plan_code: "starter",
    display_name: "Starter",
    display_price: "R$ 150",
    display_suffix: "/mes",
    display_note: "Renovacao mensal automatica",
    display_description: `Plano mensal para corretor solo: ate ${STARTER_ACTIVE_PROPERTY_LIMIT} anuncios ativos, QR por anuncio e captura de leads.`,
    display_label: "Contratar Starter",
    display_featured: true,
    features: [
      `Ate ${STARTER_ACTIVE_PROPERTY_LIMIT} anuncios ativos`,
      `${PLAN_IMAGES_PER_PROPERTY_LIMIT} imagens por anuncio`,
      "QR Code por anuncio ativo",
      `Ate ${STARTER_IMPORT_BATCHES_PER_MONTH} importacoes assistidas por mes no piloto`,
      "Painel de oportunidades",
    ],
  },
];

const PLAN_ORDER: PlanCode[] = ["free", "starter"];

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
    ? "mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
    : "mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 disabled:opacity-70";
}

async function getPlans(): Promise<PlanDisplay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_display_config").select("*");
  if (error || !data?.length) return DEFAULT_PLANS;

  const byCode = new Map(DEFAULT_PLANS.map((plan) => [plan.plan_code, plan]));
  for (const plan of data as Array<PlanDisplay | { plan_code: string }>) {
    if (!PLAN_ORDER.includes(plan.plan_code as PlanCode)) continue;
    const code = plan.plan_code as PlanCode;
    const fallback = byCode.get(code);
    byCode.set(code, {
      ...fallback,
      ...(plan as Partial<PlanDisplay>),
      plan_code: code,
      display_description:
        (plan as Partial<PlanDisplay>).display_description ?? fallback?.display_description ?? "",
      display_label: (plan as Partial<PlanDisplay>).display_label ?? "Checkout indisponivel",
    } as PlanDisplay);
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
          Escolha o plano ideal para gerar QR, capturar leads e acompanhar oportunidades.
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

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.plan_code} className={cardClass(plan.display_featured)}>
              <p className={eyebrowClass(plan.display_featured)}>Plano</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{plan.display_name}</h2>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {plan.display_price}
                <span className="text-base font-normal text-gray-400">{plan.display_suffix}</span>
              </p>
              {plan.display_note ? (
                <p className="mt-2 text-xs text-gray-400">{plan.display_note}</p>
              ) : null}
              {plan.display_description ? (
                <p className="mt-4 text-sm leading-6 text-gray-600">{plan.display_description}</p>
              ) : null}
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-black">OK</span> {feature}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                label={plan.display_label || "Checkout indisponivel"}
                className={buttonClass(plan.display_featured)}
                enabled={plan.plan_code === "starter"}
              />
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Checkout Stripe em modo teste no staging. Planos para equipes ficam em piloto fechado
          depois de prova de uso do Starter.
        </p>
      </main>
    </div>
  );
}

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LEGAL_ENTITY } from "@/lib/legal-entity";
import { createClient } from "@/lib/supabase/server";

import { CheckoutButton } from "./checkout-button";

type PlanCode = "free" | "solo" | "pro";

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
    display_description: "Plano de entrada para manter 1 anuncio ativo.",
    display_label: "Checkout indisponivel",
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
    display_description:
      "Plano trimestral para manter um anuncio ativo com QR Code e captura de leads.",
    display_label: "Checkout indisponivel",
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
    display_description: "Plano mensal para operar varios imoveis com leads ilimitados.",
    display_label: "Checkout indisponivel",
    display_featured: true,
    features: [
      "Multiplos imoveis",
      "Kit inicial: 10 placas QR Code",
      "Bot WhatsApp + leads ilimitados",
    ],
  },
];

const PLAN_ORDER: PlanCode[] = ["free", "solo", "pro"];

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
          Catalogo temporario sem checkout online. Para contratacao, fale com o time comercial.
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
              <CheckoutButton className={buttonClass(plan.display_featured)} />
            </div>
          ))}
        </div>

        <section className="mt-10 border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <h2 className="font-semibold">Contratacao comercial temporaria</h2>
          <p className="mt-2">
            O checkout online esta desativado. Antes de contratar, confirme por escrito o preco
            total, a periodicidade, a renovacao, os beneficios, o cancelamento e as condicoes de
            reembolso. Atendimento eletronico:{" "}
            <a className="font-medium underline" href={`mailto:${LEGAL_ENTITY.supportEmail}`}>
              {LEGAL_ENTITY.supportEmail}
            </a>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link className="font-medium underline" href="/termos">
              Termos de Uso
            </Link>
            <Link className="font-medium underline" href="/privacidade">
              Privacidade
            </Link>
            <Link className="font-medium underline" href="/remocao-de-conteudo">
              Remocao de conteudo
            </Link>
            <Link className="font-medium underline" href="/cancelamento-e-reembolso">
              Cancelamento e reembolso
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

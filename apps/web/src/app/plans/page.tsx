import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LEGAL_ROUTES, SUPPORT_EMAIL } from "@/lib/legal";
import { CHECKOUT_PLAN_CODE } from "@/lib/plans";
import { isStripeKeyAllowedForEnvironment } from "@/lib/stripe-guard";
import { createClient } from "@/lib/supabase/server";

import { CheckoutButton } from "./checkout-button";

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
    display_suffix: " por 30 dias",
    display_note: "Sem cobranca automatica",
    display_description:
      "Avaliacao gratuita por 30 dias com 1 anuncio ativo. Apos o periodo, assine o Starter.",
    display_label: "Comecar gratis",
    display_featured: false,
    features: [
      "1 anuncio ativo",
      "QR Code e captura de leads",
      "Bot WhatsApp automatico",
      "Sem renovacao automatica",
    ],
  },
  {
    plan_code: "starter",
    display_name: "Starter",
    display_price: "R$ 150",
    display_suffix: "/mes",
    display_note: "Renovacao mensal automatica",
    display_description:
      "Anuncios ilimitados com QR Code, leads, bot e demais beneficios. Cancele quando quiser.",
    display_label: "Assinar Starter",
    display_featured: true,
    features: [
      "Anuncios ilimitados",
      "QR Codes",
      "Captura de leads",
      "Bot WhatsApp",
      "Cancelamento simples",
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
    ? "mt-0 inline-block w-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-70"
    : "mt-0 inline-block w-full border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 disabled:opacity-70";
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
      display_label: (plan as Partial<PlanDisplay>).display_label ?? fallback?.display_label ?? "",
    } as PlanDisplay);
  }

  return PLAN_ORDER.map((code) => byCode.get(code)!).filter(Boolean);
}

function checkoutEnabled(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const price = process.env.STRIPE_PRICE_STARTER ?? "";
  return isStripeKeyAllowedForEnvironment(key, process.env.VERCEL_ENV) && Boolean(price);
}

export default async function PlansPage() {
  const plans = await getPlans();
  const stripeReady = checkoutEnabled();

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/plans" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Free para avaliacao (30 dias, 1 anuncio). Starter para operacao completa com renovacao
          mensal.
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

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                planCode={plan.plan_code}
                label={plan.display_label}
                className={buttonClass(plan.display_featured)}
                checkoutEnabled={plan.plan_code === CHECKOUT_PLAN_CODE && stripeReady}
              />
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-2 text-xs text-gray-500">
          <p>
            Documentos:{" "}
            <Link href="/termos" className="underline">
              Termos de Uso
            </Link>
            {" · "}
            <Link href="/privacidade" className="underline">
              Politica de Privacidade
            </Link>
            {" · "}
            <Link
              href={LEGAL_ROUTES.refund_cancellation}
              data-public-href="/cancelamento-e-reembolso"
              className="underline"
            >
              Cancelamento e reembolso
            </Link>
            {" · "}
            <Link href="/remocao-de-conteudo" className="underline">
              Remocao de conteudo
            </Link>
          </p>
          <p>
            Atendimento eletronico:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          {!stripeReady ? (
            <p className="text-amber-700">
              Checkout Stripe indisponivel ate configurar STRIPE_SECRET_KEY e STRIPE_PRICE_STARTER
              compativeis com este ambiente.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

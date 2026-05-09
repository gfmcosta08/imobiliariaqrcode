import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { CheckoutButton } from "./checkout-button";
import type { StripePlanCode } from "@/lib/stripe";

type PlanDisplay = {
  plan_code: string;
  display_name: string;
  display_price: string;
  display_suffix: string;
  display_note: string;
  display_label: string;
  display_featured: boolean;
  features: string[];
};

const PLAN_ORDER = ["solo", "pro", "premium"];

export default async function PlansPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plan_display_config")
    .select("*")
    .neq("plan_code", "trial");

  const plans: PlanDisplay[] = (data ?? []).sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code),
  );

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/plans" />
      <main className="mx-auto max-w-5xl px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Escolha o plano que melhor se adapta às suas necessidades.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.plan_code}
              className={
                plan.display_featured
                  ? "border-2 border-black p-8"
                  : "border border-gray-200 p-8"
              }
            >
              <p
                className={`text-xs font-bold uppercase tracking-widest ${
                  plan.display_featured ? "text-black" : "text-gray-400"
                }`}
              >
                Plano
              </p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{plan.display_name}</h2>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {plan.display_price}
                <span className="text-base font-normal text-gray-400">
                  {plan.display_suffix}
                </span>
              </p>
              {plan.display_note && (
                <p className="mt-2 text-xs text-gray-400">{plan.display_note}</p>
              )}
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-black">✓</span> {feature}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                planCode={plan.plan_code as StripePlanCode}
                label={plan.display_label}
                className={
                  plan.display_featured
                    ? "mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                    : "mt-8 inline-block border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-500 disabled:opacity-50"
                }
              />
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Pagamentos processados com segurança via Stripe.
        </p>
      </main>
    </div>
  );
}

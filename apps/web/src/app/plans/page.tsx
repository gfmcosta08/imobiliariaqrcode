import Link from "next/link";

export default function PlansPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Planos</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Upgrade para PRO via Stripe ou Mercado Pago: webhooks em{" "}
        <code className="text-xs">billing-stripe-webhook</code> e{" "}
        <code className="text-xs">billing-mercadopago-webhook</code> (stubs no repositório). Estado
        canônico: tabela <code className="text-xs">subscriptions</code>.
      </p>
      <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        <li>FREE: 1 imóvel ativo, 10 imagens, expira 30 dias após primeira impressão.</li>
        <li>PRO: vários imóveis, 15 imagens, sem expiração automática.</li>
      </ul>
      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Voltar ao painel
        </Link>
      </p>
    </div>
  );
}

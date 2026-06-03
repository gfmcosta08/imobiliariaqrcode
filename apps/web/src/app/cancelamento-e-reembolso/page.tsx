import Link from "next/link";

import { LEGAL_ENTITY } from "@/lib/legal-entity";

export default function CancellationAndRefundPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            {LEGAL_ENTITY.tradeName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Cancelamento e reembolso</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            O checkout online esta temporariamente desativado. Contratacoes comerciais devem
            apresentar preco, periodicidade, renovacao e condicoes aplicaveis antes da confirmacao.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Solicitar cancelamento</h2>
            <p>
              Envie a solicitacao para{" "}
              <a className="font-medium underline" href={`mailto:${LEGAL_ENTITY.supportEmail}`}>
                {LEGAL_ENTITY.supportEmail}
              </a>{" "}
              com o assunto &quot;Cancelamento de assinatura&quot;, informando o e-mail da conta e o
              plano contratado. O pedido sera registrado eletronicamente.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Reembolso</h2>
            <p>
              Pedidos de reembolso serao avaliados conforme a legislacao aplicavel e as condicoes
              informadas na contratacao. Direitos legalmente assegurados ao consumidor permanecem
              preservados.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Antes da contratacao</h2>
            <p>
              Confirme o valor total, a periodicidade, a existencia ou nao de renovacao automatica,
              os beneficios do plano, a forma de cancelamento e as condicoes aplicaveis ao
              reembolso. Nao conclua a contratacao se alguma informacao estiver ausente.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/plans" className="font-medium underline">
            Planos
          </Link>
          <Link href="/termos" className="font-medium underline">
            Termos de Uso
          </Link>
          <Link href="/" className="font-medium underline">
            Voltar ao inicio
          </Link>
        </footer>
      </article>
    </main>
  );
}

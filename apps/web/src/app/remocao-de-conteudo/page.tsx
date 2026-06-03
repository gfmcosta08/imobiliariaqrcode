import Link from "next/link";

import { LEGAL_ENTITY } from "@/lib/legal-entity";

export default function ContentRemovalPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            {LEGAL_ENTITY.tradeName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Remocao de conteudo e denuncias</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Canal para comunicar conteudo potencialmente ilicito, informacao falsa ou violacao de
            Direitos autorais e direitos de terceiros.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Como enviar uma solicitacao</h2>
            <p>
              Envie a denuncia para{" "}
              <a className="font-medium underline" href={`mailto:${LEGAL_ENTITY.legalEmail}`}>
                {LEGAL_ENTITY.legalEmail}
              </a>{" "}
              com o assunto &quot;Solicitacao de remocao de conteudo&quot;.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Informacoes necessarias</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Nome e meio de contato do solicitante.</li>
              <li>URL, codigo do imovel ou identificador do conteudo denunciado.</li>
              <li>Descricao objetiva do problema e do direito alegadamente violado.</li>
              <li>Documentos ou evidencias disponiveis.</li>
              <li>Declaracao de boa-fe sobre a veracidade das informacoes enviadas.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">Analise e medidas</h2>
            <p>
              A plataforma registrara a solicitacao, preservara evidencias necessarias e avaliara
              medidas proporcionais, como indisponibilizacao preventiva, pedido de esclarecimentos,
              remocao do conteudo ou suspensao da conta. Determinacoes de autoridade competente
              serao atendidas conforme a legislacao aplicavel.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/termos" className="font-medium underline">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="font-medium underline">
            Politica de Privacidade
          </Link>
          <Link href="/" className="font-medium underline">
            Voltar ao inicio
          </Link>
        </footer>
      </article>
    </main>
  );
}

import Link from "next/link";

import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            {LEGAL_ENTITY.tradeName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Termos de Uso</h1>
          <p className="mt-2 text-sm text-neutral-500">Versao {LEGAL_DOCUMENT_VERSIONS.terms}</p>
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rascunho para homologacao. A revisao juridica permanece obrigatoria antes da publicacao
            em producao.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              1. Responsavel pela plataforma
            </h2>
            <p>
              A plataforma {LEGAL_ENTITY.tradeName} e disponibilizada por {LEGAL_ENTITY.companyName}
              , inscrita no CNPJ sob o numero {LEGAL_ENTITY.cnpj}, com endereco em{" "}
              {LEGAL_ENTITY.address} e contato eletronico{" "}
              <a className="font-medium underline" href={`mailto:${LEGAL_ENTITY.supportEmail}`}>
                {LEGAL_ENTITY.supportEmail}
              </a>
              .
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">2. Objeto</h2>
            <p>
              O ImobQR oferece ferramentas para cadastro e divulgacao de imoveis, geracao de QR
              Codes, gestao de leads, integracoes de mensageria, uploads, metricas operacionais e
              recursos comerciais para corretores e imobiliarias.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">3. Conta e seguranca</h2>
            <p>
              O usuario deve fornecer dados corretos, manter suas credenciais protegidas e comunicar
              acessos indevidos. O uso da conta por terceiros permanece sob responsabilidade do
              titular ate a comunicacao do incidente, sem afastar responsabilidades legalmente
              aplicaveis a plataforma.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">4. Conteudo do usuario</h2>
            <p>
              O usuario e responsavel por textos, imagens, videos, documentos e demais conteudos
              inseridos na plataforma. E proibido publicar material ilicito, falso, enganoso,
              discriminatorio ou que viole direitos autorais, privacidade, sigilo ou direitos de
              terceiros.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">5. Remocao de conteudo</h2>
            <p>
              Solicitacoes fundamentadas de remocao serao avaliadas pelo{" "}
              <Link className="font-medium underline" href="/remocao-de-conteudo">
                canal de remocao de conteudo e denuncias
              </Link>
              . A plataforma podera suspender conteudo ou contas para prevenir danos, cumprir a
              legislacao ou atender determinacao competente.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">6. Leads e comunicacoes</h2>
            <p>
              Corretores e imobiliarias devem usar dados de leads e recursos de comunicacao apenas
              para finalidades legitimas relacionadas ao atendimento solicitado, respeitando a
              legislacao, preferencias do titular e pedidos de interrupcao de contato.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              7. Planos, cobranca e cancelamento
            </h2>
            <p>
              Precos, periodicidade, beneficios, renovacao, formas de pagamento, cancelamento e
              eventual reembolso devem ser apresentados antes da contratacao. Consulte o{" "}
              <Link className="font-medium underline" href="/cancelamento-e-reembolso">
                canal eletronico de cancelamento e reembolso
              </Link>
              .
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              8. Disponibilidade e responsabilidade
            </h2>
            <p>
              A plataforma buscara manter o servico disponivel e seguro, mas podera passar por
              manutencao ou indisponibilidade de terceiros. Estes Termos nao excluem
              responsabilidades que nao possam ser afastadas pela legislacao aplicavel.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">9. Atualizacoes</h2>
            <p>
              Alteracoes relevantes nestes Termos serao comunicadas de forma adequada. Quando
              necessario, um novo aceite sera solicitado ao usuario.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/login" className="font-medium underline">
            Voltar para o cadastro
          </Link>
          <Link href="/privacidade" className="font-medium underline">
            Politica de Privacidade
          </Link>
        </footer>
      </article>
    </main>
  );
}

import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal";
import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            ImobQR
          </p>
          <h1 className="mt-2 text-3xl font-bold">Termos de Uso</h1>
          <p className="mt-2 text-sm text-neutral-500">Versão {LEGAL_DOCUMENT_VERSIONS.terms}</p>
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rascunho para homologação. Revisão jurídica e identificação completa da empresa são
            obrigatórias antes da publicação em produção.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              1. Responsável pela plataforma
            </h2>
            <p>
              A plataforma ImobQR é disponibilizada por [PREENCHER RAZÃO SOCIAL], inscrita no CNPJ
              sob nº [PREENCHER CNPJ], com sede em [PREENCHER ENDEREÇO] e contato [PREENCHER E-MAIL
              DE SUPORTE].
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">2. Objeto</h2>
            <p>
              O ImobQR oferece ferramentas para cadastro e divulgação de imóveis, geração de QR
              Codes, gestão de leads, integrações de mensageria, uploads, métricas operacionais e
              recursos comerciais para corretores e imobiliárias.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">3. Conta e segurança</h2>
            <p>
              O usuário deve fornecer dados corretos, manter suas credenciais protegidas e comunicar
              acessos indevidos. O uso da conta por terceiros permanece sob responsabilidade do
              titular até a comunicação do incidente.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">4. Conteúdo do usuário</h2>
            <p>
              O usuário é responsável por textos, imagens, vídeos, documentos e demais conteúdos
              inseridos na plataforma. É proibido publicar material ilícito, falso, enganoso,
              discriminatório ou que viole direitos autorais, privacidade, sigilo ou direitos de
              terceiros.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">5. Remoção de conteúdo</h2>
            <p>
              Solicitações fundamentadas de remoção serão avaliadas pelo canal [PREENCHER E-MAIL
              JURÍDICO]. A plataforma poderá suspender conteúdo ou contas para prevenir danos,
              cumprir a legislação ou atender determinação competente.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">6. Leads e comunicações</h2>
            <p>
              Corretores e imobiliárias devem usar dados de leads e recursos de comunicação apenas
              para finalidades legítimas relacionadas ao atendimento solicitado, respeitando a
              legislação, preferências do titular e pedidos de interrupção de contato.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              7. Planos, cobrança e cancelamento
            </h2>
            <p>
              Preços, periodicidade, benefícios, renovação, formas de pagamento, cancelamento e
              eventual reembolso serão apresentados antes da contratação. O usuário terá canal
              eletrônico adequado para solicitar cancelamento.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">
              8. Disponibilidade e responsabilidade
            </h2>
            <p>
              A plataforma buscará manter o serviço disponível e seguro, mas poderá passar por
              manutenção ou indisponibilidade de terceiros. Estes Termos não excluem
              responsabilidades que não possam ser afastadas pela legislação aplicável.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">9. Atualizações</h2>
            <p>
              Alterações relevantes nestes Termos serão comunicadas de forma adequada. Quando
              necessário, um novo aceite será solicitado ao usuário.
            </p>
          </section>
        </div>

        <footer className="mt-10 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/login" className="font-medium underline">
            Voltar para o cadastro
          </Link>
        </footer>
      </article>
    </main>
  );
}

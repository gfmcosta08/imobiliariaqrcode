import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            ImobQR
          </p>
          <h1 className="mt-2 text-3xl font-bold">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-neutral-500">Versão {LEGAL_DOCUMENT_VERSIONS.privacy}</p>
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rascunho para homologação. Inventário de dados, revisão jurídica e identificação
            completa da empresa são obrigatórios antes da publicação em produção.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">1. Controlador e contato</h2>
            <p>
              O controlador é [PREENCHER RAZÃO SOCIAL], CNPJ [PREENCHER CNPJ], com sede em
              [PREENCHER ENDEREÇO]. Solicitações sobre dados pessoais devem ser enviadas para
              [PREENCHER E-MAIL DE PRIVACIDADE].
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">2. Dados tratados</h2>
            <p>
              A plataforma pode tratar dados cadastrais e de contato; credenciais protegidas; dados
              profissionais de corretores e imobiliárias; dados de imóveis e proprietários; fotos,
              documentos e textos enviados; dados de leads; mensagens e interações via WhatsApp; QR
              Codes; registros de acesso, segurança, falhas e operação; além de metadados de
              cobrança e assinatura.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">3. Finalidades</h2>
            <p>
              Os dados são tratados para criar contas, autenticar usuários, prestar o serviço,
              publicar anúncios, encaminhar atendimentos, operar integrações, processar assinaturas,
              prevenir fraudes, manter segurança, prestar suporte e cumprir obrigações legais.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">4. Bases legais</h2>
            <p>
              As bases legais aplicáveis devem ser definidas no inventário de dados conforme cada
              finalidade, incluindo execução de contrato, cumprimento de obrigação legal, exercício
              regular de direitos, legítimo interesse quando cabível e consentimento quando exigido.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">5. Compartilhamento</h2>
            <p>
              Dados podem ser compartilhados com fornecedores necessários à operação, como
              infraestrutura, armazenamento, autenticação, pagamentos e mensageria. A lista final de
              operadores, suboperadores e transferências internacionais deve ser preenchida no
              inventário antes da publicação em produção.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">6. Cookies e rastreamento</h2>
            <p>
              Cookies essenciais podem ser utilizados para autenticação e segurança. Ferramentas
              opcionais de analytics, publicidade ou rastreamento somente devem ser ativadas após
              inventário, configuração do banner de cookies e definição da base legal aplicável.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">7. Retenção e segurança</h2>
            <p>
              Os dados serão mantidos pelo prazo necessário à finalidade informada e às obrigações
              legais. A plataforma adota controles de acesso, segregação de ambientes, registros de
              auditoria e medidas técnicas proporcionais aos riscos.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">8. Direitos do titular</h2>
            <p>
              O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização,
              bloqueio, eliminação, portabilidade, informações sobre compartilhamento e revisão ou
              revogação de consentimento quando aplicável.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">9. Atualizações</h2>
            <p>
              Mudanças relevantes nesta Política serão comunicadas de forma adequada. Quando
              necessário, um novo aceite será solicitado.
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

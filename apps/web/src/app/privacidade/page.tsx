import Link from "next/link";

import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 text-neutral-900">
      <article className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <header className="mb-8 border-b border-neutral-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
            {LEGAL_ENTITY.tradeName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Politica de Privacidade</h1>
          <p className="mt-2 text-sm text-neutral-500">Versao {LEGAL_DOCUMENT_VERSIONS.privacy}</p>
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Rascunho para homologacao. A revisao juridica do inventario LGPD permanece obrigatoria
            antes da publicacao em producao.
          </p>
        </header>

        <div className="space-y-6 text-sm leading-7 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">1. Controlador e contato</h2>
            <p>
              O controlador e {LEGAL_ENTITY.companyName}, CNPJ {LEGAL_ENTITY.cnpj}, com endereco em{" "}
              {LEGAL_ENTITY.address}. Solicitacoes sobre dados pessoais devem ser enviadas para{" "}
              <a className="font-medium underline" href={`mailto:${LEGAL_ENTITY.privacyEmail}`}>
                {LEGAL_ENTITY.privacyEmail}
              </a>
              .
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">2. Dados tratados</h2>
            <p>
              A plataforma pode tratar dados cadastrais e de contato; credenciais protegidas; dados
              profissionais de corretores e imobiliarias; dados de imoveis e proprietarios; fotos,
              documentos e textos enviados; dados de leads; mensagens e interacoes via WhatsApp; QR
              Codes; registros de acesso, seguranca, falhas e operacao; alem de metadados de
              cobranca e assinatura.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">3. Finalidades</h2>
            <p>
              Os dados sao tratados para criar contas, autenticar usuarios, prestar o servico,
              publicar anuncios, encaminhar atendimentos, operar integracoes, processar assinaturas,
              prevenir fraudes, manter seguranca, prestar suporte e cumprir obrigacoes legais.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">4. Bases legais</h2>
            <p>
              As bases legais devem ser aplicadas conforme cada finalidade, incluindo execucao de
              contrato, cumprimento de obrigacao legal, exercicio regular de direitos, legitimo
              interesse quando cabivel e consentimento quando exigido.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">5. Compartilhamento</h2>
            <p>
              Dados podem ser compartilhados com fornecedores necessarios a operacao, incluindo
              infraestrutura, armazenamento, autenticacao e mensageria. Fornecedores de pagamento
              somente devem receber dados quando a cobranca online for ativada. Transferencias
              internacionais e suboperadores devem ser revisados contratualmente antes da producao.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">6. Cookies e rastreamento</h2>
            <p>
              Cookies essenciais podem ser utilizados para autenticacao e seguranca. Ferramentas
              opcionais de analytics, publicidade ou rastreamento nao devem ser ativadas sem
              inventario, configuracao do mecanismo de cookies e definicao da base legal aplicavel.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">7. Retencao e seguranca</h2>
            <p>
              Os dados serao mantidos pelo prazo necessario a finalidade informada e as obrigacoes
              legais. A plataforma adota controles de acesso, segregacao de ambientes, registros de
              auditoria e medidas tecnicas proporcionais aos riscos.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">8. Direitos do titular</h2>
            <p>
              O titular pode solicitar confirmacao de tratamento, acesso, correcao, anonimizacao,
              bloqueio, eliminacao, portabilidade, informacoes sobre compartilhamento e revisao ou
              revogacao de consentimento quando aplicavel.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">9. Atualizacoes</h2>
            <p>
              Mudancas relevantes nesta Politica serao comunicadas de forma adequada. Quando
              necessario, um novo aceite sera solicitado.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm">
          <Link href="/login" className="font-medium underline">
            Voltar para o cadastro
          </Link>
          <Link href="/termos" className="font-medium underline">
            Termos de Uso
          </Link>
        </footer>
      </article>
    </main>
  );
}

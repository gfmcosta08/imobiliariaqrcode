import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

type Props = {
  documentType: "terms" | "privacy" | "refund_cancellation";
  title: string;
};

const DEFAULT_LEGAL_DOCUMENTS: Record<
  Props["documentType"],
  { version: string; content_md: string }
> = {
  terms: {
    version: "2026-06-02",
    content_md:
      "# Termos de Uso\n\nVersao 2026-06-02. Ao usar o ImoveisQR voce concorda com as regras de uso da plataforma, publicacao de anuncios e responsabilidade pelos dados informados.\n\n## Conta teste\n\nA avaliacao gratuita permite cadastrar imovel, gerar QR e testar o fluxo de leads sem cobranca automatica.\n\n## Planos pagos\n\nAssinaturas recorrentes sao processadas pela Stripe e podem ser gerenciadas pelo portal de assinatura.\n\n## Responsabilidade do usuario\n\nO corretor ou imobiliaria e responsavel pela veracidade dos dados dos anuncios e pelo atendimento aos interessados.\n\n## Contato\n\nAtendimento eletronico: suporte@imoveisqr.com.br",
  },
  privacy: {
    version: "2026-06-02",
    content_md:
      "# Politica de Privacidade\n\nVersao 2026-06-02. Tratamos dados de cadastro, anuncios, QR Codes e leads conforme a LGPD.\n\n## Dados coletados\n\nNome, e-mail, WhatsApp, dados de imoveis, interacoes com QR Code e registros operacionais necessarios para seguranca e suporte.\n\n## Uso dos dados\n\nUsamos os dados para operar a plataforma, entregar leads ao corretor responsavel, medir ativacao do produto e cumprir obrigacoes legais.\n\n## Compartilhamento\n\nNao vendemos dados pessoais. Pagamentos recorrentes sao processados pela Stripe.\n\n## Contato do encarregado\n\nprivacidade@imoveisqr.com.br",
  },
  refund_cancellation: {
    version: "2026-06-02",
    content_md:
      "# Cancelamento e Reembolso\n\nVersao 2026-06-02.\n\n## Assinaturas\n\nVoce pode cancelar a renovacao automatica pelo portal de assinatura quando disponivel no painel.\n\n## Acesso apos cancelamento\n\nO acesso pode permanecer ativo ate o fim do periodo pago ou conforme cortesia administrativa registrada.\n\n## Reembolso\n\nPagamentos ja processados seguem a politica da operadora de pagamento, as regras do plano contratado e a legislacao aplicavel.\n\n## Contato\n\nsuporte@imoveisqr.com.br",
  },
};

export async function LegalDocumentPage({ documentType, title }: Props) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_document_versions")
    .select("content_md, version, published_at")
    .eq("document_type", documentType)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallback = DEFAULT_LEGAL_DOCUMENTS[documentType];
  const content = data?.content_md ?? fallback.content_md;
  const version = data?.version ?? fallback.version;
  const paragraphs = content.split("\n\n");

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Versao {version}</p>
        <article className="prose prose-sm mt-8 max-w-none text-gray-700">
          {paragraphs.map((block: string) => (
            <p key={block.slice(0, 40)} className="mt-4 whitespace-pre-wrap leading-7">
              {block.replace(/^#+\s*/, "")}
            </p>
          ))}
        </article>
        <p className="mt-10 text-sm text-gray-600">
          Atendimento eletronico:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <Link href="/plans" className="mt-6 inline-block text-sm text-gray-500 underline">
          Voltar aos planos
        </Link>
      </main>
    </div>
  );
}

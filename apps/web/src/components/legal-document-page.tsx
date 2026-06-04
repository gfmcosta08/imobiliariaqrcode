import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

type Props = {
  documentType: "terms" | "privacy" | "refund_cancellation";
  title: string;
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

  const paragraphs = (data?.content_md ?? `# ${title}\n\nDocumento indisponivel.`).split("\n\n");

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-8 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{title}</h1>
        {data?.version ? <p className="mt-2 text-sm text-gray-500">Versao {data.version}</p> : null}
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

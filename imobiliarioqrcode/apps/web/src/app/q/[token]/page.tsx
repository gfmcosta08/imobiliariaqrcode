import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function QRPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke("qr-resolve", {
    body: { token },
  });

  if (error || !data?.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">🏠</div>
          <h1 className="mb-2 text-xl font-semibold text-zinc-900">Imóvel não encontrado</h1>
          <p className="text-sm text-zinc-500">Este QR code pode estar desatualizado ou ter expirado.</p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  const { property: p, broker } = data;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900">{p.title}</h1>
          <p className="text-sm text-zinc-500">
            {[p.neighborhood, p.city].filter(Boolean).join(" - ")}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-4 grid grid-cols-2 gap-4">
            {p.bedrooms && (
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{p.bedrooms}</div>
                <div className="text-xs text-zinc-500">Quartos</div>
              </div>
            )}
            {p.bathrooms && (
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{p.bathrooms}</div>
                <div className="text-xs text-zinc-500">Banheiros</div>
              </div>
            )}
            {p.area_m2 && (
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{p.area_m2}</div>
                <div className="text-xs text-zinc-500">m²</div>
              </div>
            )}
            {p.parking_spaces > 0 && (
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600">{p.parking_spaces}</div>
                <div className="text-xs text-zinc-500">Vagas</div>
              </div>
            )}
          </div>

          {p.description && (
            <div className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-zinc-900">Descrição</h2>
              <p className="text-sm text-zinc-600">{p.description}</p>
            </div>
          )}

          {(p.price || p.rent_price) && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-center">
              <div className="text-2xl font-bold text-green-700">
                {p.rent_price ? `R$ ${Number(p.rent_price).toLocaleString("pt-BR")}/mês` : `R$ ${Number(p.price).toLocaleString("pt-BR")}`}
              </div>
              {p.condo_fee && <div className="text-xs text-zinc-500">+ condomínio R$ {Number(p.condo_fee).toLocaleString("pt-BR")}</div>}
            </div>
          )}

          {broker && (
            <div className="mt-6 flex items-center justify-between rounded-lg bg-indigo-50 p-4">
              <div>
                <div className="text-sm font-medium text-indigo-900">Fale com {broker.name}</div>
                <div className="text-xs text-indigo-600">Corretor responsável</div>
              </div>
              {broker.wa_link && (
                <a
                  href={broker.wa_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicPropertyDetail } from "@/features/properties/server";
import type { PublicPropertyDetail } from "@/features/properties/types";

type PageProps = {
  params: Promise<{ public_id: string }>;
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getPriceLabel(property: PublicPropertyDetail): string {
  if (property.purpose === "sale" && property.sale_price) return formatBRL(property.sale_price);
  if ((property.purpose === "rent" || property.purpose === "season") && property.rent_price) {
    return `${formatBRL(property.rent_price)} / mes`;
  }
  if (property.sale_price) return formatBRL(property.sale_price);
  if (property.rent_price) return `${formatBRL(property.rent_price)} / mes`;
  return "Valor sob consulta";
}

function getPurposeLabel(purpose: string | null): string {
  if (purpose === "sale") return "Compra";
  if (purpose === "rent") return "Aluguel";
  if (purpose === "season") return "Temporada";
  return "Imovel";
}

function getLocationLabel(property: PublicPropertyDetail): string {
  return (
    [property.neighborhood, property.city, property.state].filter(Boolean).join(", ") ||
    "Localizacao sob consulta"
  );
}

function getAreaLabel(property: PublicPropertyDetail): string {
  const area = property.built_area_m2 ?? property.total_area_m2 ?? property.land_area_m2;
  return area ? `${area} m2` : "Sob consulta";
}

function splitHighlights(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export default async function PublicPropertyPage({ params }: PageProps) {
  const { public_id } = await params;
  const property = await loadPublicPropertyDetail(decodeURIComponent(public_id));

  if (!property) notFound();

  const images = property.images.length ? property.images : [];
  const highlights = splitHighlights(property.highlights);

  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between border-b border-gray-200 px-6 py-5 md:px-8">
        <Link href="/" className="text-sm font-bold uppercase tracking-widest text-gray-900">
          ImoveisQR
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/#imoveis" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Imoveis
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Anunciar
          </Link>
        </div>
      </nav>

      <section className="grid grid-cols-1 gap-3 px-6 py-6 md:grid-cols-4 md:px-8">
        {images.length ? (
          images.slice(0, 5).map((image, index) => (
            <div
              key={`${property.id}-${image}`}
              className={`bg-gray-200 ${index === 0 ? "h-[360px] md:col-span-2 md:row-span-2 md:h-full" : "h-44"}`}
              style={{
                backgroundImage: `url('${image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))
        ) : (
          <div className="flex h-[360px] items-center justify-center bg-gray-900 text-xs font-bold uppercase tracking-widest text-white/60 md:col-span-4">
            {getPurposeLabel(property.purpose)}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-10 px-6 pb-16 pt-4 md:px-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {getPurposeLabel(property.purpose)}
            </span>
            <span className="text-sm font-medium text-gray-500">{property.public_id}</span>
          </div>

          <h1
            className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl"
            data-testid="public-property-title"
          >
            {property.title || "Imovel disponivel"}
          </h1>
          <p className="mt-2 text-base text-gray-600" data-testid="public-property-location">
            {getLocationLabel(property)}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-5 border-y border-gray-200 py-6 md:grid-cols-4">
            <Fact label="Quartos" value={property.bedrooms ?? "Sob consulta"} />
            <Fact label="Banheiros" value={property.bathrooms ?? "Sob consulta"} />
            <Fact label="Vagas" value={property.parking_spaces ?? "Sob consulta"} />
            <Fact label="Area" value={getAreaLabel(property)} />
          </div>

          {property.full_description ? (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900">Descricao</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700">
                {property.full_description}
              </p>
            </div>
          ) : null}

          {highlights.length ? (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900">Destaques</h2>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="border border-gray-200 px-4 py-3 text-sm text-gray-700"
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="h-fit border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{getPriceLabel(property)}</p>
          <p className="mt-2 text-sm text-gray-500">{getLocationLabel(property)}</p>

          <div className="mt-5 space-y-2 text-sm text-gray-700">
            <p>Tipo: {property.property_type || "Sob consulta"}</p>
            {property.property_subtype ? <p>Subtipo: {property.property_subtype}</p> : null}
            {property.condo_fee ? <p>Condominio: {formatBRL(property.condo_fee)}</p> : null}
            {property.is_furnished != null ? (
              <p>Mobiliado: {property.is_furnished ? "Sim" : "Nao"}</p>
            ) : null}
          </div>

          {property.qr_token ? (
            <Link
              href={`/q/${property.qr_token}`}
              className="mt-6 flex w-full items-center justify-center bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Falar pelo WhatsApp
            </Link>
          ) : (
            <Link
              href="/login"
              className="mt-6 flex w-full items-center justify-center bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Tenho interesse
            </Link>
          )}
        </aside>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

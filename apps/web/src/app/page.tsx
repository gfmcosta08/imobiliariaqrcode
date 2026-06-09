import Link from "next/link";

import {
  CITY_REGIONS,
  PROPERTY_SUBTYPES,
  PROPERTY_TYPES,
  SUN_POSITIONS,
} from "@/lib/property-options";
import {
  loadHomeProperties,
  parseHomeFilters,
  type HomePropertiesResult,
  type HomePropertyCard,
  type HomePropertyFilters,
} from "@/lib/public/home-properties";
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const numericFilterGroups: Array<{
  label: string;
  min: keyof HomePropertyFilters;
  max: keyof HomePropertyFilters;
  placeholder: string;
}> = [
  { label: "Area construida", min: "built_area_min", max: "built_area_max", placeholder: "m2" },
  { label: "Area do terreno", min: "land_area_min", max: "land_area_max", placeholder: "m2" },
  { label: "Quartos", min: "bedrooms_min", max: "bedrooms_max", placeholder: "Qtd." },
  { label: "Suites", min: "suites_min", max: "suites_max", placeholder: "Qtd." },
  { label: "Banheiros", min: "bathrooms_min", max: "bathrooms_max", placeholder: "Qtd." },
  { label: "Vagas", min: "parking_spaces_min", max: "parking_spaces_max", placeholder: "Qtd." },
  { label: "Salas", min: "living_rooms_min", max: "living_rooms_max", placeholder: "Qtd." },
  { label: "Preco venda", min: "sale_price_min", max: "sale_price_max", placeholder: "R$" },
  { label: "Preco aluguel", min: "rent_price_min", max: "rent_price_max", placeholder: "R$" },
  { label: "Condominio", min: "condo_fee_min", max: "condo_fee_max", placeholder: "R$" },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number | null): string {
  return value == null ? "" : String(value);
}

function getPriceLabel(item: HomePropertyCard): string {
  if (item.purpose === "sale" && item.sale_price) return formatBRL(item.sale_price);
  if ((item.purpose === "rent" || item.purpose === "season") && item.rent_price) {
    return `${formatBRL(item.rent_price)} / mes`;
  }
  if (item.sale_price) return formatBRL(item.sale_price);
  if (item.rent_price) return `${formatBRL(item.rent_price)} / mes`;
  return "Valor sob consulta";
}

function getPurposeLabel(purpose: string | null): string {
  if (purpose === "sale") return "Compra";
  if (purpose === "rent") return "Aluguel";
  if (purpose === "season") return "Temporada";
  return "Imovel";
}

function getLocationLabel(item: HomePropertyCard): string {
  return (
    [item.neighborhood, item.city, item.state].filter(Boolean).join(", ") ||
    "Localizacao sob consulta"
  );
}

function getAreaLabel(item: HomePropertyCard): string {
  const area = item.built_area_m2 ?? item.total_area_m2 ?? item.land_area_m2;
  return area ? `${area} m2` : "Area sob consulta";
}

function emptyHomeResult(filters: HomePropertyFilters): HomePropertiesResult {
  return {
    filters,
    items: [],
    totalEligible: 0,
    options: {
      propertyTypes: [],
      propertySubtypes: [],
      floorTypes: [],
      sunPositions: [],
      cityRegions: [],
    },
  };
}

export default async function Home({ searchParams }: PageProps) {
  const rawSearchParams = searchParams ? await searchParams : undefined;

  let home = emptyHomeResult(parseHomeFilters(rawSearchParams));
  try {
    home = await loadHomeProperties(rawSearchParams);
  } catch {
    home = emptyHomeResult(parseHomeFilters(rawSearchParams));
  }

  const { filters, options } = home;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div
        className="relative flex min-h-[620px] flex-col"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/45" />

        <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-8">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-white">
            ImoveisQR
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/dashboard" className="text-sm text-white/90 transition hover:text-white">
              Corretores
            </Link>
            <Link href="/plans" className="text-sm text-white/90 transition hover:text-white">
              Planos
            </Link>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-white/90 transition hover:text-white"
          >
            Entrar / Cadastrar
          </Link>
        </nav>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
          <h1 className="font-display max-w-4xl text-4xl font-semibold text-white drop-shadow-sm lg:text-5xl">
            Cole esse QR no imovel e nunca mais perca um interessado anonimo.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90">
            Gere um QR para cada imovel, capture o interessado pelo WhatsApp ou formulario e
            acompanhe tudo no painel.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/teste-gratis"
              className="bg-white px-6 py-3 text-sm font-semibold text-gray-900"
            >
              Criar meu primeiro QR
            </Link>
            <Link
              href="/como-funciona"
              className="border border-white px-6 py-3 text-sm font-semibold text-white"
            >
              Ver como funciona
            </Link>
          </div>

          <div className="mt-10 w-full max-w-3xl">
            <form action="/" method="get" className="flex bg-white">
              {filters.purpose ? (
                <input type="hidden" name="purpose" value={filters.purpose} />
              ) : null}
              <input
                type="text"
                name="q"
                data-testid="home-hero-search"
                defaultValue={filters.q}
                placeholder="Cidade, bairro, codigo ou referencia..."
                className="min-w-0 flex-1 px-5 py-4 text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                data-testid="home-hero-search-submit"
                className="flex items-center bg-black px-5 text-white transition hover:bg-zinc-800"
                aria-label="Buscar"
              >
                <span className="text-sm font-semibold">Buscar</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <section id="imoveis" className="px-6 py-14 md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Imoveis com QR ativo</h2>
            <p className="mt-1 text-sm text-gray-500">
              {home.totalEligible} anuncios publicos com QR para captura de interesse.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex bg-black px-5 py-3 text-sm font-medium text-white"
          >
            Quero anunciar
          </Link>
        </div>

        <form
          action="/"
          method="get"
          className="mt-8 border border-gray-200 bg-white p-4"
          data-testid="home-filters-form"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Busca
              <input
                name="q"
                data-testid="home-filter-q"
                defaultValue={filters.q}
                className="mt-1 w-full border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:border-gray-900"
                placeholder="Cidade, bairro ou codigo"
              />
            </label>
            <SelectFilter
              label="Finalidade"
              name="purpose"
              value={filters.purpose ?? ""}
              options={[
                ["", "Todos"],
                ["sale", "Comprar"],
                ["rent", "Alugar"],
              ]}
            />
            <SelectFilter
              label="Tipo"
              name="property_type"
              value={filters.property_type}
              options={[["", "Todos"], ...PROPERTY_TYPES.map((value) => [value, value] as const)]}
            />
            <SelectFilter
              label="Subtipo"
              name="property_subtype"
              value={filters.property_subtype}
              options={[
                ["", "Todos"],
                ...PROPERTY_SUBTYPES.map((value) => [value, value] as const),
              ]}
            />
            <SelectFilter
              label="Mobiliado"
              name="furnished"
              value={filters.furnished}
              options={[
                ["", "Todos"],
                ["true", "Sim"],
                ["false", "Nao"],
              ]}
            />
            <SelectFilter
              label="Piso"
              name="floor_type"
              value={filters.floor_type}
              options={[
                ["", "Todos"],
                ...options.floorTypes.map((value) => [value, value] as const),
              ]}
            />
            <SelectFilter
              label="Posicao solar"
              name="sun_position"
              value={filters.sun_position}
              options={[["", "Todos"], ...SUN_POSITIONS.map((value) => [value, value] as const)]}
            />
            <SelectFilter
              label="Regiao"
              name="city_region"
              value={filters.city_region}
              options={[["", "Todas"], ...CITY_REGIONS.map((value) => [value, value] as const)]}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {numericFilterGroups.map((group) => (
              <div
                key={String(group.min)}
                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {group.label}
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    name={String(group.min)}
                    defaultValue={formatNumber(filters[group.min] as number | null)}
                    className="min-w-0 border border-gray-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:border-gray-900"
                    placeholder={`Min ${group.placeholder}`}
                  />
                  <input
                    name={String(group.max)}
                    defaultValue={formatNumber(filters[group.max] as number | null)}
                    className="min-w-0 border border-gray-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:border-gray-900"
                    placeholder={`Max ${group.placeholder}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              data-testid="home-filters-submit"
              className="bg-black px-5 py-2.5 text-sm font-medium text-white"
            >
              Aplicar filtros
            </button>
            <Link
              href="/#imoveis"
              className="border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-800"
            >
              Limpar filtros
            </Link>
          </div>
        </form>

        {home.items.length ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {home.items.map((item) => (
              <Link
                key={item.id}
                href={item.detail_href}
                data-testid="home-property-card"
                className="group overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {item.image_url ? (
                  <div
                    className="h-52 w-full bg-gray-200 transition group-hover:scale-[1.01]"
                    style={{
                      backgroundImage: `url('${item.image_url}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center bg-gray-900 text-xs font-bold uppercase tracking-widest text-white/60">
                    {getPurposeLabel(item.purpose)}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xl font-bold text-gray-900">{getPriceLabel(item)}</p>
                    <span className="shrink-0 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {getPurposeLabel(item.purpose)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-medium text-gray-800">
                    {item.title || item.public_id}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.bedrooms ?? 0} quartos / {item.bathrooms ?? 0} banheiros /{" "}
                    {getAreaLabel(item)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                    {getLocationLabel(item)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-gray-300 px-6 py-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Nenhum imovel encontrado</h3>
            <p className="mt-2 text-sm text-gray-500">
              Ajuste a busca ou remova filtros para ver mais opcoes.
            </p>
            <Link
              href="/#imoveis"
              className="mt-5 inline-flex bg-black px-5 py-2.5 text-sm font-medium text-white"
            >
              Limpar filtros
            </Link>
          </div>
        )}
      </section>

      <section className="flex flex-col items-start justify-between gap-6 bg-black px-8 py-14 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Digitalize sua captacao com QR Code imobiliario
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Leads automaticos, notificacoes no WhatsApp e painel completo para corretores.
          </p>
        </div>
        <Link
          href="/login"
          className="shrink-0 border border-white px-6 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
        >
          Comece agora
        </Link>
      </section>

      <footer className="bg-black px-8 py-14 text-white">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <FooterColumn
            title="Empresa"
            links={[
              ["Sobre nos", "/plans"],
              ["Carreiras", "/login"],
            ]}
          />
          <FooterColumn
            title="Explorar"
            links={[
              ["Para corretores", "/login"],
              ["Planos e precos", "/plans"],
            ]}
          />
          <FooterColumn
            title="Suporte"
            links={[
              ["Central de ajuda", "/login"],
              ["Contato", "/login"],
            ]}
          />
          <FooterColumn
            title="Acesso"
            links={[
              ["Entrar", "/login"],
              ["Criar conta", "/login"],
              ["Painel", "/dashboard"],
            ]}
          />
        </div>
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} ImoveisQR. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SelectFilter({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
      <select
        name={name}
        data-testid={`home-filter-${name}`}
        defaultValue={value}
        className="mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-900 outline-none focus:border-gray-900"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${name}-${optionValue || "all"}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-white/80 transition hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

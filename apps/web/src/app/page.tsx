import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type GlobalMetrics = {
  total_properties: number;
  total_sold: number;
  total_clients: number;
  active_brokers: number;
  total_commission: number;
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function Home() {
  const fallback: GlobalMetrics = {
    total_properties: 0,
    total_sold: 0,
    total_clients: 0,
    active_brokers: 0,
    total_commission: 0,
  };

  let metrics = fallback;
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb.rpc("get_global_dashboard_metrics");
    if (data && typeof data === "object") {
      const d = data as Partial<GlobalMetrics>;
      metrics = {
        total_properties: Number(d.total_properties ?? 0),
        total_sold: Number(d.total_sold ?? 0),
        total_clients: Number(d.total_clients ?? 0),
        active_brokers: Number(d.active_brokers ?? 0),
        total_commission: Number(d.total_commission ?? 0),
      };
    }
  } catch {
    metrics = fallback;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── HERO ────────────────────────────────────────────── */}
      <div
        className="relative flex h-screen min-h-[600px] flex-col"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay escuro */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Nav sobre o hero */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-5">
          <span className="text-sm font-bold uppercase tracking-widest text-white">IMOBQR</span>
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

        {/* Conteúdo hero */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
          <h1 className="font-display text-5xl font-semibold text-white drop-shadow-sm lg:text-6xl">
            Encontre seu lugar
          </h1>

          {/* Barra de busca estilo Compass */}
          <div className="mt-8 w-full max-w-2xl">
            <div className="flex overflow-hidden rounded-none">
              <button
                type="button"
                className="bg-white px-6 py-3 text-sm font-semibold text-gray-900"
              >
                Comprar
              </button>
              <button
                type="button"
                className="bg-white px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Alugar
              </button>
              <button
                type="button"
                className="bg-white px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Anunciar
              </button>
            </div>
            <div className="flex bg-white">
              <input
                type="text"
                placeholder="Cidade, bairro, endereço, referência..."
                className="flex-1 px-5 py-4 text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <Link
                href="/login"
                className="flex items-center bg-black px-5 text-white transition hover:bg-zinc-800"
                aria-label="Buscar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO: IMÓVEIS DESTAQUE ──────────────────────────── */}
      <section className="px-8 py-14">
        <h2 className="text-2xl font-bold text-gray-900">Imóveis em destaque</h2>
        <p className="mt-1 text-sm text-gray-500">
          Confira os imóveis com QR Code ativo na plataforma.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card exemplo 1 */}
          <div className="overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
            <div
              className="h-52 w-full bg-gray-200"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=70')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="p-4">
              <p className="text-xl font-bold text-gray-900">R$ 850.000</p>
              <p className="mt-1 text-sm text-gray-600">3 quartos · 2 banheiros · 120 m²</p>
              <p className="mt-1 text-sm text-gray-500">Rua das Palmeiras, São Paulo, SP</p>
            </div>
          </div>

          {/* Card exemplo 2 */}
          <div className="overflow-hidden rounded-sm border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
            <div
              className="h-52 w-full bg-gray-200"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=70')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="p-4">
              <p className="text-xl font-bold text-gray-900">R$ 1.250.000</p>
              <p className="mt-1 text-sm text-gray-600">4 quartos · 3 banheiros · 210 m²</p>
              <p className="mt-1 text-sm text-gray-500">Av. Atlântica, Rio de Janeiro, RJ</p>
            </div>
          </div>

          {/* Card escuro — estilo "Exclusivos" da Compass */}
          <div className="flex flex-col justify-between overflow-hidden rounded-sm bg-gray-900 p-6 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">IMOBQR</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white">
                QR EXCLUSIVO
              </p>
              <h3 className="mt-4 text-xl font-bold leading-snug text-white">
                Capture leads antes do imóvel ir ao mercado
              </h3>
              <p className="mt-3 text-sm text-white/70">
                QR Code na placa gera interesse automático e notifica o corretor em tempo real.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center border border-white px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white hover:text-gray-900"
            >
              Quero anunciar &rarr;
            </Link>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-8 inline-flex items-center bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Ver todos os imóveis &rarr;
        </Link>
      </section>

      {/* ── BANNER CTA PRETO ──────────────────────────────────── */}
      <section className="flex flex-col items-start justify-between gap-6 bg-black px-8 py-14 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Digitalize sua captação com QR Code imobiliário
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Leads automáticos, notificações no WhatsApp e painel completo para corretores.
          </p>
        </div>
        <Link
          href="/login"
          className="shrink-0 border border-white px-6 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black"
        >
          Comece agora &rarr;
        </Link>
      </section>

      {/* ── MÉTRICAS DA PLATAFORMA ───────────────────────────── */}
      <section className="px-8 py-14">
        <h2 className="text-2xl font-bold text-gray-900">Plataforma em números</h2>
        <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-3xl font-bold text-gray-900">{metrics.total_properties}</p>
            <p className="mt-1 text-sm text-gray-500">Imóveis cadastrados</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{metrics.total_sold}</p>
            <p className="mt-1 text-sm text-gray-500">Imóveis vendidos</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{metrics.total_clients}</p>
            <p className="mt-1 text-sm text-gray-500">Clientes atendidos</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{metrics.active_brokers}</p>
            <p className="mt-1 text-sm text-gray-500">Corretores ativos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatBRL(metrics.total_commission)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Comissão total</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-black px-8 py-14 text-white">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">
              Empresa
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/plans" className="text-sm text-white/80 transition hover:text-white">
                  Sobre nós
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Carreiras
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">
              Explorar
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Para corretores
                </Link>
              </li>
              <li>
                <Link href="/plans" className="text-sm text-white/80 transition hover:text-white">
                  Planos e preços
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">
              Suporte
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Central de ajuda
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Contato
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/50">
              Acesso
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-white/80 transition hover:text-white">
                  Criar conta
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-white/80 transition hover:text-white"
                >
                  Painel
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} ImobQR. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";

const steps = [
  {
    title: "Crie o anuncio e gere o QR",
    body: "Depois de cadastrar o imovel, o sistema gera um QR exclusivo pronto para uso comercial.",
    image:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Use o QR onde quiser",
    body: "Aplique na placa, vitrine, folder, story ou material de campanha. O interessado nao precisa baixar aplicativo.",
    image:
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Visitante escaneia e abre o WhatsApp",
    body: "Ao ler o QR Code, o visitante ve os dados do imovel e pode seguir direto para o WhatsApp para pedir visita, corretor ou opcoes semelhantes.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Lead e interesse ficam visiveis para o corretor",
    body: "A leitura do QR fica registrada no sistema e o corretor acompanha no painel quem avancou para atendimento e quais imoveis estao puxando demanda.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="absolute left-0 right-0 top-0 z-20 px-6 py-5 md:px-8">
        <nav className="flex items-center justify-between text-white">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest">
            ImoveisQR
          </Link>
          <Link href="/teste-gratis" className="text-sm font-semibold">
            Criar conta teste
          </Link>
        </nav>
      </header>

      <main>
        <section
          className="relative flex min-h-[560px] items-center px-6 py-24 md:px-12 lg:px-16"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(0,0,0,0.72), rgba(0,0,0,0.18)), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Como funciona
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white lg:text-5xl">
              Da placa no imovel ao lead rastreavel no painel.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80">
              O ImoveisQR transforma curiosidade anonima em contexto rastreavel. O corretor para de
              depender de memoria, print solto e pergunta perdida no WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/teste-gratis"
                className="bg-white px-6 py-3 text-sm font-bold text-black"
              >
                Criar meu primeiro QR
              </Link>
              <Link
                href="/#imoveis"
                className="border border-white px-6 py-3 text-sm font-bold text-white"
              >
                Ver imoveis com QR ativo
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 md:px-12 lg:px-16">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-gray-950">O fluxo completo</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Cada etapa foi pensada para ser simples para o corretor e objetiva para o
                interessado.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className="overflow-hidden border border-gray-200 bg-white"
                >
                  <div
                    className="h-64 bg-gray-200"
                    role="img"
                    aria-label={step.title}
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.28)), url('${step.image}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="p-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      Passo {index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-gray-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-black px-6 py-14 text-white md:px-12 lg:px-16">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold">Teste com um imovel real.</h2>
              <p className="mt-2 text-sm text-white/65">
                Em poucos minutos voce gera o QR, abre a pagina publica e deixa o painel pronto para
                acompanhar as primeiras leituras.
              </p>
            </div>
            <Link
              href="/teste-gratis"
              className="shrink-0 bg-white px-6 py-3 text-sm font-bold text-black"
            >
              Comecar teste gratuito
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

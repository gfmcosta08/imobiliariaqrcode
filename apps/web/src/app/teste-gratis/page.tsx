import Link from "next/link";

const signupHref = "/login?mode=signup&next=/onboarding/primeiro-qr";

export default function TesteGratisPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-5 md:px-8">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-gray-900">
            ImoveisQR
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-black">
            Entrar
          </Link>
        </nav>
      </header>

      <main>
        <section className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex items-center px-6 py-16 md:px-12 lg:px-16">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Conta teste gratuita
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-gray-950 lg:text-5xl">
                Crie seu primeiro QR e veja o lead chegar antes de assinar.
              </h1>
              <p className="mt-5 text-base leading-7 text-gray-600">
                A conta teste libera 1 imovel ativo, QR Code publico e painel de leads. Sem cartao
                de credito, sem compromisso e com o caminho mais curto para sentir valor.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={signupHref}
                  className="bg-black px-6 py-3 text-sm font-semibold text-white"
                >
                  Criar conta teste
                </Link>
                <Link
                  href="/como-funciona"
                  className="border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-900"
                >
                  Ver passo a passo
                </Link>
              </div>

              <dl
                className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3"
                aria-label="Sem cartao de credito"
              >
                <div>
                  <dt className="text-2xl font-bold text-gray-950">1</dt>
                  <dd className="text-sm text-gray-500">imovel ativo para testar</dd>
                </div>
                <div>
                  <dt className="text-2xl font-bold text-gray-950">QR</dt>
                  <dd className="text-sm text-gray-500">pronto para placa, vitrine ou stories</dd>
                </div>
                <div>
                  <dt className="text-2xl font-bold text-gray-950">0</dt>
                  <dd className="text-sm text-gray-500">cartao de credito no cadastro</dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            className="min-h-[420px] bg-gray-900"
            role="img"
            aria-label="Fachada de imovel moderno usada para demonstrar placa com QR Code"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.46)), url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </section>

        <section className="border-t border-gray-200 px-6 py-14 md:px-12 lg:px-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">O que voce testa</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Cadastro do primeiro imovel, QR publico, captura do interessado e painel para
                acompanhar retorno.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-950">O que nao precisa agora</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Nao precisa cadastrar toda a carteira, contratar plano ou configurar integracao
                complexa para validar o fluxo.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-950">Quando assinar</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Quando quiser mais anuncios ativos, rotina comercial completa e controle de leads
                para mais imoveis.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import Link from "next/link";

import { ContatoChatSection } from "../components/ContatoChatSection";

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-5 md:px-8">
        <nav className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-widest text-gray-900">
            ImoveisQR
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Atendimento</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Fale Conosco</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Tem duvidas sobre planos, QR Code ou o painel do corretor? Envie sua mensagem pelo chat
          abaixo. Nossa equipe registra e responde pelo mesmo canal — sem precisar ligar ou abrir
          ticket em outro sistema.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Horario de atendimento: dias uteis, das 9h as 18h (horario de Brasilia). Fora desse
          periodo, sua mensagem fica registrada e sera respondida no proximo dia util.
        </p>

        <div className="mt-10">
          <ContatoChatSection />
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Prefere ler antes? Consulte nossa{" "}
          <Link href="/privacidade" className="font-medium text-black underline">
            Politica de Privacidade
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

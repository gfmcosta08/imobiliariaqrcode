import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">404</p>
      <h1 className="mt-3 text-3xl font-bold text-gray-900">Página não encontrada</h1>
      <p className="mt-3 text-sm text-gray-500">Verifique o endereço ou volte ao início.</p>
      <Link
        href="/"
        className="mt-8 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        Voltar ao início
      </Link>
    </div>
  );
}

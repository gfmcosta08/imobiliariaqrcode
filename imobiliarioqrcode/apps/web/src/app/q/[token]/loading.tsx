export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-4xl animate-spin">🏠</div>
        <p className="mt-4 text-sm text-zinc-500">Carregando imóvel...</p>
      </div>
    </div>
  );
}
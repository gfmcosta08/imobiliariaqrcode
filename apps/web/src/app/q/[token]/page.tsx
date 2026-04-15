import { PublicQrClient } from "./public-qr-client";

type PageProps = { params: Promise<{ token: string }> };

export default async function PublicQrPage(props: PageProps) {
  const { token } = await props.params;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!base) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-sm text-red-600">NEXT_PUBLIC_SUPABASE_URL não configurada.</p>
      </div>
    );
  }

  let initial: unknown = null;
  let fetchError: string | null = null;
  try {
    const res = await fetch(`${base}/functions/v1/qr-resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    initial = await res.json();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  return <PublicQrClient token={token} initial={initial} fetchError={fetchError} />;
}

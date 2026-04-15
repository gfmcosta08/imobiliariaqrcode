import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MediaSection } from "./media-section";
import { PropertySimilarSection } from "./property-similar-section";
import { StatusForm } from "./status-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function PropertyDetailPage(props: PageProps) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: property, error } = await supabase
    .from("properties")
    .select(
      "id, public_id, title, description, city, state, listing_status, origin_plan_code, purpose, property_type, property_subtype, expires_at, printed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !property) {
    notFound();
  }

  const { data: planRow } = await supabase
    .from("plans")
    .select("max_images_per_property")
    .eq("code", property.origin_plan_code)
    .maybeSingle();

  const maxImages = planRow?.max_images_per_property ?? 10;

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("id, storage_path, mime_type, status")
    .eq("property_id", id)
    .neq("status", "deleted")
    .order("created_at", { ascending: true });

  const signedUrls: Record<string, string> = {};
  for (const m of mediaRows ?? []) {
    const { data: signed, error: signError } = await supabase.storage
      .from("property-media")
      .createSignedUrl(m.storage_path, 3600);
    if (!signError && signed?.signedUrl) {
      signedUrls[m.id] = signed.signedUrl;
    }
  }

  const { data: qr } = await supabase
    .from("property_qrcodes")
    .select("qr_token")
    .eq("property_id", id)
    .maybeSingle();

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const resolveUrl = qr?.qr_token
    ? `${baseUrl}/functions/v1/qr-resolve?token=${encodeURIComponent(qr.qr_token)}`
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/properties" className="underline">
          Imóveis
        </Link>{" "}
        / {property.public_id}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {property.title ?? property.public_id}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {property.city} / {property.state} · {property.property_type} · {property.purpose}
      </p>
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
          {property.description}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{property.listing_status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Plano origem</dt>
            <dd className="font-medium">{property.origin_plan_code}</dd>
          </div>
          {property.printed_at ? (
            <div>
              <dt className="text-zinc-500">Primeira impressão</dt>
              <dd className="font-medium">
                {new Date(property.printed_at).toLocaleString("pt-BR")}
              </dd>
            </div>
          ) : null}
          {property.expires_at ? (
            <div>
              <dt className="text-zinc-500">Expira em (FREE)</dt>
              <dd className="font-medium">
                {new Date(property.expires_at).toLocaleString("pt-BR")}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Publicação</h2>
        <StatusForm propertyId={property.id} currentStatus={property.listing_status} />
      </div>

      <MediaSection
        propertyId={property.id}
        media={mediaRows ?? []}
        signedUrls={signedUrls}
        maxImages={maxImages}
      />

      {resolveUrl ? (
        <div className="mt-10">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">QR Code (teste)</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Aponte a câmera para o código ou abra o link de resolução. Configure{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> para o projeto Supabase.
          </p>
          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row">
            <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(resolveUrl)}`}
                alt="QR Code do imóvel"
                width={200}
                height={200}
              />
            </div>
            <div className="max-w-full break-all text-xs text-zinc-500">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Payload:</span>{" "}
              {resolveUrl}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm text-amber-700 dark:text-amber-300">
          Token de QR não encontrado — verifique migrations e trigger.
        </p>
      )}

      <PropertySimilarSection propertyId={property.id} />

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline dark:text-zinc-400">
          Painel
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";

import { updatePropertyDetails } from "../actions";
import { PropertyEditorForm } from "../property-editor-form";
import { MediaSection } from "./media-section";
import { PropertyCountdown } from "./property-countdown";
import { PropertySimilarSection } from "./property-similar-section";
import { StatusForm } from "./status-form";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mediaError?: string }>;
};

export default async function PropertyDetailPage(props: PageProps) {
  const { id } = await props.params;
  const query = props.searchParams ? await props.searchParams : undefined;
  const mediaError = query?.mediaError ? decodeURIComponent(query.mediaError) : null;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select(
      "id, public_id, created_at, updated_at, title, internal_code, property_type, property_subtype, purpose, listing_status, city, state, neighborhood, postal_code, full_address, street_number, address_complement, latitude, longitude, description, full_description, highlights, broker_notes, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, total_area_m2, built_area_m2, land_area_m2, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, is_furnished, furnishing_status, floor_type, sun_position, property_age_years, owner_name, owner_phone, owner_email, listing_broker_name, listing_broker_phone, listing_broker_email, features, infrastructure, security_items, key_available, is_occupied, documentation, technical_details, construction_type, finish_standard, registry_number, documentation_status, has_deed, has_registration, nearby_points, distance_to_center_km, city_region, origin_plan_code, expires_at, printed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !property) notFound();

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
  for (const media of mediaRows ?? []) {
    const { data: signed, error: signError } = await supabase.storage
      .from("property-media")
      .createSignedUrl(media.storage_path, 3600);
    if (!signError && signed?.signedUrl) signedUrls[media.id] = signed.signedUrl;
  }

  const { data: qr } = await supabase
    .from("property_qrcodes")
    .select("qr_token, created_at")
    .eq("property_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let qrReads = 0;
  if (qr?.qr_token) {
    const { count } = await supabase
      .from("qr_access_events")
      .select("id", { count: "exact", head: true })
      .eq("qr_token", qr.qr_token);
    qrReads = count ?? 0;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (host ? `${proto}://${host}` : "");
  const publicQrUrl = qr?.qr_token ? `${appBase}/q/${encodeURIComponent(qr.qr_token)}` : null;

  const description = property.full_description ?? property.description ?? "Sem descrição.";

  return (
    <div className="min-h-screen bg-white">
      <AppHeader active="/properties" />
      <main className="mx-auto max-w-6xl px-8 py-12">
        <p className="text-sm text-gray-400">
          <Link href="/properties" className="transition hover:text-gray-700">Imóveis</Link>
          {" / "}{property.public_id}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          {property.title ?? property.public_id}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {property.city ?? "Cidade não informada"} / {property.state ?? "UF"} ·{" "}
          {property.property_type ?? "Tipo não informado"}
        </p>

        {mediaError ? (
          <p className="mt-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Upload parcial de imagens: {mediaError}
          </p>
        ) : null}

        {/* Descrição e detalhes */}
        <div className="mt-8 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Descrição</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{description}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-gray-400">Status</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{property.listing_status}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Plano origem</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{property.origin_plan_code}</dd>
            </div>
            {property.printed_at ? (
              <div>
                <dt className="text-xs text-gray-400">Primeira impressão</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {new Date(property.printed_at).toLocaleString("pt-BR")}
                </dd>
              </div>
            ) : null}
            {property.expires_at ? (
              <div>
                <dt className="text-xs text-gray-400">Expira em</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {new Date(property.expires_at).toLocaleString("pt-BR")}
                </dd>
              </div>
            ) : null}
          </dl>
          {property.expires_at ? <PropertyCountdown expiresAt={property.expires_at} /> : null}
        </div>

        {/* Editor completo */}
        <div className="mt-6 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Edição completa do imóvel
          </h2>
          <div className="mt-5">
            <PropertyEditorForm mode="edit" initial={property} action={updatePropertyDetails} />
          </div>
        </div>

        {/* Publicação */}
        <div className="mt-6 border border-gray-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Publicação</h2>
          <div className="mt-5">
            <StatusForm propertyId={property.id} currentStatus={property.listing_status} />
          </div>
        </div>

        {/* Mídia */}
        <div className="mt-6">
          <MediaSection
            propertyId={property.id}
            media={mediaRows ?? []}
            signedUrls={signedUrls}
            maxImages={maxImages}
          />
        </div>

        {/* QR Code */}
        {publicQrUrl ? (
          <div className="mt-6 border border-gray-200 p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
              QR Code ativo
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Leituras acumuladas: <span className="font-semibold text-gray-900">{qrReads}</span>
            </p>
            <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row">
              <div className="border border-gray-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicQrUrl)}`}
                  alt="QR Code do imóvel"
                  width={200}
                  height={200}
                />
              </div>
              <p className="max-w-full break-all text-xs text-gray-400">{publicQrUrl}</p>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-amber-700">
            Nenhum QR ativo encontrado para este imóvel.
          </p>
        )}

        <PropertySimilarSection propertyId={property.id} />
      </main>
    </div>
  );
}

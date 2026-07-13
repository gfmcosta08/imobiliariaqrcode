import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { MediaSection, PropertyEditorForm } from "@/features/properties/client";
import { updateInvitationProperty } from "../actions";

const PROPERTY_SELECT =
  "id, public_id, created_at, updated_at, title, internal_code, property_type, property_subtype, purpose, listing_status, city, state, neighborhood, postal_code, full_address, street_number, address_complement, location_map_url, latitude, longitude, full_description, highlights, broker_notes, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, total_area_m2, built_area_m2, land_area_m2, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, is_furnished, furnishing_status, floor_type, sun_position, property_age_years, features, infrastructure, security_items, key_available, is_occupied, documentation, technical_details, construction_type, finish_standard, registry_number, documentation_status, has_deed, has_registration, nearby_points, distance_to_center_km, city_region, origin_plan_code";

export default async function CompleteListingPage() {
  const supabase = await createClient();
  const serviceRole = createServiceRoleClient();

  const { data: propertyId } = await supabase.rpc("get_my_invitation_property");

  if (!propertyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
          <p className="text-red-600 text-sm">
            Imóvel não encontrado. Entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  const { data: property } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
          <p className="text-red-600 text-sm">
            Imóvel não encontrado. Entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  const { data: planRow } = await supabase
    .from("plans")
    .select("max_images_per_property")
    .eq("code", property.origin_plan_code ?? "free")
    .maybeSingle();
  const maxImages = planRow?.max_images_per_property ?? 10;

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("id, storage_path, mime_type, status")
    .eq("property_id", property.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: true });

  const signedUrls: Record<string, string> = {};
  for (const media of mediaRows ?? []) {
    const { data: signed, error: signError } = await serviceRole.storage
      .from("property-media")
      .createSignedUrl(media.storage_path, 3600);
    if (!signError && signed?.signedUrl) signedUrls[media.id] = signed.signedUrl;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Complete seu anúncio</h1>
          <p className="text-sm text-gray-500 mt-1">Passo 2 de 2 &mdash; Dados do imóvel</p>
        </div>
        <PropertyEditorForm mode="edit" initial={property} action={updateInvitationProperty} />
        <div className="mt-6 rounded-none border border-zinc-200 bg-white p-5">
          <MediaSection
            propertyId={property.id}
            media={mediaRows ?? []}
            signedUrls={signedUrls}
            maxImages={maxImages}
          />
        </div>
      </div>
    </div>
  );
}

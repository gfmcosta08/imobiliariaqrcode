import { createClient } from "@/lib/supabase/server";
import { PropertyEditorForm } from "@/app/properties/property-editor-form";
import { updateInvitationProperty } from "../actions";

const PROPERTY_SELECT =
  "id, public_id, created_at, updated_at, title, internal_code, property_type, property_subtype, purpose, listing_status, city, state, neighborhood, postal_code, full_address, street_number, address_complement, latitude, longitude, full_description, highlights, broker_notes, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, total_area_m2, built_area_m2, land_area_m2, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, is_furnished, furnishing_status, floor_type, sun_position, property_age_years, features, infrastructure, security_items, key_available, is_occupied, documentation, technical_details, construction_type, finish_standard, registry_number, documentation_status, has_deed, has_registration, nearby_points, distance_to_center_km, city_region";

export default async function CompleteListingPage() {
  const supabase = await createClient();

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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Complete seu anúncio</h1>
          <p className="text-sm text-gray-500 mt-1">Passo 2 de 2 &mdash; Dados do imóvel</p>
        </div>
        <PropertyEditorForm
          mode="edit"
          initial={property}
          action={updateInvitationProperty}
        />
      </div>
    </div>
  );
}

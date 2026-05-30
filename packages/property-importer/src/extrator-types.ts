/** Shape retornado por POST /v1/extract do extrator (campo `listing`). */
export type ExtratorListing = {
  property_subtype: string;
  purpose: "" | "sale" | "rent";
  title: string;
  description: string;
  city: string;
  state: string;
  neighborhood: string;
  postal_code: string;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  area_m2: string;
  sale_price: string;
  rent_price: string;
  condo_fee: string;
  iptu_amount: string;
  built_area_m2: string;
  land_area_m2: string;
  full_address: string;
  internal_code: string;
  full_description: string;
  debug?: {
    expanded?: boolean;
    expandClicks?: number;
    scrollSteps?: number;
    descLength?: number;
    imagesFound?: number;
  };
  images: Array<{
    url: string;
    saved_to?: string;
    content_type?: string;
    bytes?: number | null;
    error?: string;
  }>;
};

export type ExtratorExtractResult =
  | { url: string; ok: true; listing: ExtratorListing }
  | { url: string; ok: false; error: { message: string } };

export type ExtratorExtractResponse = {
  ok: boolean;
  results: ExtratorExtractResult[];
};

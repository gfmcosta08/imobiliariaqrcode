export type PastedListingDraft = {
  title: string | null;
  description: string | null;
  city: string | null;
  neighborhood: string | null;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  area: number | null;
};

function parseBrlAmount(raw: string): number | null {
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const value = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

export function parsePastedListing(text: string): PastedListingDraft {
  const source = text.trim();
  if (!source) {
    return {
      title: null,
      description: null,
      city: null,
      neighborhood: null,
      sale_price: null,
      rent_price: null,
      bedrooms: null,
      bathrooms: null,
      parking_spaces: null,
      area: null,
    };
  }

  const saleMatch = source.match(/(?:venda|vende|à venda|a venda)[^\d]{0,20}(R\$\s*[\d.,]+)/i);
  const rentMatch = source.match(/(?:aluguel|aluga|locação|locacao)[^\d]{0,20}(R\$\s*[\d.,]+)/i);
  const genericPrice = source.match(/R\$\s*([\d.,]+)/i);

  const bedroomsRaw = firstMatch(source, /(\d+)\s*quartos?/i);
  const bathroomsRaw = firstMatch(source, /(\d+)\s*banheiros?/i);
  const parkingRaw = firstMatch(source, /(\d+)\s*vagas?/i);
  const areaRaw = firstMatch(source, /(\d+(?:[.,]\d+)?)\s*m\s*2/i);

  const titleLine =
    source
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? null;

  return {
    title: titleLine,
    description: source,
    city: firstMatch(source, /(?:cidade)\s*[:\-]?\s*([A-Za-zÀ-ÿ\s]{3,40})/i),
    neighborhood: firstMatch(source, /(?:bairro)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9\s]{3,40})/i),
    sale_price: saleMatch
      ? parseBrlAmount(saleMatch[1])
      : genericPrice
        ? parseBrlAmount(genericPrice[1])
        : null,
    rent_price: rentMatch ? parseBrlAmount(rentMatch[1]) : null,
    bedrooms: bedroomsRaw ? Number(bedroomsRaw) : null,
    bathrooms: bathroomsRaw ? Number(bathroomsRaw) : null,
    parking_spaces: parkingRaw ? Number(parkingRaw) : null,
    area: areaRaw ? Number(areaRaw.replace(",", ".")) : null,
  };
}

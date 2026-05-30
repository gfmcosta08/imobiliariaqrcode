/**
 * Importação de anúncios: somente homologação (Preview/dev).
 * Alinhado a homologacao-staging.md e PRD-homologacao-staging-dados-sanitizados-whatsapp.md.
 */
export function isPropertyImportEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.ENABLE_PROPERTY_IMPORT === "0") {
    return false;
  }
  if (process.env.ENABLE_PROPERTY_IMPORT === "1") {
    return true;
  }
  return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}

export function getPropertyExtractorBaseUrl(): string | null {
  const raw = process.env.PROPERTY_EXTRACTOR_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

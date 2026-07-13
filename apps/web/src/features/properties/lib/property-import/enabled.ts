/**
 * Importação de anúncios: Preview/dev por padrão; Production só com ENABLE_PROPERTY_IMPORT=1.
 */
export function isPropertyImportEnabled(): boolean {
  if (process.env.ENABLE_PROPERTY_IMPORT === "0") {
    return false;
  }
  if (process.env.ENABLE_PROPERTY_IMPORT === "1") {
    return true;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}

export function getPropertyExtractorBaseUrl(): string | null {
  const raw = process.env.PROPERTY_EXTRACTOR_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

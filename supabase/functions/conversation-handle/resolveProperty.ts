export type PropertyLoader<TProperty> = (tokenOrPublicId: string) => Promise<TProperty | null>;

/**
 * Resolve o imóvel a partir de um identificador que pode ser:
 * - qr_token (Ref: <qr_token>)
 * - public_id (ex: IMV-2026-567596) quando o QR foi gerado sem Ref.
 */
export async function resolvePropertyByQrOrPublicId<TProperty>(
  tokenOrPublicId: string,
  loadByQrToken: PropertyLoader<TProperty>,
  loadByPublicId: PropertyLoader<TProperty>,
): Promise<TProperty | null> {
  const byQrToken = await loadByQrToken(tokenOrPublicId);
  if (byQrToken) return byQrToken;
  return loadByPublicId(tokenOrPublicId);
}


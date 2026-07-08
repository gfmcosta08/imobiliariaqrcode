export function buildLeadStartText(publicId: string, qrToken: string): string {
  return `Oi! Tenho interesse no imovel ${publicId} que vi no QR Code. Me passa as informacoes dele? (Ref: ${qrToken})`;
}


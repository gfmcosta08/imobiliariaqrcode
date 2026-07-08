export function buildConvitePrintTitle(publicId: string | null | undefined): string {
  const printablePublicId = publicId?.trim() || "sem ID";
  return `Convite Cortesia - ${printablePublicId}`;
}

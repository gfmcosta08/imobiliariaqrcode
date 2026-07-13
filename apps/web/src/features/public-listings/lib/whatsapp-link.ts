const MOBILE_UA_RE = /android|iphone|ipad|ipod|mobile|webos|blackberry|iemobile|opera mini/i;

export function chooseWhatsappRedirect(
  whatsappLink: string | null,
  whatsappDeepLink: string | null,
  userAgent: string | null | undefined,
): string | null {
  const isMobile = Boolean(userAgent && MOBILE_UA_RE.test(userAgent));
  if (isMobile && whatsappDeepLink) return whatsappDeepLink;
  return whatsappLink ?? whatsappDeepLink ?? null;
}

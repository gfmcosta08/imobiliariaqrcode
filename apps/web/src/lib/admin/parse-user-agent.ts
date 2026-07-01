export type DeviceClass = "mobile" | "desktop" | "tablet" | "bot" | "unknown";

export type ParsedUserAgent = {
  device: DeviceClass;
  browser: string;
  os: string;
};

export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|facebookexternalhit/i.test(ua)) return "bot";
  if (/ipad|tablet|kindle|playbook/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|webos|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Opera|OPR\//i.test(ua)) return "Opera";
  return "Outro";
}

function detectOs(ua: string): string {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Outro";
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent ?? "";
  return {
    device: classifyDevice(ua),
    browser: detectBrowser(ua),
    os: detectOs(ua),
  };
}

export function deviceLabel(device: DeviceClass): string {
  switch (device) {
    case "mobile":
      return "Mobile";
    case "desktop":
      return "Desktop";
    case "tablet":
      return "Tablet";
    case "bot":
      return "Bot";
    case "unknown":
      return "Desconhecido";
    default: {
      const _exhaustive: never = device;
      return _exhaustive;
    }
  }
}

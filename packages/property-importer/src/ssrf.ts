import { isPropertyDetailPathname } from "./constants";
import {
  getImportUrlPolicy,
  hostnameMatchesAllowlist,
  hostnameMatchesPilot,
  type ImportUrlPolicy,
} from "./import-policy";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export function isBlockedPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

function isAllowedHostname(hostname: string, policy: ImportUrlPolicy): boolean {
  if (isBlockedPublicHostname(hostname)) return false;

  switch (policy.mode) {
    case "pilot":
      return hostnameMatchesPilot(hostname);
    case "allowlist":
      if (policy.allowedHosts.length === 0) return false;
      return hostnameMatchesAllowlist(hostname, policy.allowedHosts);
    case "open":
      return hostname.includes(".");
  }
}

export type UrlValidationError =
  | "invalid_url"
  | "https_required"
  | "host_not_allowed"
  | "credentials_not_allowed";

export function validateImportUrl(
  raw: string,
  policy: ImportUrlPolicy = getImportUrlPolicy(),
): { ok: true; url: URL } | { ok: false; error: UrlValidationError } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "invalid_url" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "https_required" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "credentials_not_allowed" };
  }
  if (!isAllowedHostname(url.hostname, policy)) {
    return { ok: false, error: "host_not_allowed" };
  }

  return { ok: true, url };
}

/** @deprecated use validateImportUrl */
export function validatePilotImportUrl(raw: string) {
  return validateImportUrl(raw, { mode: "pilot", allowedHosts: [] });
}

export function isPropertyDetailUrl(url: URL): boolean {
  return isPropertyDetailPathname(url.pathname);
}

export function inferImportMode(url: URL): "single" | "listing" | "homepage" {
  if (isPropertyDetailUrl(url)) return "single";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home" || path === "/index") return "homepage";
  return "listing";
}

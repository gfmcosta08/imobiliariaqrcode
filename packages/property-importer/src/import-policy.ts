import { PILOT_HOST_SUFFIX } from "./constants";

export type ImportUrlMode = "open" | "pilot" | "allowlist";

export type ImportUrlPolicy = {
  mode: ImportUrlMode;
  allowedHosts: string[];
};

export function getImportUrlPolicy(): ImportUrlPolicy {
  const modeRaw = (process.env.PROPERTY_IMPORT_MODE ?? "open").trim().toLowerCase();
  const allowedHosts = (process.env.PROPERTY_IMPORT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);

  if (modeRaw === "pilot") {
    return { mode: "pilot", allowedHosts: [PILOT_HOST_SUFFIX, `www.${PILOT_HOST_SUFFIX}`] };
  }
  if (modeRaw === "allowlist") {
    return { mode: "allowlist", allowedHosts };
  }
  return { mode: "open", allowedHosts: [] };
}

export function hostnameMatchesAllowlist(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return allowedHosts.some((allowed) => {
    const entry = allowed.replace(/\.$/, "");
    return host === entry || host.endsWith(`.${entry}`);
  });
}

export function hostnameMatchesPilot(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === PILOT_HOST_SUFFIX ||
    host === `www.${PILOT_HOST_SUFFIX}` ||
    host.endsWith(`.${PILOT_HOST_SUFFIX}`)
  );
}

export function hostnameMatchesSourceSite(imageHost: string, sourceHost: string): boolean {
  const image = imageHost.toLowerCase().replace(/\.$/, "");
  const source = sourceHost.toLowerCase().replace(/\.$/, "");
  if (image === source) return true;
  if (image.endsWith(`.${source}`)) return true;
  const sourceBase = source.startsWith("www.") ? source.slice(4) : source;
  if (image === sourceBase || image === `www.${sourceBase}`) return true;
  if (image.endsWith(`.${sourceBase}`)) return true;
  return false;
}

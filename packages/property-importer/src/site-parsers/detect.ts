import { detectSiteImportDefinition } from "./registry";
import type { SiteParser } from "./types";

export { detectSiteImportDefinition };

/**
 * Return the site-specific parser for a given hostname, or null if none is registered.
 * Matching is performed after stripping the "www." prefix.
 */
export function detectSiteParser(hostname: string): SiteParser | null {
  return detectSiteImportDefinition(hostname)?.parser ?? null;
}

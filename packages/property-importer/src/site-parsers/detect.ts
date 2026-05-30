import type { SiteParser } from "./types";
import { ALL_PARSERS } from "./sites/index";

function normalizeHost(h: string): string {
  return h.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/**
 * Return the site-specific parser for a given hostname, or null if none is registered.
 * Matching is performed after stripping the "www." prefix.
 */
export function detectSiteParser(hostname: string): SiteParser | null {
  const host = normalizeHost(hostname);
  for (const parser of ALL_PARSERS) {
    for (const registered of parser.hostnames) {
      const norm = normalizeHost(registered);
      if (host === norm || host.endsWith(`.${norm}`)) {
        return parser;
      }
    }
  }
  return null;
}

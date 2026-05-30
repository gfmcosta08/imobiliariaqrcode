import type { ExtratorListing } from "../extrator-types";

/**
 * Interface that every site-specific parser must implement.
 * Each parser is responsible for extracting a full property listing
 * from the rendered (or static) HTML of a specific real estate website.
 */
export interface SiteParser {
  /** Exact hostnames handled by this parser (without leading www.) */
  hostnames: string[];
  /**
   * When true the engine uses /v1/discover (Playwright rendering) to fetch HTML.
   * When false a direct HTTP fetch is performed (faster, for non-JS sites).
   */
  needsRendering: boolean;
  /**
   * Extract property data from the page HTML.
   * Returns a partial listing; missing fields receive safe defaults.
   */
  parse(html: string, url: string): Partial<ExtratorListing>;
}

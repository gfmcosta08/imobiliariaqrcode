#!/usr/bin/env node

import { assertCommercialStagingSafety } from "./lib/staging-commercial-safety.mjs";

try {
  const operation = process.argv[2] ?? "migration";
  const target = process.argv[3];
  const result = assertCommercialStagingSafety(process.env, { operation, target });
  console.log(
    `COMMERCIAL_STAGING_SAFETY_OK: operation=${result.operation} host=${result.stagingWebHost} project_ref=${result.supabaseProjectRef}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`COMMERCIAL_STAGING_SAFETY_BLOCKED: ${message}`);
  process.exit(1);
}

#!/usr/bin/env node

import { assertStagingBotSafety } from "./lib/staging-safety.mjs";

try {
  const result = assertStagingBotSafety(process.env);
  console.log(
    `STAGING_SAFETY_OK: host=${result.stagingWebHost} project_ref=${result.supabaseProjectRef}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`STAGING_SAFETY_BLOCKED: ${message}`);
  process.exit(1);
}

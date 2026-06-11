type CronAuthOk = { ok: true; secret: string };
type CronAuthFail = { ok: false; status: 401 | 500; error: "cron_secret_missing" | "unauthorized" };

export type CronAuthResult = CronAuthOk | CronAuthFail;

export function validateCronAuthorization(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): CronAuthResult {
  const secret = cronSecret?.trim();
  if (!secret) {
    return { ok: false, status: 500, error: "cron_secret_missing" };
  }

  if (authorizationHeader !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return { ok: true, secret };
}

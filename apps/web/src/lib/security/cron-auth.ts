import { NextResponse } from "next/server";

export type CronAuthOptions = {
  /**
   * Permite `?secret=` para uso local. Não use em produção se URLs forem logadas.
   */
  allowQuerySecret?: boolean;
};

type CronAuthOk = { ok: true; cronSecret: string };
type CronAuthFail = { ok: false; response: NextResponse };
export type CronAuthResult = CronAuthOk | CronAuthFail;

/**
 * 🔒 SEGURANÇA: falha-seguro para rotas /api/cron/*
 * - Se `CRON_SECRET` não estiver configurado => 500 (nunca "abre" a rota).
 * - Exige `Authorization: Bearer <CRON_SECRET>` (e opcionalmente `?secret=`).
 */
export function requireCronAuth(request: Request, options: CronAuthOptions = {}): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "missing_cron_secret" }, { status: 500 }),
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerOk = authHeader === `Bearer ${cronSecret}`;

  let queryOk = false;
  if (options.allowQuerySecret) {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret") ?? "";
    queryOk = querySecret === cronSecret;
  }

  if (!bearerOk && !queryOk) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, cronSecret };
}


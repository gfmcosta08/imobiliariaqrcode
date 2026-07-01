import { NextResponse, type NextRequest } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import { enrichSubscriberRows } from "@/lib/admin/subscriber-dashboard";
import type { SubscriberRow } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  account_id: string;
  plan_code: string | null;
  status: string | null;
  accounts: unknown;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asJoinedRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

async function fallbackSearchSubscribers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  q: string,
  limit: number,
  offset: number,
): Promise<SubscriberRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `account_id, plan_code, status,
       accounts!inner (
         profiles (email, full_name, whatsapp_number),
         brokers (whatsapp_number, display_name)
       )`,
    )
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit, 1))
    .range(offset, offset + Math.max(limit, 1) - 1);

  if (error) throw error;

  const search = q.trim().toLowerCase();
  const digits = search.replace(/\D/g, "");
  const rows = (data ?? []) as unknown as SubscriptionRow[];
  const filtered = rows.filter((row) => {
    const accounts = asJoinedRecord(row.accounts);
    const profile = first(
      accounts.profiles as
        | { email: string | null; full_name: string | null; whatsapp_number: string | null }
        | { email: string | null; full_name: string | null; whatsapp_number: string | null }[]
        | null
        | undefined,
    );
    const broker = first(
      accounts.brokers as
        | { whatsapp_number: string | null; display_name: string | null }
        | { whatsapp_number: string | null; display_name: string | null }[]
        | null
        | undefined,
    );
    const email = String(profile?.email ?? "").toLowerCase();
    const fullName = String(profile?.full_name ?? broker?.display_name ?? "").toLowerCase();
    const whatsapp = String(broker?.whatsapp_number ?? profile?.whatsapp_number ?? "");
    const accountId = String(row.account_id ?? "").toLowerCase();
    return (
      search === "" ||
      email.includes(search) ||
      fullName.includes(search) ||
      accountId.includes(search) ||
      whatsapp.toLowerCase().includes(search) ||
      (digits !== "" && whatsapp.replace(/\D/g, "").includes(digits))
    );
  });

  const enriched = await Promise.all(
    filtered.map(async (row) => {
      const accounts = asJoinedRecord(row.accounts);
      const profile = first(
        accounts.profiles as
          | { email: string | null; full_name: string | null; whatsapp_number: string | null }
          | { email: string | null; full_name: string | null; whatsapp_number: string | null }[]
          | null
          | undefined,
      );
      const broker = first(
        accounts.brokers as
          | { whatsapp_number: string | null; display_name: string | null }
          | { whatsapp_number: string | null; display_name: string | null }[]
          | null
          | undefined,
      );
      const accountId = row.account_id;

      const { count: propertiesCount } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      return {
        account_id: accountId,
        full_name: String(profile?.full_name ?? broker?.display_name ?? "Sem nome"),
        email: String(profile?.email ?? ""),
        whatsapp_number: String(broker?.whatsapp_number ?? profile?.whatsapp_number ?? ""),
        plan_code: String(row.plan_code ?? "free"),
        subscription_status: String(row.status ?? "free"),
        total_properties: Number(propertiesCount ?? 0),
        total_qr_reads: 0,
        total_leads: 0,
      } satisfies SubscriberRow;
    }),
  );

  return enrichSubscriberRows(
    supabase,
    enriched.sort((a, b) => a.full_name.localeCompare(b.full_name)),
  );
}

export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const userClient = await createClient();
  const { data, error } = await userClient.rpc("admin_search_subscribers", {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    if (!error.message.includes("function public.admin_search_subscribers")) {
      const status = error.message.includes("forbidden") ? 403 : 500;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }

    try {
      const rows = await fallbackSearchSubscribers(admin.supabase, q, limit, offset);
      return NextResponse.json({ ok: true, data: rows });
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error ? fallbackError.message : "Erro ao buscar assinantes";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  const rows = ((data ?? []) as SubscriberRow[]).map((row) => ({
    ...row,
    total_properties: Number(row.total_properties ?? 0),
    total_qr_reads: Number(row.total_qr_reads ?? 0),
    total_leads: Number(row.total_leads ?? 0),
  }));

  return NextResponse.json({ ok: true, data: await enrichSubscriberRows(admin.supabase, rows) });
}

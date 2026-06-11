import { recordActivationEvent } from "@/lib/analytics/activation-events";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ACTIVE_SUB_STATUSES = ["free", "starter_active", "pro_pending_activation", "pro_active"];

type QuickCreateInput = {
  title?: string;
  property_type?: string;
  city?: string;
  neighborhood?: string;
  sale_price?: string;
  rent_price?: string;
  whatsapp_number?: string;
  description?: string;
};

function parsePrice(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
  try {
    let input: QuickCreateInput = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 12_288 });
      if (!parsed.ok) return parsed.response;
      const unknown = rejectUnknownKeys(parsed.value, [
        "title",
        "property_type",
        "city",
        "neighborhood",
        "sale_price",
        "rent_price",
        "whatsapp_number",
        "description",
      ]);
      if (unknown) {
        return NextResponse.json(
          { ok: false, error: "unexpected_field", field: unknown },
          { status: 400 },
        );
      }
      input = {
        title: clampString(parsed.value.title, { maxLength: 200, trim: true }),
        property_type: clampString(parsed.value.property_type, { maxLength: 80, trim: true }),
        city: clampString(parsed.value.city, { maxLength: 120, trim: true }),
        neighborhood: clampString(parsed.value.neighborhood, { maxLength: 120, trim: true }),
        sale_price: clampString(parsed.value.sale_price, { maxLength: 32, trim: true }),
        rent_price: clampString(parsed.value.rent_price, { maxLength: 32, trim: true }),
        whatsapp_number: clampString(parsed.value.whatsapp_number, { maxLength: 32, trim: true }),
        description: clampString(parsed.value.description, { maxLength: 2_000, trim: true }),
      };
    }

    const isProduction = process.env.VERCEL_ENV === "production";
    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();
    let { data: broker } = await supabase
      .from("brokers")
      .select("id, account_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!broker && !isProduction) {
      const fallbackName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "Corretor Teste";
      const fallbackWhatsapp =
        (user.user_metadata?.whatsapp_number as string | undefined)?.trim() ||
        `pending-${user.id.replace(/-/g, "")}`;

      let accountId: string | null = null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.account_id) {
        accountId = profile.account_id as string;
      } else {
        const { data: accountCreated, error: accountErr } = await supabase
          .from("accounts")
          .insert({})
          .select("id")
          .single();
        if (accountErr || !accountCreated) {
          return NextResponse.json(
            {
              ok: false,
              error: "quick_create_exception",
              detail: accountErr?.message ?? "account_create_failed",
            },
            { status: 500 },
          );
        }
        accountId = accountCreated.id as string;
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            account_id: accountId,
            email: user.email ?? `${user.id}@preview.local`,
            full_name: fallbackName,
            whatsapp_number: fallbackWhatsapp,
            role: "broker",
          },
          { onConflict: "id" },
        );
      }

      const { data: brokerCreated, error: brokerErr } = await supabase
        .from("brokers")
        .upsert(
          {
            account_id: accountId,
            profile_id: user.id,
            display_name: fallbackName,
            whatsapp_number: fallbackWhatsapp,
            status: "active",
          },
          { onConflict: "profile_id" },
        )
        .select("id, account_id")
        .single();

      if (brokerErr || !brokerCreated) {
        return NextResponse.json(
          {
            ok: false,
            error: "quick_create_exception",
            detail: brokerErr?.message ?? "broker_create_failed",
          },
          { status: 500 },
        );
      }

      broker = brokerCreated;
      await supabase.from("subscriptions").upsert(
        {
          account_id: accountId,
          plan_code: "free",
          status: "free",
        },
        { onConflict: "account_id" },
      );
    }

    if (!broker) {
      return NextResponse.json({ ok: false, error: "broker_not_found" }, { status: 403 });
    }

    const { data: subscriptionRow } = await supabase
      .from("subscriptions")
      .select("plan_code, status")
      .eq("account_id", broker.account_id)
      .maybeSingle();

    const subscription =
      subscriptionRow && ACTIVE_SUB_STATUSES.includes(subscriptionRow.status)
        ? subscriptionRow
        : !isProduction
          ? { plan_code: "free", status: "free" }
          : null;

    if (!subscription) {
      return NextResponse.json({ ok: false, error: "no_active_plan" }, { status: 403 });
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("max_active_properties")
      .eq("code", subscription.plan_code)
      .maybeSingle();

    if (isProduction && plan?.max_active_properties != null) {
      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("account_id", broker.account_id)
        .in("listing_status", ["published", "printed"]);

      if ((count ?? 0) >= plan.max_active_properties) {
        return NextResponse.json({ ok: false, error: "plan_limit_reached" }, { status: 422 });
      }
    }

    if (input.whatsapp_number) {
      await supabase
        .from("profiles")
        .update({ whatsapp_number: input.whatsapp_number, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      await supabase
        .from("brokers")
        .update({ whatsapp_number: input.whatsapp_number })
        .eq("id", broker.id);
    }

    const salePrice = parsePrice(input.sale_price);
    const rentPrice = parsePrice(input.rent_price);
    const purpose = rentPrice && !salePrice ? "rent" : "sale";

    const { count: beforeCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("account_id", broker.account_id);

    const { data: property, error: propError } = await supabase
      .from("properties")
      .insert({
        account_id: broker.account_id,
        broker_id: broker.id,
        origin_plan_code: subscription.plan_code,
        listing_status: "published",
        property_type: input.property_type || "Residencial",
        property_subtype: "Apartamento",
        purpose,
        title: input.title || null,
        description: input.description || "",
        city: input.city || "",
        state: "",
        neighborhood: input.neighborhood || "",
        sale_price: salePrice,
        rent_price: rentPrice,
      })
      .select("id, public_id")
      .single();

    if (propError || !property) {
      return NextResponse.json(
        { ok: false, error: "property_create_failed", detail: propError?.message },
        { status: 500 },
      );
    }

    let qrToken: string | null = null;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const { data } = await supabase
        .from("property_qrcodes")
        .select("qr_token")
        .eq("property_id", property.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data?.qr_token) {
        qrToken = data.qr_token as string;
        break;
      }
    }

    await recordActivationEvent(supabase, {
      account_id: broker.account_id as string,
      profile_id: user.id,
      event_name: (beforeCount ?? 0) === 0 ? "first_property_created" : "qr_generated",
      entity_type: "property",
      entity_id: property.id as string,
    });
    if (qrToken) {
      await recordActivationEvent(supabase, {
        account_id: broker.account_id as string,
        profile_id: user.id,
        event_name: "qr_generated",
        entity_type: "property",
        entity_id: property.id as string,
      });
    }

    return NextResponse.json({
      ok: true,
      property_id: property.id,
      public_id: property.public_id,
      qr_token: qrToken,
      listing_status: "published",
      next_url: `/properties/${property.id}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unexpected_quick_create_error";
    return NextResponse.json(
      { ok: false, error: "quick_create_exception", detail: message },
      { status: 500 },
    );
  }
}
